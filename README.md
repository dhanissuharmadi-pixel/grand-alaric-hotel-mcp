# Grand Alaric Hotel MCP — Local Dev & Testing

This branch holds the **local development and testing tooling** that isn't needed to
deploy the server. The production server and deployment notes live on **`main`**
(see `main`'s `README.md` and `DEPLOY.md`).

In addition to `server.py`, this branch carries:

| File | Purpose |
|---|---|
| `openai_agent.py` | CLI client that runs the MCP tools through the OpenAI Agents SDK |
| `(local) mcp_postman_collection.json` | Postman collection hitting the MCP server (streamable-HTTP) |
| `(direct) rest_api_postman_collection.json` | Postman collection hitting the PHM REST API directly |

## Setup

```bash
uv sync                       # installs server deps + openai-agents (test client)
export GRAND_ALARIC_API_KEY=your_api_key
```

## MCP Inspector

Interactively call the tools over stdio:

```bash
npx @modelcontextprotocol/inspector .venv/bin/python server.py
```

Open the printed URL, hit **Connect**, and run any of the 6 tools. Dates are `YYYY-MM-DD`.

## OpenAI agent (CLI test client)

`openai_agent.py` speaks MCP natively — it spawns `server.py` and auto-discovers the
tools (no schema duplication).

```bash
export OPENAI_API_KEY=sk-...
.venv/bin/python openai_agent.py                                  # local, spawns server.py
MCP_URL=http://<host>:8000/mcp OPENAI_API_KEY=sk-... .venv/bin/python openai_agent.py   # remote server
```

## Postman collections

Import either collection in Postman:

- **`(local) mcp_postman_collection.json`** — tests the MCP server over streamable-HTTP.
  Start the server first, then run `initialize` (it captures the session and sends the
  `notifications/initialized` message), then any tool request.
  ```bash
  MCP_TRANSPORT=streamable-http HOST=0.0.0.0 PORT=8000 .venv/bin/python server.py
  ```
- **`(direct) rest_api_postman_collection.json`** — hits the PHM REST API directly
  (bypasses the MCP server). Set the `apiKey` collection variable to your
  `GRAND_ALARIC_API_KEY` before running.

> The GNW package requires a 3-night minimum stay. `create_order` places a **real**
> booking against the live PHM API.
