# Grand Alaric Hotel MCP Server

An MCP server for Grand Alaric Hotel properties in Bandung, Indonesia.

## Tools

| Tool | Description |
|---|---|
| `search_hotels` | List Grand Alaric properties |
| `get_hotel_details` | Full profile for one hotel (amenities, gallery, policies) |
| `check_availability` | Get available rooms and prices for a hotel and date range |
| `check_packages` | List bookable packages (promo bundles) for a hotel and dates |
| `check_room_packages` | List rooms and prices within a specific package |
| `list_nationalities` | Valid nationality/phone codes for `create_order` |
| `create_order` | Place a room or package booking; returns a payment link |
| `check_order_status` | Payment status for an order (the widget polls this) |

Dates are entered as `YYYY-MM-DD`.

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

### Remote / hosted

Serve over HTTP instead of stdio so remote clients (e.g. ChatGPT connectors) can reach it:

```bash
MCP_TRANSPORT=streamable-http HOST=0.0.0.0 PORT=8000 .venv/bin/python server.py
# MCP endpoint: http://<host>:8000/mcp
```

See [`DEPLOY.md`](DEPLOY.md) for hosting, environment variables, and auth. The endpoint
is unauthenticated by default — don't expose it publicly without a gateway or auth.

## Branches

This branch (`main`) contains only what's needed to deploy: `server.py`, the built
widgets in `assets/`, and the uv project files. Don't edit `assets/*.html` by hand —
they're build output.

- [`dev`](https://github.com/dhanissuharmadi-pixel/grand-alaric-hotel-mcp/tree/dev) —
  development branch: widget source (`widgets/`), local previews, and contributor notes
  (`HANDOFF.md`). Widgets are rebuilt there (`npm run build` writes into `assets/`),
  then shipped here with
  `git checkout dev -- server.py assets pyproject.toml uv.lock && git commit`.
- [`local-dev`](https://github.com/dhanissuharmadi-pixel/grand-alaric-hotel-mcp/tree/local-dev) —
  testing tooling: MCP Inspector workflow, OpenAI Agents test client, Postman collections.

None of it is needed to deploy.
