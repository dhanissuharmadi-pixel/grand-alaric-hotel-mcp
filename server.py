from mcp.server.fastmcp import FastMCP
from typing import Optional
import httpx
import json
import logging
import os
import uuid
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

# In-memory booking store — replace with DB/API persistence in production
_SESSION_BOOKINGS: dict[str, dict] = {}

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
        "Use create_booking ONLY after the user explicitly confirms all details. "
        "Use get_booking to look up an existing reservation by reference number. "
        "Use cancel_booking to cancel a reservation. "
        "Always confirm full booking details with the user before calling create_booking."
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
async def create_booking(
    hotel_id: str,
    room_type_id: str,
    guest_name: str,
    guest_email: str,
    check_in_date: str,
    check_out_date: str,
    guests: int = 2,
    special_requests: Optional[str] = None,
) -> str:
    """
    Submit a room reservation. Call only after the user has confirmed all details.

    Args:
        hotel_id: Property ID (e.g. 'GAH-BDG-001').
        room_type_id: Room type ID from check_availability (e.g. 'std', 'dlx').
        guest_name: Full legal name of the primary guest.
        guest_email: Guest contact email for the confirmation.
        check_in_date: Check-in date in YYYY-MM-DD format.
        check_out_date: Check-out date in YYYY-MM-DD format.
        guests: Number of guests.
        special_requests: Optional dietary, accessibility, or bed preference notes.
    """
    try:
        check_in = _validate_date(check_in_date, "check_in_date")
        check_out = _validate_date(check_out_date, "check_out_date")
    except ValueError as exc:
        return _err(str(exc))

    if check_out <= check_in:
        return _err("check_out_date must be after check_in_date.")

    prop = _get_property(hotel_id)
    if not prop:
        return _err(f"No property found with id '{hotel_id}'.")

    room = next((r for r in _MOCK_ROOM_TYPES.get(hotel_id, []) if r["id"] == room_type_id), None)
    if not room:
        return _err(f"Room type '{room_type_id}' not found at {prop['name']}.")
    if not room["available"]:
        return _err(f"'{room['name']}' is not available for the selected dates.")

    nights = (check_out - check_in).days
    total_idr = room["rate_per_night_idr"] * nights

    # TODO: replace with real booking API call
    # payload = {
    #     "hotel_id": hotel_id, "room_type_id": room_type_id,
    #     "guest_name": guest_name, "guest_email": guest_email,
    #     "check_in": check_in_date, "check_out": check_out_date,
    #     "guests": guests, "special_requests": special_requests,
    # }
    # async with httpx.AsyncClient() as client:
    #     r = await client.post(
    #         f"{API_BASE_URL}/bookings",
    #         headers={"Authorization": f"Bearer {API_KEY}"},
    #         json=payload,
    #         timeout=15,
    #     )
    #     r.raise_for_status()
    #     return r.text

    ref = f"GA-{uuid.uuid4().hex[:6].upper()}"
    booking = {
        "reference": ref,
        "status": "confirmed",
        "hotel": prop["name"],
        "address": prop["address"],
        "room": room["name"],
        "beds": room["beds"],
        "guest_name": guest_name,
        "guest_email": guest_email,
        "check_in": check_in_date,
        "check_out": check_out_date,
        "check_in_time": prop["check_in_time"],
        "check_out_time": prop["check_out_time"],
        "nights": nights,
        "guests": guests,
        "rate_per_night_idr": room["rate_per_night_idr"],
        "total_idr": total_idr,
        "currency": "IDR",
        "special_requests": special_requests,
        "contact_email": prop["contact_email"],
        "contact_phone": prop["contact_phone"],
        "payment_url": f"{BOOKING_BASE_URL}/pay/{ref}",  # TODO: real payment gateway link
    }

    _SESSION_BOOKINGS[ref] = booking
    logger.info("create_booking ref=%s hotel=%s guest=%r", ref, hotel_id, guest_name)

    return json.dumps({"success": True, "booking": booking}, indent=2)


@mcp.tool()
async def get_booking(booking_reference: str) -> str:
    """
    Retrieve details for an existing reservation.

    Args:
        booking_reference: The reference number from create_booking (e.g. 'GA-A1B2C3').
    """
    ref = booking_reference.strip().upper()
    logger.info("get_booking ref=%s", ref)

    # TODO: replace with real API call
    # async with httpx.AsyncClient() as client:
    #     r = await client.get(
    #         f"{API_BASE_URL}/bookings/{ref}",
    #         headers={"Authorization": f"Bearer {API_KEY}"},
    #         timeout=10,
    #     )
    #     if r.status_code == 404:
    #         return _err(f"Booking '{ref}' not found.")
    #     r.raise_for_status()
    #     return r.text

    booking = _SESSION_BOOKINGS.get(ref)
    if not booking:
        return _err(f"Booking '{ref}' not found. (Mock mode: only bookings from this session are available.)")

    return json.dumps({"booking": booking}, indent=2)


@mcp.tool()
async def cancel_booking(booking_reference: str, reason: Optional[str] = None) -> str:
    """
    Cancel an existing reservation.

    Args:
        booking_reference: The reference number to cancel (e.g. 'GA-A1B2C3').
        reason: Optional cancellation reason.
    """
    ref = booking_reference.strip().upper()
    logger.info("cancel_booking ref=%s reason=%r", ref, reason)

    # TODO: replace with real API call
    # async with httpx.AsyncClient() as client:
    #     r = await client.post(
    #         f"{API_BASE_URL}/bookings/{ref}/cancel",
    #         headers={"Authorization": f"Bearer {API_KEY}"},
    #         json={"reason": reason},
    #         timeout=10,
    #     )
    #     if r.status_code == 404:
    #         return _err(f"Booking '{ref}' not found.")
    #     r.raise_for_status()
    #     return r.text

    booking = _SESSION_BOOKINGS.get(ref)
    if not booking:
        return _err(f"Booking '{ref}' not found.")
    if booking.get("status") == "cancelled":
        return _err(f"Booking '{ref}' is already cancelled.")

    _SESSION_BOOKINGS[ref]["status"] = "cancelled"
    _SESSION_BOOKINGS[ref]["cancellation_reason"] = reason

    return json.dumps({
        "success": True,
        "reference": ref,
        "status": "cancelled",
        "message": "Reservation cancelled. A confirmation will be sent to the registered email.",
    }, indent=2)


if __name__ == "__main__":
    transport = os.getenv("MCP_TRANSPORT", "stdio")
    port = int(os.getenv("PORT", "8000"))
    logger.info("Starting Grand Alaric MCP — transport=%s port=%d", transport, port)
    mcp.run(transport=transport)
