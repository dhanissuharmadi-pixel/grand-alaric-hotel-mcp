from mcp.server.fastmcp import FastMCP
import httpx
import json
import logging
import os
from datetime import date, datetime

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("grand-alaric-mcp")

# ---------------------------------------------------------------------------
# Config — set these in your environment before going live
# ---------------------------------------------------------------------------
BOOKING_BASE_URL = os.getenv("BOOKING_BASE_URL", "https://booking.grandalaric.com/en")
API_BASE_URL = os.getenv("API_BASE_URL", "https://api6.alarichotels.com/webapi/chatgpt")
API_KEY = os.getenv("GRAND_ALARIC_API_KEY", "")
API_KEY_HEADER = "phm-chat-api-key"

# Live backend is used automatically when an API key is present; otherwise the
# mock data below is served. To point at another site: set API_BASE_URL,
# BOOKING_BASE_URL and the key env var — no code change.
_LIVE = bool(API_KEY)

# ---------------------------------------------------------------------------
# Mock data — only served when no API key is set
# ---------------------------------------------------------------------------
_MOCK_PROPERTIES = [
    {
        "id": "GAH-BDG-001",
        "name": "Grand Alaric Hotel Bandung",
        "location": "Dago, Bandung, Indonesia",
        "address": "Jl. Ir. H. Juanda No.1, Dago, Coblong, Bandung 40132",
        "highlights": ["Beach Front Resort style", "Tripadvisor Traveler's Choice", "Freshly Built"],
        "amenities": ["Pool", "Spa", "Restaurant", "Free WiFi", "Parking"],
        "check_in_time": "14:00",
        "check_out_time": "12:00",
        "contact_email": "reservations@grandalaric.com",
        "contact_phone": "+62-22-1234567",
        "booking_url": BOOKING_BASE_URL,
    },
    {
        "id": "TBG-BDG-002",
        "name": "Tubagus Hotel Bandung",
        "location": "Coblong, Bandung, Indonesia",
        "address": "Jl. Tubagus Ismail Raya No.5, Coblong, Bandung 40134",
        "highlights": ["Modern comfort for business and leisure", "Spacious Family, Girls, and Bridal Rooms"],
        "amenities": ["Restaurant", "Free WiFi", "Business Center"],
        "check_in_time": "14:00",
        "check_out_time": "12:00",
        "contact_email": "reservations@tubagus.com",
        "contact_phone": "+62-22-7654321",
        "booking_url": BOOKING_BASE_URL,
    },
]

_MOCK_ROOM_TYPES: dict[str, list[dict]] = {
    "GAH-BDG-001": [
        {"id": "std",   "name": "Standard Room",    "rate_per_night_idr": 140_000, "capacity": 2, "beds": "1 Queen", "available": True},
        {"id": "dlx",   "name": "Deluxe Room",      "rate_per_night_idr": 200_000, "capacity": 2, "beds": "1 King",  "available": True},
        {"id": "suite", "name": "Executive Suite",  "rate_per_night_idr": 350_000, "capacity": 4, "beds": "1 King + Sofa Bed", "available": False},
    ],
    "TBG-BDG-002": [
        {"id": "std", "name": "Standard Room", "rate_per_night_idr": 10_000, "capacity": 2, "beds": "1 Queen", "available": True},
        {"id": "dlx", "name": "Deluxe Room",   "rate_per_night_idr": 15_000, "capacity": 2, "beds": "1 King",  "available": True},
    ],
}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _validate_date(value: str, field: str) -> date:
    try:
        return datetime.strptime(value, "%d-%m-%Y").date()
    except ValueError:
        raise ValueError(f"'{field}' must be DD-MM-YYYY, got: '{value}'")


def _get_property(hotel_id: str) -> dict | None:
    return next((p for p in _MOCK_PROPERTIES if p["id"] == hotel_id), None)


def _err(msg: str) -> str:
    return json.dumps({"error": msg}, indent=2)


async def _api(method: str, path: str, json_body: dict | None = None) -> str:
    # note: passthrough — returns the backend's JSON verbatim.
    try:
        async with httpx.AsyncClient(base_url=API_BASE_URL, timeout=20) as client:
            r = await client.request(method, path, json=json_body, headers={API_KEY_HEADER: API_KEY})
            r.raise_for_status()
            return r.text
    except httpx.HTTPError as exc:
        return _err(f"Upstream API error: {exc}")


def _stay_dates(check_in_date: str, check_out_date: str) -> tuple[date, date]:
    """Validate a DD-MM-YYYY stay range. Raises ValueError on bad input."""
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
)


# ---------------------------------------------------------------------------
# Tools
# ---------------------------------------------------------------------------

