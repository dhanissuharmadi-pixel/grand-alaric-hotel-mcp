from mcp.server.fastmcp import FastMCP
from dotenv import load_dotenv
import html
import httpx
import json
import logging
import os
import re
from datetime import date, datetime
from functools import lru_cache
from pathlib import Path
from typing import Any

load_dotenv()  # read .env if present

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("grand-alaric-mcp")

# ---------------------------------------------------------------------------
# Config — all hotel-specific values come from .env so the server white-labels
# to any property without touching code.
# ---------------------------------------------------------------------------
API_BASE_URL = os.getenv("API_BASE_URL", "https://api6.alarichotels.com/webapi/chatgpt")
# API_KEY accepts the generic name or the legacy Grand Alaric name for back-compat.
API_KEY = os.getenv("API_KEY") or os.getenv("GRAND_ALARIC_API_KEY", "")
API_KEY_HEADER = os.getenv("API_KEY_HEADER", "phm-chat-api-key")

HOTEL_NAME = os.getenv("HOTEL_NAME", "Grand Alaric Hotel Assistant")
HOTEL_LOCATION = os.getenv("HOTEL_LOCATION", "Bandung, Indonesia")

# Primary hotel domain — drives widget CSP resource_domains and widgetDomain.
# For multiple domains, set RESOURCE_DOMAINS as a comma-separated list instead.
HOTEL_DOMAIN = os.getenv("HOTEL_DOMAIN", "grandalaric.com")
_resource_domains_env = os.getenv("RESOURCE_DOMAINS", "")
RESOURCE_DOMAINS = (
    [d.strip() for d in _resource_domains_env.split(",") if d.strip()]
    if _resource_domains_env
    else [f"https://*.{HOTEL_DOMAIN}"]
)
PAYMENT_DOMAIN = os.getenv("PAYMENT_DOMAIN", "https://m.grandalaric.com")

# Google Static Maps key for the hotel-details Location thumbnail. Read from env (never
# committed — the repo is public). Embedded in the static-map image URL the widget loads,
# so restrict this key by HTTP referrer + to the Maps Static API in Google Cloud Console.
GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY", "")

# Public hosting: the SDK blocks unknown Host headers (DNS-rebinding protection). Behind
# a tunnel/proxy, list the public host(s) here, or use "*" to disable the check entirely.
MCP_ALLOWED_HOSTS = [h for h in os.getenv("MCP_ALLOWED_HOSTS", "").replace(",", " ").split() if h]

# Apps SDK widgets: self-contained HTML built from widgets/ (see widgets/README.md).
ASSETS_DIR = Path(__file__).resolve().parent / "assets"
WIDGET_MIME = "text/html+skybridge"

# The widget iframe enforces a CSP; external hosts must be allowlisted or they're
# silently blocked. ChatGPT reads these OpenAI-specific keys (snake_case sub-fields).
WIDGETS = {
    "hotel-list": {"resource_domains": RESOURCE_DOMAINS},
    "room-results": {"resource_domains": RESOURCE_DOMAINS},
    "hotel-details": {"resource_domains": RESOURCE_DOMAINS + ["https://maps.googleapis.com"]},
    "checkout": {"redirect_domains": [PAYMENT_DOMAIN]},
}


def _widget_uri(name: str) -> str:
    return f"ui://widget/{name}.html"


def _widget_meta(name: str) -> dict:
    return {"openai/widgetCSP": dict(WIDGETS[name]), "openai/widgetDomain": f"https://{HOTEL_DOMAIN}"}


@lru_cache(maxsize=None)
def _widget_html(name: str) -> str:
    return (ASSETS_DIR / f"{name}.html").read_text(encoding="utf-8")


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


