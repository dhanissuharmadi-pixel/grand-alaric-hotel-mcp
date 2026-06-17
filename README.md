# Grand Alaric Hotel MCP Server

An MCP server for Grand Alaric Hotel properties in Bandung, Indonesia.

## Tools

| Tool | Description |
|---|---|
| `search_hotels` | List Grand Alaric properties |
| `check_availability` | Get available rooms and prices for a hotel and date range |
| `check_packages` | List bookable packages (promo bundles) for a hotel and dates |
| `check_room_packages` | List rooms and prices within a specific package |
| `list_nationalities` | Valid nationality/phone codes for `create_order` |
| `create_order` | Place a room or package booking; returns a payment link |

Dates are entered as `DD-MM-YYYY`.

## Setup

**Requirements:** Python 3.13+, [uv](https://github.com/astral-sh/uv)

```bash
git clone https://github.com/dhanissuharmadi-pixel/grand-alaric-hotel-mcp
cd grand-alaric-hotel-mcp
uv sync
```

Set the API key (sent as the `phm-chat-api-key` header) — in your shell or a local `.env`:

```bash
export GRAND_ALARIC_API_KEY=your_api_key
```

`API_BASE_URL` defaults to the live PHM endpoint; override it only to point at a different backend.

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

### OpenAI / ChatGPT

`openai_agent.py` runs the tools through the OpenAI Agents SDK, which speaks MCP
natively — it spawns `server.py` and auto-discovers the tools, no schema copy.

```bash
export OPENAI_API_KEY=sk-...
.venv/bin/python openai_agent.py
```

### Remote / hosted

Serve over HTTP instead of stdio so remote clients can reach it:

```bash
MCP_TRANSPORT=streamable-http HOST=0.0.0.0 PORT=8000 .venv/bin/python server.py
# MCP endpoint: http://<host>:8000/mcp
```

Point the OpenAI agent at it with `MCP_URL`:

```bash
MCP_URL=http://<host>:8000/mcp OPENAI_API_KEY=sk-... .venv/bin/python openai_agent.py
```

Or skip the client entirely — ChatGPT calls the hosted server directly via the
Responses API:

```python
client.responses.create(
    model="gpt-4o",
    tools=[{"type": "mcp", "server_label": "grand-alaric", "server_url": "https://<host>/mcp"}],
    input="I want a room in Bandung 01-07-2026 to 03-07-2026",
)
```

The endpoint is unauthenticated — front it with your host's gateway/token if exposed beyond a trusted network.

## Status

Calls the live PHM API. Set `GRAND_ALARIC_API_KEY` (sent as `phm-chat-api-key`); override `API_BASE_URL` to point at a different backend.