@mcp.tool()
async def search_hotels(location: str) -> str:
    """
    Find Grand Alaric properties matching the given location query.

    Args:
        location: City, area, or keyword (e.g. 'Bandung', 'Dago', 'Indonesia').
    """
    logger.info("search_hotels location=%r live=%s", location, _LIVE)

    if _LIVE:
        return await _api("GET", "/hotels")  # API lists all properties; then picks by location

    # Mock: gate to the demo's only region so off-topic queries return clean.
    loc = location.strip().lower()
    keywords = ["bandung", "indonesia", "dago", "tubagus", "alaric", "hotel", "stay", "room"]
    if not any(kw in loc for kw in keywords):
        return json.dumps({
            "found": False,
            "message": f"Grand Alaric operates in Bandung, Indonesia. No properties match '{location}'.",
        }, indent=2)

    return json.dumps({"found": True, "properties": _MOCK_PROPERTIES}, indent=2)


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
        hotel_id: Property ID from search_hotels (e.g. 'GAH-BDG-001').
        check_in_date: Check-in date in DD-MM-YYYY format.
        check_out_date: Check-out date in DD-MM-YYYY format.
        guests: Number of guests (default 2).
    """
    try:
        check_in, check_out = _stay_dates(check_in_date, check_out_date)
    except ValueError as exc:
        return _err(str(exc))

    nights = (check_out - check_in).days
    logger.info("check_availability hotel=%s %s→%s (%d nights, %d guests) live=%s", hotel_id, check_in_date, check_out_date, nights, guests, _LIVE)

    if _LIVE:
        return await _api("POST", "/rooms", _stay_body(hotel_id, check_in, check_out, guests))

    prop = _get_property(hotel_id)
    if not prop:
        return _err(f"No property found with id '{hotel_id}'.")

    available_rooms = [
        {**room, "total_idr": room["rate_per_night_idr"] * nights}
        for room in _MOCK_ROOM_TYPES.get(hotel_id, [])
        if room["available"] and room["capacity"] >= guests
    ]

    return json.dumps({
        "hotel": prop["name"],
        "check_in": check_in_date,
        "check_out": check_out_date,
        "nights": nights,
        "guests": guests,
        "currency": "IDR",
        "available_rooms": available_rooms,
    }, indent=2)


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
        check_in_date: Check-in date in DD-MM-YYYY format.
        check_out_date: Check-out date in DD-MM-YYYY format.
        guests: Number of guests.
    """
    try:
        check_in, check_out = _stay_dates(check_in_date, check_out_date)
    except ValueError as exc:
        return _err(str(exc))

    logger.info("check_packages hotel=%s %s→%s live=%s", hotel_id, check_in_date, check_out_date, _LIVE)
    if _LIVE:
        return await _api("POST", "/package", _stay_body(hotel_id, check_in, check_out, guests))
    return _err("Packages require a live API key (no mock data).")


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
        check_in_date: Check-in date in DD-MM-YYYY format.
        check_out_date: Check-out date in DD-MM-YYYY format.
        package_code: Package code from check_packages (e.g. 'GNW').
        guests: Number of guests.
    """
    try:
        check_in, check_out = _stay_dates(check_in_date, check_out_date)
    except ValueError as exc:
        return _err(str(exc))

    logger.info("check_room_packages hotel=%s package=%s live=%s", hotel_id, package_code, _LIVE)
    if _LIVE:
        return await _api("POST", "/room-packages",
                          _stay_body(hotel_id, check_in, check_out, guests, package_code=package_code))
    return _err("Packages require a live API key (no mock data).")


@mcp.tool()
async def list_nationalities() -> str:
    """List valid nationality codes and phone codes for use in create_order."""
    logger.info("list_nationalities live=%s", _LIVE)
    if _LIVE:
        return await _api("GET", "/nationality")
    return json.dumps({"success": True, "hotels": [
        {"nation_code": "id", "nation_name": "Indonesian", "country_name": "Indonesia", "phone_code": "+62"},
    ]}, indent=2)


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
        check_in_date: Check-in date in DD-MM-YYYY format.
        check_out_date: Check-out date in DD-MM-YYYY format.
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
    logger.info("create_order hotel=%s room=%s package=%s guest=%r live=%s", hotel_id, room_id, package_id, guest_name, _LIVE)

    if _LIVE:
        # note: passthrough — the payment/confirmation link is in this response; exact field unverified.
        return await _api("POST", "/orders", order)

    # Mock: no real booking; echo a stub confirmation for the offline demo.
    return json.dumps({"success": True, "mock": True, "order": order,
                       "payment_url": f"{BOOKING_BASE_URL}/pay/MOCK123"}, indent=2)


if __name__ == "__main__":
    transport = os.getenv("MCP_TRANSPORT", "stdio")
    mcp.settings.host = os.getenv("HOST", "127.0.0.1")  # set 0.0.0.0 when hosting
    mcp.settings.port = int(os.getenv("PORT", "8000"))  # host/port only used by sse/http transports
    # nite: endpoint unauthenticated; put a gateway/token in front if exposed beyond a trusted network.
    logger.info("Starting Grand Alaric MCP — transport=%s host=%s port=%d live=%s", transport, mcp.settings.host, mcp.settings.port, _LIVE)
    mcp.run(transport=transport)