# Map a facility name to one of the hotel-details widget's built-in SVG icon names
# (the API gives PNG icon URLs the widget can't use). Unmatched → "check".
_FACILITY_ICONS = {
    "wifi": "wifi", "wi-fi": "wifi", "lan": "wifi", "internet": "wifi",
    "pool": "pool", "park": "parking", "valet": "parking",
    "gym": "gym", "fitness": "gym", "spa": "spa", "massage": "spa",
    "restaurant": "restaurant", "coffee": "restaurant",
    "breakfast": "breakfast", "welcome drink": "breakfast",
    "bar": "bar", "air conditioning": "ac",
}


def _facility_icon(name: str) -> str:
    n = name.lower()
    return next((icon for kw, icon in _FACILITY_ICONS.items() if kw in n), "check")


def _strip_html(value: str) -> str:
    """The API's hotel_description is HTML; the widget renders plain text."""
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", value or ""))).strip()


def _list_item(h: dict) -> dict:
    """Map a /hotels item to the hotel-list card shape (the API now ships cover, rating,
    city/province and starting_price directly — no per-hotel enrichment needed)."""
    area = ", ".join(p for p in (h.get("city_name"), h.get("province_name")) if p)
    return {"hotel_id": h.get("hotel_id"), "hotel_name": h.get("hotel_name"),
            "star_rating": h.get("rating"), "area": area or None,
            "image": h.get("hotel_cover"), "price_from": h.get("starting_price")}


def _normalize_hotel(base: dict, info: dict) -> dict:
    """Shape a /hotel/info `hotel` object into the keys the hotel-details widget reads,
    merged over the base id/name/phone from /hotels. Keeps the widget stable as the
    backend's field names differ (rating→star_rating, facilities→amenities, etc.)."""
    h = {**base, "hotel_name": info.get("hotel_name", base.get("hotel_name"))}
    if info.get("rating") is not None:
        h["star_rating"] = info["rating"]
    addr = ", ".join(p for p in (info.get("hotel_address"), info.get("hotel_city_name"),
                                 info.get("hotel_state")) if p)
    if addr:
        h["address"] = addr
    if info.get("hotel_description"):
        h["description"] = _strip_html(info["hotel_description"])
    if info.get("images"):
        h["gallery"] = info["images"]
    if info.get("facilities"):
        # Prefer the API's own per-facility PNG icon (specific + correct for all 52);
        # keep the keyword→SVG mapping as a fallback for when no icon URL is present.
        h["amenities"] = [{"label": f["name"], "icon": _facility_icon(f["name"]),
                           "icon_url": f.get("icon"), "available": True}
                          for f in info["facilities"] if f.get("name")]
    if info.get("attraction"):
        h["nearby"] = [{"label": a["name"], "distance": a.get("distance")}
                       for a in info["attraction"] if a.get("name")]
    if info.get("starting_price") is not None:
        h["price_from"] = info["starting_price"]
    lat, lng = info.get("hotel_loc_lat"), info.get("hotel_loc_long")
    if lat and lng and GOOGLE_MAPS_API_KEY:
        # Static map centered on the hotel; the widget overlays its own pin at center.
        h["map_image"] = (f"https://maps.googleapis.com/maps/api/staticmap?center={lat},{lng}"
                          f"&zoom=15&size=640x160&scale=2&key={GOOGLE_MAPS_API_KEY}")
    policies = {k: v[:5] for k, v in (("check_in", info.get("checkintime")),
                                      ("check_out", info.get("checkouttime"))) if v}
    if policies:
        h["policies"] = policies
    return h


async def _enhancements(hotel_id: str, check_in: date, check_out: date, guests: int) -> list[dict]:
    """Add-on extras from /enchance-stay, shaped for the enhance-stay step."""
    raw = await _api("POST", "/enchance-stay", _stay_body(hotel_id, check_in, check_out, guests))
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return []
    items = data if isinstance(data, list) else data.get("data") or data.get("enhancements") or []
    return [{"id": e.get("enhance_stay_id"), "name": e.get("title"), "image": e.get("image"),
             "price": e.get("end_price"), "original_price": e.get("original_price")}
            for e in items if isinstance(e, dict) and e.get("title")]


