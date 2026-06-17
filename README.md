# Grand Alaric Hotel MCP Server

An MCP server for Grand Alaric Hotel properties in Bandung, Indonesia.

## Tools

| Tool | Description |
|---|---|
| `search_hotels` | Find properties by location |
| `check_availability` | Get available rooms and rates for a date range |
| `create_booking` | Submit a reservation |
| `get_booking` | Retrieve a booking by reference number |
| `cancel_booking` | Cancel an existing reservation |

## Setup

**Requirements:** Python 3.13+, [uv](https://github.com/astral-sh/uv)

```bash
git clone https://github.com/dhanissuharmadi-pixel/grand-alaric-hotel-mcp
cd grand-alaric-hotel-mcp
uv sync
```

Set environment variables:

```bash
export GRAND_ALARIC_API_KEY=your_api_key
export API_BASE_URL=https://api.grandalaric.com/v1
export BOOKING_BASE_URL=https://booking.grandalaric.com/en
```

## Usage

### Claude / MCP Inspector

```bash
npx @modelcontextprotocol/inspector .venv/bin/python server.py
```

Open the URL printed in the terminal to test tools interactively.

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "grand-alaric": {
      "command": "/path/to/.venv/bin/python",
      "args": ["/path/to/server.py"],
      "env": {
        "GRAND_ALARIC_API_KEY": "your_api_key"
      }
    }
  }
}
```

## Status

All tools run on mock data. To connect to the real API, replace the `# TODO: replace with real API call` blocks in `server.py` with live `httpx` requests.
