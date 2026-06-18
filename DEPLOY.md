# Deployment Handoff

Notes for hosting the Grand Alaric Hotel MCP server. Current code is unauthenticated
and points at the live PHM API.

## What it is
`server.py` — a FastMCP server exposing 6 hotel tools (search, availability, packages,
nationalities, create_order). It proxies the live PHM API. `openai_agent.py` is just a
local test client, not needed in production.

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

## Authentication — DECISION NEEDED
The endpoint is currently **unauthenticated** — anyone who has the URL can call every
tool, including `create_order`. That is **not** acceptable for a permanent public
deployment.

A complete OAuth 2.0 resource-server implementation (validate caller tokens against an
external provider, e.g. Auth0/Stytch; ChatGPT-connector compatible) was built and then
reverted to keep the demo simple. To restore it:
```
git show 52fb891   # the revert commit; revert it to bring OAuth back
# (original OAuth commit: a54b4de)
```
Recommendation: restore OAuth, or put a gateway/token in front, before going live.

## ⚠️ create_order makes REAL bookings
`create_order` does a live `POST /orders` against the production PHM API using the
server-side key. It creates real (pending-until-paid) reservations and returns a real
payment link. Treat the write path accordingly when exposing the server.

## Suggested hosts
- **Railway / Render** — connect the GitHub repo, set the start command + secrets, get a
  stable HTTPS domain with auto-restart. Easiest.
- **Cloudflare named tunnel + a domain** — keep the server where it is, stable hostname.
- **VPS + systemd + Caddy + domain** — most control, most ops.

## Testing
- `mcp_postman_collection.json` — exercises the MCP endpoint (initialize + 6 tools).
- `rest_api_postman_collection.json` — hits the PHM REST API directly (set `apiKey`).
- MCP Inspector: `npx @modelcontextprotocol/inspector .venv/bin/python server.py`