async def _api(method: str, path: str, json_body: dict | None = None) -> str:
    # passthrough — returns the backend's JSON verbatim.
    try:
        async with httpx.AsyncClient(base_url=API_BASE_URL, timeout=20) as client:
            r = await client.request(method, path, json=json_body, headers={API_KEY_HEADER: API_KEY})
            r.raise_for_status()
            return r.text
    except httpx.HTTPError as exc:
        return _err(f"Upstream API error: {exc}")


def _transport_security_kwargs() -> dict:
    """Allow the public Host when hosted behind a tunnel/proxy. Default (no env) keeps
    the SDK's DNS-rebinding protection on, localhost-only — unchanged for local dev."""
    if not MCP_ALLOWED_HOSTS:
        return {}
    from mcp.server.transport_security import TransportSecuritySettings
    if "*" in MCP_ALLOWED_HOSTS:
        logger.warning("DNS-rebinding protection DISABLED (MCP_ALLOWED_HOSTS=*) — only behind a trusted proxy/tunnel")
        return {"transport_security": TransportSecuritySettings(enable_dns_rebinding_protection=False)}
    origins = [f"https://{h}" for h in MCP_ALLOWED_HOSTS]
    logger.info("Allowed hosts=%s origins=%s", MCP_ALLOWED_HOSTS, origins)
    return {"transport_security": TransportSecuritySettings(allowed_hosts=MCP_ALLOWED_HOSTS, allowed_origins=origins)}


# ---------------------------------------------------------------------------
# MCP server
# ---------------------------------------------------------------------------
mcp = FastMCP(
    HOTEL_NAME,
    instructions=(
        f"You are a hotel concierge for {HOTEL_NAME} properties in {HOTEL_LOCATION}. "
        f"For a general or location search (e.g. 'hotels in {HOTEL_LOCATION}'), use search_hotels "
        "— it renders a carousel of hotel cards. For a specific named hotel's full "
        "details, use get_hotel_details; it renders a details card with a 'View rooms' "
        "button. Use check_availability to see room types and rates for specific dates. "
        "For bundle deals, use check_packages then check_room_packages. "
        "Use list_nationalities to resolve the guest's nationality code. "
        "Once the user picks one or more rooms and provides guest details (name, "
        "email, phone, nationality), use create_order to place the booking — it takes a "
        "list of rooms with quantities plus optional add-ons. The "
        "booking result renders a 'Complete payment' button in the widget — tell the "
        "user to tap it. NEVER write the payment URL as text; retyping its token "
        "corrupts the link and breaks checkout."
    ),
    **_transport_security_kwargs(),
)


# ---------------------------------------------------------------------------
# Widgets (Apps SDK UI rendered inside ChatGPT)
# ---------------------------------------------------------------------------

@mcp.resource(_widget_uri("hotel-list"), mime_type=WIDGET_MIME, meta=_widget_meta("hotel-list"))
def hotel_list_widget() -> str:
    """HTML shell for the hotel-list widget (rendered by search_hotels)."""
    return _widget_html("hotel-list")


@mcp.resource(_widget_uri("room-results"), mime_type=WIDGET_MIME, meta=_widget_meta("room-results"))
def room_results_widget() -> str:
    """HTML shell for the room-results widget (rendered by check_availability)."""
    return _widget_html("room-results")


@mcp.resource(_widget_uri("hotel-details"), mime_type=WIDGET_MIME, meta=_widget_meta("hotel-details"))
def hotel_details_widget() -> str:
    """HTML shell for the hotel-details widget (rendered by search_hotels)."""
    return _widget_html("hotel-details")


@mcp.resource(_widget_uri("checkout"), mime_type=WIDGET_MIME, meta=_widget_meta("checkout"))
def checkout_widget() -> str:
    """HTML shell for the checkout widget (rendered by create_order)."""
    return _widget_html("checkout")


# ChatGPT reads a widget's CSP/domain config from the resource *template*, not the
# concrete resource. FastMCP only auto-creates templates for parameterized URIs, so
# register each static widget as a template explicitly (mirrors the pizzaz example).
import mcp.types as _types  # noqa: E402


