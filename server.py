from mcp.server.fastmcp import FastMCP
from mcp.server.auth.provider import AccessToken, TokenVerifier
from mcp.server.auth.settings import AuthSettings
from dotenv import load_dotenv
import httpx
import jwt  # PyJWT — validates the incoming OAuth access token
import json
import logging
import os
from datetime import date, datetime

load_dotenv()  # read GRAND_ALARIC_API_KEY etc. from a local .env if present

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("grand-alaric-mcp")

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
API_BASE_URL = os.getenv("API_BASE_URL", "https://api6.alarichotels.com/webapi/chatgpt")
API_KEY = os.getenv("GRAND_ALARIC_API_KEY", "")
API_KEY_HEADER = "phm-chat-api-key"

# OAuth (resource server). The MCP server validates the CALLER's token; it is NEVER
# forwarded to the PHM backend, which authenticates with its own server-side API key.
OAUTH_ISSUER_URL = os.getenv("OAUTH_ISSUER_URL", "")          # your OAuth provider (prod)
OAUTH_JWKS_URL = os.getenv("OAUTH_JWKS_URL", "")              # defaults to issuer + /.well-known/jwks.json
OAUTH_AUDIENCE = os.getenv("OAUTH_AUDIENCE", "")             # this server's public URL (token audience)
OAUTH_REQUIRED_SCOPES = [s for s in os.getenv("OAUTH_REQUIRED_SCOPES", "").split() if s]
TEST_TOKEN = os.environ.get("TEST_TOKEN", "")               # local-dev fallback: accept this one bearer token

# Public hosting: the SDK blocks unknown Host headers (DNS-rebinding protection). Behind
# a tunnel/proxy, list the public host(s) here, or use "*" to disable the check entirely.
MCP_ALLOWED_HOSTS = [h for h in os.getenv("MCP_ALLOWED_HOSTS", "").replace(",", " ").split() if h]
MCP_ALLOWED_ORIGINS = [o for o in os.getenv("MCP_ALLOWED_ORIGINS", "").replace(",", " ").split() if o]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _err(msg: str) -> str:
    return json.dumps({"error": msg}, indent=2)


def _validate_date(value: str, field: str) -> date:
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError:
        raise ValueError(f"'{field}' must be YYYY-MM-DD, got: '{value}'")


def _stay_dates(check_in_date: str, check_out_date: str) -> tuple[date, date]:
    """Validate a YYYY-MM-DD stay range. Raises ValueError on bad input."""
    check_in = _validate_date(check_in_date, "check_in_date")
    check_out = _validate_date(check_out_date, "check_out_date")
    if check_out <= check_in:
        raise ValueError("check_out_date must be after check_in_date.")
    if check_in < date.today():
        raise ValueError("check_in_date cannot be in the past.")
    return check_in, check_out


def _stay_body(hotel_id: str, check_in: date, check_out: date, guests: int, **extra) -> dict:
    """Request body shared by /rooms, /package, /room-packages (and /orders)."""
    return {"hotel_id": hotel_id, "checkin": check_in.isoformat(), "checkout": check_out.isoformat(),
            "adult": guests, "child": 0, "promocode": "", **extra}


async def _api(method: str, path: str, json_body: dict | None = None) -> str:
    # passthrough — returns the backend's JSON verbatim.
    try:
        async with httpx.AsyncClient(base_url=API_BASE_URL, timeout=20) as client:
            r = await client.request(method, path, json=json_body, headers={API_KEY_HEADER: API_KEY})
            r.raise_for_status()
            return r.text
    except httpx.HTTPError as exc:
        return _err(f"Upstream API error: {exc}")


# ---------------------------------------------------------------------------
# Auth — OAuth 2.0 resource server
# ---------------------------------------------------------------------------

class JWTVerifier(TokenVerifier):
    """Validate an incoming OAuth access token (JWT) against the provider's JWKS.

    This authenticates the CALLER to this server. The token is NOT passed through to
    the PHM backend — token pass-through is an MCP anti-pattern (the token's audience
    is this server, not the hotel API), and the backend uses its own key anyway.
    """

    def __init__(self, jwks_url: str, issuer: str, audience: str):
        self._jwks = jwt.PyJWKClient(jwks_url)
        self._issuer = issuer
        self._audience = audience

    async def verify_token(self, token: str) -> AccessToken | None:
        try:
            key = self._jwks.get_signing_key_from_jwt(token).key
            claims = jwt.decode(token, key, algorithms=["RS256"],
                                issuer=self._issuer, audience=self._audience)
        except Exception as exc:  # bad signature / issuer / audience / expiry / malformed
            logger.warning("rejected token: %s", exc)
            return None
        scope = claims.get("scope", "")
        scopes = scope.split() if isinstance(scope, str) else list(scope or [])
        return AccessToken(token=token, scopes=scopes, expires_at=claims.get("exp"),
                           client_id=claims.get("client_id") or claims.get("azp") or claims.get("sub", ""),
                           resource=self._audience or None, subject=claims.get("sub"), claims=claims)


