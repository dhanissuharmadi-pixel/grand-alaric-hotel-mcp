from openai import AsyncOpenAI
import asyncio
import json
import os

from server import cancel_booking, check_availability, create_booking, get_booking, search_hotels

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY", ""))  # TODO: set OPENAI_API_KEY in env
MODEL = os.getenv("OPENAI_MODEL", "gpt-4o")

# ---------------------------------------------------------------------------
# OpenAI tool schemas — mirror of the MCP tools in server.py
# ---------------------------------------------------------------------------
TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "search_hotels",
            "description": "Find Grand Alaric properties matching the given location query.",
            "parameters": {
                "type": "object",
                "properties": {
                    "location": {
                        "type": "string",
                        "description": "City, area, or keyword (e.g. 'Bandung', 'Dago', 'Indonesia').",
                    }
                },
                "required": ["location"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "check_availability",
            "description": "Return available room types and rates for a hotel and date range.",
            "parameters": {
                "type": "object",
                "properties": {
                    "hotel_id": {
                        "type": "string",
                        "description": "Property ID from search_hotels (e.g. 'GAH-BDG-001').",
                    },
                    "check_in_date": {
                        "type": "string",
                        "description": "Check-in date in YYYY-MM-DD format.",
                    },
                    "check_out_date": {
                        "type": "string",
                        "description": "Check-out date in YYYY-MM-DD format.",
                    },
                    "guests": {
                        "type": "integer",
                        "description": "Number of guests (default 2).",
                        "default": 2,
                    },
                },
                "required": ["hotel_id", "check_in_date", "check_out_date"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_booking",
            "description": (
                "Submit a room reservation. "
                "Call ONLY after the user has explicitly confirmed all details."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "hotel_id": {
                        "type": "string",
                        "description": "Property ID (e.g. 'GAH-BDG-001').",
                    },
                    "room_type_id": {
                        "type": "string",
                        "description": "Room type ID from check_availability (e.g. 'std', 'dlx').",
                    },
                    "guest_name": {
                        "type": "string",
                        "description": "Full legal name of the primary guest.",
                    },
                    "guest_email": {
                        "type": "string",
                        "description": "Guest contact email for the booking confirmation.",
                    },
                    "check_in_date": {
                        "type": "string",
                        "description": "Check-in date in YYYY-MM-DD format.",
                    },
                    "check_out_date": {
                        "type": "string",
                        "description": "Check-out date in YYYY-MM-DD format.",
                    },
                    "guests": {
                        "type": "integer",
                        "description": "Number of guests.",
                        "default": 2,
                    },
                    "special_requests": {
                        "type": "string",
                        "description": "Optional dietary, accessibility, or bed preference notes.",
                    },
                },
                "required": [
                    "hotel_id",
                    "room_type_id",
                    "guest_name",
                    "guest_email",
                    "check_in_date",
                    "check_out_date",
                ],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_booking",
            "description": "Retrieve details for an existing reservation.",
            "parameters": {
                "type": "object",
                "properties": {
                    "booking_reference": {
                        "type": "string",
                        "description": "The reference number from create_booking (e.g. 'GA-A1B2C3').",
                    }
                },
                "required": ["booking_reference"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "cancel_booking",
            "description": "Cancel an existing reservation.",
            "parameters": {
                "type": "object",
                "properties": {
                    "booking_reference": {
                        "type": "string",
                        "description": "The reference number to cancel (e.g. 'GA-A1B2C3').",
                    },
                    "reason": {
                        "type": "string",
                        "description": "Optional cancellation reason.",
                    },
                },
                "required": ["booking_reference"],
            },
        },
    },
]

# ---------------------------------------------------------------------------
# Dispatcher — routes OpenAI tool calls to the actual tool functions
# ---------------------------------------------------------------------------
_REGISTRY = {
    "search_hotels": search_hotels,
    "check_availability": check_availability,
    "create_booking": create_booking,
    "get_booking": get_booking,
    "cancel_booking": cancel_booking,
}


async def dispatch_tool(name: str, args: dict) -> str:
    fn = _REGISTRY.get(name)
    if not fn:
        return json.dumps({"error": f"Unknown tool: '{name}'"})
    return await fn(**args)


# ---------------------------------------------------------------------------
# System prompt
# ---------------------------------------------------------------------------
SYSTEM_PROMPT = (
    "You are a hotel concierge for Grand Alaric properties in Bandung, Indonesia. "
    "Use search_hotels to find properties by location. "
    "Use check_availability to see room types and rates for specific dates. "
    "Use create_booking ONLY after the user has explicitly confirmed every detail. "
    "Use get_booking to look up an existing reservation by reference number. "
    "Use cancel_booking to cancel a reservation. "
    "Always summarise and confirm full booking details with the user before calling create_booking."
)

# ---------------------------------------------------------------------------
# Chat loop — for CLI usage / testing
# ---------------------------------------------------------------------------
async def run_chat() -> None:
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    print("Grand Alaric Hotel Assistant  |  type 'quit' to exit\n")

    while True:
        user_input = input("You: ").strip()
        if user_input.lower() in ("quit", "exit"):
            break
        if not user_input:
            continue

        messages.append({"role": "user", "content": user_input})

        while True:
            response = await client.chat.completions.create(
                model=MODEL,
                messages=messages,
                tools=TOOLS,
                tool_choice="auto",
            )

            message = response.choices[0].message
            messages.append(message)

            if not message.tool_calls:
                print(f"\nAssistant: {message.content}\n")
                break

            for tool_call in message.tool_calls:
                name = tool_call.function.name
                args = json.loads(tool_call.function.arguments)
                result = await dispatch_tool(name, args)

                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": result,
                })


# ---------------------------------------------------------------------------
# Single-turn helper — use this when embedding in an API / webhook
# ---------------------------------------------------------------------------
async def ask(user_message: str, history: list[dict] | None = None) -> tuple[str, list[dict]]:
    """
    Single-turn interface for embedding in a FastAPI route or similar.

    Returns (assistant_reply, updated_history).

    Usage:
        reply, history = await ask("I want to book a room in Bandung", history=[])
    """
    messages = [{"role": "system", "content": SYSTEM_PROMPT}] + (history or [])
    messages.append({"role": "user", "content": user_message})

    while True:
        response = await client.chat.completions.create(
            model=MODEL,
            messages=messages,
            tools=TOOLS,
            tool_choice="auto",
        )

        message = response.choices[0].message
        messages.append(message)

        if not message.tool_calls:
            history_out = messages[1:]  # strip system prompt before returning
            return message.content, history_out

        for tool_call in message.tool_calls:
            name = tool_call.function.name
            args = json.loads(tool_call.function.arguments)
            result = await dispatch_tool(name, args)

            messages.append({
                "role": "tool",
                "tool_call_id": tool_call.id,
                "content": result,
            })


if __name__ == "__main__":
    asyncio.run(run_chat())