@mcp._mcp_server.list_resource_templates()
async def _list_widget_templates() -> list[_types.ResourceTemplate]:
    return [
        _types.ResourceTemplate(
            uriTemplate=_widget_uri(name),
            name=name,
            title=name.replace("-", " ").title(),
            mimeType=WIDGET_MIME,
            _meta={**_widget_meta(name), "openai/outputTemplate": _widget_uri(name)},
        )
        for name in WIDGETS
    ]


# ---------------------------------------------------------------------------
# Tools
# ---------------------------------------------------------------------------

@mcp.tool(
    meta={
        "openai/outputTemplate": _widget_uri("hotel-list"),
        "openai/toolInvocation/invoking": "Searching hotels…",
        "openai/toolInvocation/invoked": "Found hotels",
        "openai/widgetAccessible": True,
    },
    annotations={"readOnlyHint": True},
    structured_output=True,
)
async def search_hotels(location: str) -> dict[str, Any]:
    """
    Find Grand Alaric properties matching a location and show them as a card carousel.

    Use this for general/location searches (e.g. "hotels in Bandung"). Each card has a
    'Hotel Details' link and a 'View Rooms' button. For a single named hotel's full
    details card, call get_hotel_details instead.

    Args:
        location: City, area, or keyword (e.g. 'Bandung', 'Dago', 'Indonesia').
    """
    logger.info("search_hotels location=%r", location)
    raw = await _api("GET", "/hotels")
    try:
        result = json.loads(raw)  # {"success": ..., "hotels": [...]} → structuredContent
    except json.JSONDecodeError:
        return {"error": raw}
    # Keep hotels matching the location (name or id, case-insensitive); else show all.
    needle = location.lower()
    hotels = result.get("hotels", [])
    matches = [h for h in hotels
               if needle in h.get("hotel_name", "").lower() or needle in h.get("hotel_id", "").lower()] or hotels
    result["hotels"] = [_list_item(h) for h in matches]
    result["query"] = {"location": location}
    return result


@mcp.tool(
    meta={
        "openai/outputTemplate": _widget_uri("hotel-details"),
        "openai/toolInvocation/invoking": "Loading hotel details…",
        "openai/toolInvocation/invoked": "Loaded hotel details",
        "openai/widgetAccessible": True,
    },
    annotations={"readOnlyHint": True},
    structured_output=True,
)
async def get_hotel_details(hotel_id: str) -> dict[str, Any]:
    """
    Show the full details card for one hotel (gallery, rating, description, amenities,
    location/map, policies) with a 'View rooms' button. Use when the user asks about a
    specific property, or taps 'Hotel Details' on a hotel-list card.

    Args:
        hotel_id: Property ID from search_hotels (e.g. 'GSV').
    """
    logger.info("get_hotel_details hotel_id=%r", hotel_id)
    info_raw = await _api("POST", "/hotel/info", {"id": hotel_id.lower()})
    try:
        info = json.loads(info_raw)
    except json.JSONDecodeError:
        return {"error": info_raw}
    detail = info.get("hotel") if isinstance(info, dict) else None
    if not isinstance(detail, dict):
        return {"error": "Hotel not found."}
    return {"hotel": _normalize_hotel({"hotel_id": hotel_id.upper()}, detail)}