class StaticTokenVerifier(TokenVerifier):
    """Local-dev fallback: accept exactly one preconfigured bearer token (TEST_TOKEN),
    so you can call the protected server from Postman without a real client session.
    Do NOT enable in production."""

    def __init__(self, token: str):
        self._token = token

    async def verify_token(self, token: str) -> AccessToken | None:
        if token != self._token:
            return None
        return AccessToken(token=token, client_id="local-dev", scopes=OAUTH_REQUIRED_SCOPES,
                           expires_at=None, resource=OAUTH_AUDIENCE or None, subject="local-dev")


def _auth_kwargs() -> dict:
    """FastMCP auth kwargs. token_verifier and auth must be set together (or neither)."""
    if OAUTH_ISSUER_URL:
        jwks = OAUTH_JWKS_URL or OAUTH_ISSUER_URL.rstrip("/") + "/.well-known/jwks.json"
        logger.info("OAuth enabled — issuer=%s audience=%s", OAUTH_ISSUER_URL, OAUTH_AUDIENCE)
        return {"token_verifier": JWTVerifier(jwks, OAUTH_ISSUER_URL, OAUTH_AUDIENCE),
                "auth": AuthSettings(issuer_url=OAUTH_ISSUER_URL, resource_server_url=OAUTH_AUDIENCE or None,
                                     required_scopes=OAUTH_REQUIRED_SCOPES or None)}
    if TEST_TOKEN:
        logger.warning("DEV AUTH — accepting a static TEST_TOKEN; do NOT use in production")
        return {"token_verifier": StaticTokenVerifier(TEST_TOKEN),
                "auth": AuthSettings(issuer_url="http://localhost", resource_server_url=OAUTH_AUDIENCE or None,
                                     required_scopes=OAUTH_REQUIRED_SCOPES or None)}
    logger.info("Auth disabled — set OAUTH_ISSUER_URL (prod) or TEST_TOKEN (dev) to enable")
    return {}


def _transport_security_kwargs() -> dict:
    """Allow the public Host when hosted behind a tunnel/proxy. Default (no env) keeps
    the SDK's DNS-rebinding protection on, localhost-only — unchanged for local dev."""
    if not MCP_ALLOWED_HOSTS and not MCP_ALLOWED_ORIGINS:
        return {}
    from mcp.server.transport_security import TransportSecuritySettings
    if "*" in MCP_ALLOWED_HOSTS:
        logger.warning("DNS-rebinding protection DISABLED (MCP_ALLOWED_HOSTS=*) — only behind a trusted proxy/tunnel")
        return {"transport_security": TransportSecuritySettings(enable_dns_rebinding_protection=False)}
    origins = MCP_ALLOWED_ORIGINS or [f"https://{h}" for h in MCP_ALLOWED_HOSTS]
    logger.info("Allowed hosts=%s origins=%s", MCP_ALLOWED_HOSTS, origins)
    return {"transport_security": TransportSecuritySettings(allowed_hosts=MCP_ALLOWED_HOSTS, allowed_origins=origins)}


# ---------------------------------------------------------------------------
# MCP server
# ---------------------------------------------------------------------------
mcp = FastMCP(
    "Grand Alaric Hotel Assistant",
    instructions=(
        "You are a hotel concierge for Grand Alaric properties in Bandung, Indonesia. "
        "Use search_hotels to find properties by location. "
        "Use check_availability to see room types and rates for specific dates. "
        "For bundle deals, use check_packages then check_room_packages. "
        "Use list_nationalities to resolve the guest's nationality code. "
        "Once the user picks a room or package and provides guest details (name, "
        "email, phone, nationality), use create_order to place the booking, then "
        "give them the payment link from the response to complete payment."
    ),
    **_auth_kwargs(),
    **_transport_security_kwargs(),
)


# ---------------------------------------------------------------------------
# Tools
# ---------------------------------------------------------------------------

@mcp.tool()
async def search_hotels(location: str) -> str:
    """
    List Grand Alaric properties (then pick the one matching the user's location).

    Args:
        location: City, area, or keyword (e.g. 'Bandung', 'Dago', 'Indonesia').
    """
    logger.info("search_hotels location=%r", location)
    return await _api("GET", "/hotels")


@mcp.tool()
async def check_availability(
    hotel_id: str,
    check_in_date: str,
    check_out_date: str,
    guests: int = 2,
) -> str:
    """
    Return available room types and rates for a hotel and date range.

    Args:
        hotel_id: Property ID from search_hotels (e.g. 'GSV').
        check_in_date: Check-in date in YYYY-MM-DD format.
        check_out_date: Check-out date in YYYY-MM-DD format.
        guests: Number of guests (default 2).
    """
    try:
        check_in, check_out = _stay_dates(check_in_date, check_out_date)
    except ValueError as exc:
        return _err(str(exc))

    logger.info("check_availability hotel=%s %s→%s guests=%d", hotel_id, check_in_date, check_out_date, guests)
    return await _api("POST", "/rooms", _stay_body(hotel_id, check_in, check_out, guests))


