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
    input="I want a room in Bandung 2026-07-01 to 2026-07-03",
)
```

## Authentication (OAuth 2.0)

By default the endpoint is **unauthenticated** (fine for local stdio / the Inspector).
For a public deployment, the server runs as an OAuth 2.0 **resource server**: it
validates the caller's bearer token and advertises an authorization server via
`/.well-known/oauth-protected-resource` (RFC 9728), which ChatGPT/Claude use to
discover where to log the user in. **The caller's token is validated and stops here —
it is never forwarded to the PHM backend, which keeps using its own `phm-chat-api-key`.**

You bring an established OAuth provider as the authorization server (Auth0, Stytch,
Descope, Keycloak, …). It **must support Dynamic Client Registration** — ChatGPT relies
on it. Then set:

```bash
OAUTH_ISSUER_URL=https://your-tenant.us.auth0.com   # the provider
OAUTH_AUDIENCE=https://your-host/mcp                 # this server's public URL (token audience)
OAUTH_REQUIRED_SCOPES="book:hotel"                   # optional, space-separated
# OAUTH_JWKS_URL=...                                 # optional; defaults to issuer + /.well-known/jwks.json
MCP_ALLOWED_HOSTS=your-host                           # required when public: the SDK blocks unknown
                                                     # Host headers (DNS-rebinding protection). List the
                                                     # public host(s), or "*" to disable behind a trusted proxy.
MCP_TRANSPORT=streamable-http HOST=0.0.0.0 PORT=8000 .venv/bin/python server.py
```

Add it in ChatGPT under **Settings → Connectors → (Developer mode) → Add custom
connector**, pointing at `https://your-host/mcp`.

**Local testing without a client session:** set `TEST_TOKEN` in `.env` and the server
accepts that one bearer token, so Postman can call the protected server with
`Authorization: Bearer <TEST_TOKEN>`. Dev only — never set it in production.

```bash
TEST_TOKEN=dev-secret-123 MCP_TRANSPORT=streamable-http PORT=8000 .venv/bin/python server.py
```

If none of `OAUTH_ISSUER_URL` / `TEST_TOKEN` are set, auth is disabled (current behaviour).

## Status

Calls the live PHM API. Set `GRAND_ALARIC_API_KEY` (sent as `phm-chat-api-key`); override `API_BASE_URL` to point at a different backend.
