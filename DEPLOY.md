# Deployment Handoff

Notes for hosting the Grand Alaric Hotel MCP server. Current code is unauthenticated
and points at the live PHM API.

## What it is
`server.py` - a FastMCP server exposing 8 hotel tools (search, details, availability,
packages, nationalities, order status, create_order). It proxies the live PHM API and
serves the ChatGPT Apps SDK widgets from `assets/` (committed build output — the widget
source lives on the `dev` branch). Local testing tooling (a test client and Postman
collections) lives on the `local-dev` branch. Neither branch is needed in production —
deploy `main` as-is.

## Run it (hosted, streamable-HTTP)
```bash
uv sync
MCP_TRANSPORT=streamable-http HOST=0.0.0.0 PORT=8000 .venv/bin/python server.py
# MCP endpoint: https://<your-domain>/mcp
```
On a PaaS, bind to the platform's `$PORT`. The server reads `HOST`/`PORT` from env.

## Environment variables
| Var | Required | Purpose |
|---|---|---|
| `GRAND_ALARIC_API_KEY` | **yes** | sent as `phm-chat-api-key` to the PHM backend. Set as a platform **secret**, not in `.env`. |
| `MCP_TRANSPORT` | yes (hosted) | set to `streamable-http` |
| `HOST` / `PORT` | yes (hosted) | `0.0.0.0` / platform port |
| `MCP_ALLOWED_HOSTS` | **yes (public)** | the public host(s), e.g. `mcp.example.com`. The SDK blocks unknown `Host` headers (DNS-rebinding protection); set this to your domain, or `*` to disable the check behind a trusted proxy. |
| `API_BASE_URL` | no | defaults to the live PHM endpoint; override only to point elsewhere. |
| `EXTRAS_ENABLED` | no | default `true` — add-on extras ("enhance your stay") show and book end-to-end (backend fixed 2026-07-08). Set `false` to hide extras if the backend ever regresses. |

## Verify a deploy actually works (do this before connecting ChatGPT)
The server logs a loud `ERROR` at startup for each of the config mistakes that cause a
"deployed but doesn't work" (missing key, loopback host, missing `MCP_ALLOWED_HOSTS`) —
**check the startup logs first**. Then confirm the endpoint end-to-end:
```bash
curl -s -X POST https://<your-domain>/mcp \
  -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"t","version":"0"}}}'
```
- Returns `serverInfo` → working; connect the connector at `https://<your-domain>/mcp`.
- Connection refused → `MCP_TRANSPORT` not `streamable-http`, or `HOST` not `0.0.0.0`.
- `400` / invalid host → `MCP_ALLOWED_HOSTS` missing your domain.
- Connects but tools error → `API_KEY` unset.

See `.env.example` for the full, copy-paste env template.

## Authentication - DECISION NEEDED
The endpoint is currently **unauthenticated** — anyone who has the URL can call every
tool, including `create_order`. which needs to be changed for public permanent deployment


## create_order makes REAL bookings
`create_order` does a live `POST /orders` against the production PHM API using the
server-side key. It creates real (pending-until-paid) reservations and returns a real
payment link. Treat the write path accordingly when exposing the server.

## Suggested hosts
- **Railway / Render** — connect the GitHub repo, set the start command + secrets, get a
  stable HTTPS domain with auto-restart. Easiest.
- **Cloudflare named tunnel + a domain** — keep the server where it is, stable hostname.
- **VPS + systemd + Caddy + domain** — most control, most ops.

## Testing
Local testing tooling lives on the [`local-dev`](https://github.com/dhanissuharmadi-pixel/grand-alaric-hotel-mcp/tree/local-dev) branch:
- Postman collections for the MCP endpoint and the PHM REST API directly.
- The OpenAI Agents test client (`openai_agent.py`).
- MCP Inspector: `npx @modelcontextprotocol/inspector .venv/bin/python server.py`