@mcp.tool()
async def check_packages(
    hotel_id: str,
    check_in_date: str,
    check_out_date: str,
    guests: int = 2,
) -> str:
    """
    List bookable packages (e.g. promo bundles) for a hotel and date range.

    Args:
        hotel_id: Property ID from search_hotels (e.g. 'GSV').
        check_in_date: Check-in date in YYYY-MM-DD format.
        check_out_date: Check-out date in YYYY-MM-DD format.
        guests: Number of guests.
    """
    try:
        check_in, check_out = _stay_dates(check_in_date, check_out_date)
    except ValueError as exc:
        return _err(str(exc))

    logger.info("check_packages hotel=%s %s→%s", hotel_id, check_in_date, check_out_date)
    return await _api("POST", "/package", _stay_body(hotel_id, check_in, check_out, guests))


@mcp.tool()
async def check_room_packages(
    hotel_id: str,
    check_in_date: str,
    check_out_date: str,
    package_code: str,
    guests: int = 2,
) -> str:
    """
    List the rooms and prices available within a specific package.

    Args:
        hotel_id: Property ID from search_hotels (e.g. 'GSV').
        check_in_date: Check-in date in YYYY-MM-DD format.
        check_out_date: Check-out date in YYYY-MM-DD format.
        package_code: Package code from check_packages (e.g. 'GNW').
        guests: Number of guests.
    """
    try:
        check_in, check_out = _stay_dates(check_in_date, check_out_date)
    except ValueError as exc:
        return _err(str(exc))

    logger.info("check_room_packages hotel=%s package=%s", hotel_id, package_code)
    return await _api("POST", "/room-packages",
                      _stay_body(hotel_id, check_in, check_out, guests, package_code=package_code))


@mcp.tool()
async def list_nationalities() -> str:
    """List valid nationality codes and phone codes for use in create_order."""
    logger.info("list_nationalities")
    return await _api("GET", "/nationality")


@mcp.tool()
async def create_order(
    hotel_id: str,
    check_in_date: str,
    check_out_date: str,
    guest_name: str,
    guest_email: str,
    guest_phone: str,
    room_id: str = "",
    package_code: str = "",
    package_id: str = "",
    nation_code: str = "id",
    salutation: int = 3,
    guests: int = 2,
    promocode: str = "",
) -> str:
    """
    Place a reservation. Call ONLY after the user has confirmed the room/package and
    all guest details. Pass EITHER room_id (a plain room, from check_availability) OR
    package_id + package_code (a package, from check_room_packages). Returns the order
    result, including a payment link to send the guest to.

    Args:
        hotel_id: Property ID from search_hotels (e.g. 'GSV').
        check_in_date: Check-in date in YYYY-MM-DD format.
        check_out_date: Check-out date in YYYY-MM-DD format.
        guest_name: Full name of the primary guest.
        guest_email: Guest email for the booking confirmation.
        guest_phone: Guest phone number (e.g. '+6282214171060').
        room_id: Room ID from check_availability (e.g. 'SUPK-IWS312ROO'). For a plain room.
        package_code: Package code from check_packages (e.g. 'GNW'). For a package booking.
        package_id: Package room ID from check_room_packages (e.g. 'DLXK-GNW335').
        nation_code: Guest nationality code from list_nationalities (e.g. 'id', 'ae').
        salutation: Salutation code as defined by the API (e.g. 3).
        guests: Number of adult guests.
        promocode: Optional promo code.
    """
    try:
        check_in, check_out = _stay_dates(check_in_date, check_out_date)
    except ValueError as exc:
        return _err(str(exc))

    if not room_id and not package_id:
        return _err("Provide either room_id (from check_availability) or package_id (from check_room_packages).")

    selection = {"package_code": package_code, "package_id": package_id} if package_id else {"room_id": room_id}
    order = _stay_body(hotel_id, check_in, check_out, guests, **selection,
                       guest={"salutation": salutation, "nation_code": nation_code,
                              "name": guest_name, "phone": guest_phone, "email": guest_email})
    order["promocode"] = promocode
    logger.info("create_order hotel=%s room=%s package=%s guest=%r", hotel_id, room_id, package_id, guest_name)
    # passthrough — the payment/confirmation link is in this response.
    return await _api("POST", "/orders", order)


if __name__ == "__main__":
    transport = os.getenv("MCP_TRANSPORT", "stdio")
    mcp.settings.host = os.getenv("HOST", "127.0.0.1")  # set 0.0.0.0 when hosting
    mcp.settings.port = int(os.getenv("PORT", "8000"))  # host/port only used by sse/http transports
    # note: endpoint unauthenticated; put a gateway/token in front if exposed beyond a trusted network.
    logger.info("Starting Grand Alaric MCP — transport=%s host=%s port=%d", transport, mcp.settings.host, mcp.settings.port)
    mcp.run(transport=transport)