@mcp.tool(
    meta={
        "openai/outputTemplate": "ui://widget/room-results.html",
        "openai/toolInvocation/invoking": "Checking availability…",
        "openai/toolInvocation/invoked": "Found available rooms",
        "openai/widgetAccessible": True,
    },
    annotations={"readOnlyHint": True},
    structured_output=True,
)
async def check_availability(
    hotel_id: str,
    check_in_date: str,
    check_out_date: str,
    guests: int = 2,
) -> dict[str, Any]:
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
        return {"error": str(exc)}

    logger.info("check_availability hotel=%s %s→%s guests=%d", hotel_id, check_in_date, check_out_date, guests)
    raw = await _api("POST", "/rooms", _stay_body(hotel_id, check_in, check_out, guests))
    try:
        result = json.loads(raw)  # {"success": ..., "rooms": [...]} → structuredContent
    except json.JSONDecodeError:
        return {"error": raw}
    # /rooms returns rooms already grouped by type, each with nested rates. Reshape the
    # field names to what the room widget reads (meal/conditions/benefits come straight
    # from the API now — no deriving from room_id).
    result["rooms"] = [{
        "name": room.get("room_name"),
        "images": room.get("room_images") or [],
        "image": (room.get("room_images") or [None])[0],
        "description": _strip_html(room.get("room_desc", "")),
        "meta": room.get("room_info"),
        "available": room.get("room_available"),  # max bookable of this room type (cart qty cap)
        "rates": [{
            "room_id": rt.get("room_rate_id"),
            "room_name_sub": rt.get("room_rate"),
            "meal": rt.get("breakfast"),
            "conditions": rt.get("cancellation_info") or [],
            "benefits": (rt.get("benefit") or {}).get("data") or [],
            "price": rt.get("price"),
            "original_price": rt.get("original_price"),
        } for rt in room.get("rates", [])],
    } for room in result.get("rooms", []) if room.get("rates")]  # skip unbookable (no-rate) rooms
    # add-ons for the "enhance your stay" step, and echo the query so the widget/model
    # can build an unambiguous booking message (the API response omits these).
    result["extras"] = await _enhancements(hotel_id, check_in, check_out, guests)
    result["query"] = {"hotel_id": hotel_id, "check_in": check_in.isoformat(),
                       "check_out": check_out.isoformat(), "guests": guests}
    return result


@mcp.tool(annotations={"readOnlyHint": True})
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


@mcp.tool(annotations={"readOnlyHint": True})
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


@mcp.tool(annotations={"readOnlyHint": True}, structured_output=True)
async def list_nationalities() -> dict[str, Any]:
    """List valid nationality codes and phone codes (for create_order and the guest form)."""
    logger.info("list_nationalities")
    raw = await _api("GET", "/nationality")
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return {"error": raw}
    # The backend nests the list under "hotels" (a quirk) and uses nation_name/country_name/
    # phone_code. Normalize to stable widget keys {code, name, phone_code} so the guest form
    # reads it the same regardless of upstream field names.
    items = data if isinstance(data, list) else (
        data.get("nationalities") or data.get("hotels") or data.get("data") or data.get("list") or [])
    nationalities = [
        {"code": code,
         "name": it.get("country_name") or it.get("nation_name") or code,
         "phone_code": it.get("phone_code") or it.get("phonecode") or it.get("calling_code")}
        for it in items if isinstance(it, dict) and (code := it.get("nation_code") or it.get("code"))
    ]
    return {"nationalities": nationalities}


