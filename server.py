from mcp.server.fastmcp import FastMCP
import httpx
import json
import logging
import os
from datetime import date, datetime
from urllib.parse import urlencode

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("grand-alaric-mcp")

# ---------------------------------------------------------------------------
# Config — set these in your environment before going live
# ---------------------------------------------------------------------------
BOOKING_BASE_URL = os.getenv("BOOKING_BASE_URL", "https://booking.grandalaric.com/en")
API_BASE_URL = os.getenv("API_BASE_URL", "https://api.grandalaric.com/v1")  # TODO: confirm with backend
API_KEY = os.getenv("GRAND_ALARIC_API_KEY", "")

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


async def _api_get(path: str, params: dict) -> str:
    # ponytail: passthrough — returns the backend's JSON verbatim. Add field
    # mapping here only if a tool's shape must differ from the backend's.
    try:
        async with httpx.AsyncClient(base_url=API_BASE_URL, timeout=10) as client:
            r = await client.get(path, params=params, headers={"Authorization": f"Bearer {API_KEY}"})
            r.raise_for_status()
            return r.text
    except httpx.HTTPError as exc:
        return _err(f"Upstream API error: {exc}")


# ---------------------------------------------------------------------------
# MCP server
# ---------------------------------------------------------------------------
mcp = FastMCP(
    "Grand Alaric Hotel Assistant",
    instructions=(
        "You are a hotel concierge for Grand Alaric properties in Bandung, Indonesia. "
        "Use search_hotels to find properties by location. "
        "Use check_availability to see room types and rates for specific dates. "
        "Once the user picks a room and confirms the dates, use get_checkout_link "
        "to give them a checkout URL — they complete payment and confirmation there."
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
        return await _api_get("/properties", {"location": location})  # ponytail: path assumed; confirm when contract lands

    # Mock: gate to the demo's only region so off-topic queries return cleanly.
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
        check_in = _validate_date(check_in_date, "check_in_date")
        check_out = _validate_date(check_out_date, "check_out_date")
    except ValueError as exc:
        return _err(str(exc))

    if check_out <= check_in:
        return _err("check_out_date must be after check_in_date.")
    if check_in < date.today():
        return _err("check_in_date cannot be in the past.")

    nights = (check_out - check_in).days
    logger.info("check_availability hotel=%s %s→%s (%d nights, %d guests) live=%s", hotel_id, check_in_date, check_out_date, nights, guests, _LIVE)

    if _LIVE:
        return await _api_get(  # ponytail: path assumed; confirm when contract lands
            f"/properties/{hotel_id}/availability",
            {"check_in": check_in_date, "check_out": check_out_date, "guests": guests},
        )

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
async def get_checkout_link(
    hotel_id: str,
    room_type_id: str,
    check_in_date: str,
    check_out_date: str,
    guests: int = 2,
) -> str:
    """
    Build a checkout URL for the chosen room. Send the user here to enter their
    details and pay — booking, confirmation, and cancellation happen on that page.

    Args:
        hotel_id: Property ID (e.g. 'GAH-BDG-001').
        room_type_id: Room type ID from check_availability (e.g. 'std', 'dlx').
        check_in_date: Check-in date in DD-MM-YYYY format.
        check_out_date: Check-out date in DD-MM-YYYY format.
        guests: Number of guests.
    """
    try:
        check_in = _validate_date(check_in_date, "check_in_date")
        check_out = _validate_date(check_out_date, "check_out_date")
    except ValueError as exc:
        return _err(str(exc))

    if check_out <= check_in:
        return _err("check_out_date must be after check_in_date.")
    if check_in < date.today():
        return _err("check_in_date cannot be in the past.")

    nights = (check_out - check_in).days
    params = urlencode({
        "hotel": hotel_id,
        "room": room_type_id,
        "check_in": check_in_date,
        "check_out": check_out_date,
        "guests": guests,
    })
    checkout_url = f"{BOOKING_BASE_URL}/checkout?{params}"
    logger.info("get_checkout_link hotel=%s room=%s -> %s", hotel_id, room_type_id, checkout_url)

    # Live: the checkout page validates the room and prices it; just hand over the link.
    if _LIVE:
        return json.dumps({"checkout_url": checkout_url}, indent=2)

    prop = _get_property(hotel_id)
    if not prop:
        return _err(f"No property found with id '{hotel_id}'.")
    room = next((r for r in _MOCK_ROOM_TYPES.get(hotel_id, []) if r["id"] == room_type_id), None)
    if not room:
        return _err(f"Room type '{room_type_id}' not found at {prop['name']}.")
    if not room["available"]:
        return _err(f"'{room['name']}' is not available for the selected dates.")

    return json.dumps({
        "checkout_url": checkout_url,
        "hotel": prop["name"],
        "room": room["name"],
        "nights": nights,
        "guests": guests,
        "rate_per_night_idr": room["rate_per_night_idr"],
        "total_idr": room["rate_per_night_idr"] * nights,
        "currency": "IDR",
    }, indent=2)


if __name__ == "__main__":
    transport = os.getenv("MCP_TRANSPORT", "stdio")
    mcp.settings.host = os.getenv("HOST", "127.0.0.1")  # set 0.0.0.0 when hosting
    mcp.settings.port = int(os.getenv("PORT", "8000"))  # host/port only used by sse/http transports
    # ponytail: endpoint unauthenticated; put a gateway/token in front if exposed beyond a trusted network.
    logger.info("Starting Grand Alaric MCP — transport=%s host=%s port=%d live=%s", transport, mcp.settings.host, mcp.settings.port, _LIVE)
    mcp.run(transport=transport)

