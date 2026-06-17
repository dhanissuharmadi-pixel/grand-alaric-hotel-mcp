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
API_KEY = os.getenv("GRAND_ALARIC_API_KEY", "")                             # TODO: set in prod env

# ---------------------------------------------------------------------------
# Mock data — swap these out once the real API is ready
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
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError:
        raise ValueError(f"'{field}' must be YYYY-MM-DD, got: '{value}'")


def _get_property(hotel_id: str) -> dict | None:
    return next((p for p in _MOCK_PROPERTIES if p["id"] == hotel_id), None)


def _err(msg: str) -> str:
    return json.dumps({"error": msg}, indent=2)


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
    loc = location.strip().lower()
    keywords = ["bandung", "indonesia", "dago", "tubagus", "alaric", "hotel", "stay", "room"]

    if not any(kw in loc for kw in keywords):
        return json.dumps({
            "found": False,
            "message": f"Grand Alaric operates in Bandung, Indonesia. No properties match '{location}'.",
        }, indent=2)

    logger.info("search_hotels location=%r", location)

    # TODO: replace with real API call
    # async with httpx.AsyncClient() as client:
    #     r = await client.get(
    #         f"{API_BASE_URL}/properties",
    #         headers={"Authorization": f"Bearer {API_KEY}"},
    #         params={"location": location},
    #         timeout=10,
    #     )
    #     r.raise_for_status()
    #     return r.text

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
        check_in_date: Check-in date in YYYY-MM-DD format.
        check_out_date: Check-out date in YYYY-MM-DD format.
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

    prop = _get_property(hotel_id)
    if not prop:
        return _err(f"No property found with id '{hotel_id}'.")

    nights = (check_out - check_in).days
    logger.info("check_availability hotel=%s %s→%s (%d nights, %d guests)", hotel_id, check_in_date, check_out_date, nights, guests)

    # TODO: replace with real availability API call
    # async with httpx.AsyncClient() as client:
    #     r = await client.get(
    #         f"{API_BASE_URL}/properties/{hotel_id}/availability",
    #         headers={"Authorization": f"Bearer {API_KEY}"},
    #         params={"check_in": check_in_date, "check_out": check_out_date, "guests": guests},
    #         timeout=10,
    #     )
    #     r.raise_for_status()
    #     return r.text

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
        check_in_date: Check-in date in YYYY-MM-DD format.
        check_out_date: Check-out date in YYYY-MM-DD format.
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

    prop = _get_property(hotel_id)
    if not prop:
        return _err(f"No property found with id '{hotel_id}'.")

    room = next((r for r in _MOCK_ROOM_TYPES.get(hotel_id, []) if r["id"] == room_type_id), None)
    if not room:
        return _err(f"Room type '{room_type_id}' not found at {prop['name']}.")
    if not room["available"]:
        return _err(f"'{room['name']}' is not available for the selected dates.")

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
    port = int(os.getenv("PORT", "8000"))
    logger.info("Starting Grand Alaric MCP — transport=%s port=%d", transport, port)
    mcp.run(transport=transport)