@mcp.tool(
    meta={
        "openai/outputTemplate": _widget_uri("checkout"),
        "openai/toolInvocation/invoking": "Placing your booking…",
        "openai/toolInvocation/invoked": "Booking created",
        "openai/widgetAccessible": True,
    },
    annotations={"readOnlyHint": False, "destructiveHint": False, "openWorldHint": True},
    structured_output=True,
)
async def create_order(
    hotel_id: str,
    check_in_date: str,
    check_out_date: str,
    guest_name: str,
    guest_email: str,
    guest_phone: str,
    rooms: list[dict] | None = None,
    enhance_stay: list[dict] | None = None,
    room_id: str = "",
    nation_code: str = "id",
    salutation: int = 3,
    guests: int = 2,
    promocode: str = "",
) -> dict[str, Any]:
    """
    Place a reservation via the cart API. Supports multiple room types and quantities
    plus optional add-ons. Call ONLY after the user has confirmed the rooms and all
    guest details.

    IMPORTANT: the response contains a payment URL with a long signed token. DO NOT
    write, paste, or retype that URL in your reply — retyping corrupts the token and
    breaks checkout. The link is rendered as a "Complete payment" button in the widget;
    simply tell the user to tap that button to pay.

    Args:
        hotel_id: Property ID from search_hotels (e.g. 'GSV').
        check_in_date: Check-in date in YYYY-MM-DD format.
        check_out_date: Check-out date in YYYY-MM-DD format.
        guest_name: Full name of the primary guest.
        guest_email: Guest email for the booking confirmation.
        guest_phone: Guest phone number (e.g. '+6282214171060').
        rooms: Rooms to book, each {"room_rate_id": <id from check_availability>, "qty": <int>}.
            Quantity per room type must not exceed that room's `available` count.
        enhance_stay: Optional add-ons, each {"ehance_stay_id": <id from check_availability
            extras>, "qty": <int>, "notes": <str>}.
        room_id: Back-compat shortcut to book a single room (qty 1) when `rooms` is omitted.
        nation_code: Guest nationality code from list_nationalities (e.g. 'id', 'ae').
        salutation: Salutation code as defined by the API (e.g. 3).
        guests: Number of adult guests.
        promocode: Optional promo code.
    """
    try:
        check_in, check_out = _stay_dates(check_in_date, check_out_date)
    except ValueError as exc:
        return {"error": str(exc)}

    # Build the cart. Accept a list of {room_rate_id, qty}; fall back to a single room_id.
    cart_rooms = []
    for r in rooms or []:
        if isinstance(r, dict) and (rid := r.get("room_rate_id") or r.get("room_id")):
            cart_rooms.append({"room_rate_id": rid, "qty": max(1, int(r.get("qty") or 1))})
    if not cart_rooms and room_id:
        cart_rooms.append({"room_rate_id": room_id, "qty": 1})
    if not cart_rooms:
        return {"error": 'Provide at least one room in `rooms`, e.g. [{"room_rate_id": "SUPK-IWS312ROO", "qty": 1}].'}

    cart: dict[str, Any] = {"rooms": cart_rooms}
    cart_extras = []
    for e in enhance_stay or []:
        # note the backend's misspelling: "ehance_stay_id"
        if isinstance(e, dict) and (eid := e.get("ehance_stay_id") or e.get("enhance_stay_id") or e.get("id")):
            cart_extras.append({"ehance_stay_id": str(eid), "notes": e.get("notes") or "",
                                "qty": max(1, int(e.get("qty") or 1))})
    if cart_extras:
        cart["enhance_stay"] = cart_extras

    order = _stay_body(hotel_id, check_in, check_out, guests, cart=cart, promocode=promocode,
                       guest={"salutation": salutation, "nation_code": nation_code,
                              "name": guest_name, "phone": guest_phone, "email": guest_email})
    logger.info("create_order hotel=%s rooms=%s extras=%d guest=%r", hotel_id, cart_rooms, len(cart_extras), guest_name)
    raw = await _api("POST", "/orders", order)
    try:
        result = json.loads(raw)  # {"success", "tracking_id", "url"} → structuredContent
    except json.JSONDecodeError:
        return {"error": raw}
    # Surface the backend's own validation/limit message (e.g. "Cart is required") to the widget.
    if isinstance(result, dict) and result.get("success") is False and not result.get("error"):
        result["error"] = result.get("message") or "Booking failed. Please review your selection."
    # echo booking essentials so the widget can show a summary (the API response omits them)
    result["booking"] = {"hotel_id": hotel_id, "check_in": check_in.isoformat(),
                         "check_out": check_out.isoformat(), "guest_name": guest_name}
    return result


if __name__ == "__main__":
    transport = os.getenv("MCP_TRANSPORT", "stdio")
    mcp.settings.host = os.getenv("HOST", "127.0.0.1")  # set 0.0.0.0 when hosting
    mcp.settings.port = int(os.getenv("PORT", "8000"))  # host/port only used by sse/http transports
    # note: endpoint unauthenticated; put a gateway/token in front if exposed beyond a trusted network.
    logger.info("Starting Grand Alaric MCP — transport=%s host=%s port=%d", transport, mcp.settings.host, mcp.settings.port)
    mcp.run(transport=transport)
