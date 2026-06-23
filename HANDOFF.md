# Handoff — Grand Alaric Hotel MCP + ChatGPT widgets

> Context dump for the next Claude session (or human). Read this first, then `server.py`.
> Last updated: 2026-06-23.

## What this project is

A FastMCP server (Python) that exposes the Grand Alaric Hotel (Bandung, Indonesia)
booking backend as MCP tools, **plus two ChatGPT Apps SDK widgets** that render
inline in ChatGPT. Public GitHub repo. Deployed by a senior at `mcp.grandalaric.com`.

The backend lives at `https://api6.alarichotels.com/webapi/chatgpt`. `server.py`
proxies it, authenticating with header `phm-chat-api-key: $GRAND_ALARIC_API_KEY`.

## Current status (as of this handoff)

- ✅ Widgets built, wired, and polished (neutral/native look — **no brand colors**). Merged to `main`, pushed.
- ✅ Booking flow verified working server-side (`create_order` → 200, valid intact payment link).
- ⏳ **Senior must:** pull latest `main`, redeploy, set env `MCP_ALLOWED_HOSTS=mcp.grandalaric.com`, restart.
  Until then `https://mcp.grandalaric.com/mcp` returns **421 Misdirected Request** (DNS-rebinding guard).
- ⏳ **User must:** connect ChatGPT to `https://mcp.grandalaric.com/mcp` once senior confirms.
- 🔜 **Production (deferred):** authentication + OpenAI app submission. Required for *consistent* write
  actions — see "Known platform limitation" below.

## Architecture

```
ChatGPT  ──MCP (streamable-HTTP, /mcp)──▶  server.py  ──REST + phm-chat-api-key──▶  api6.alarichotels.com
                                              │
                                              └─ serves widget HTML from assets/*.html
```

- Transport: `MCP_TRANSPORT=streamable-http`, endpoint `/mcp`.
- Widgets are **self-contained single HTML files** in `assets/` (JS+CSS inlined). The server reads
  them at runtime and serves them as MCP resources with MIME `text/html+skybridge`.
  **Deployment does NOT run npm** — the built `assets/*.html` are committed.

## How the widget wiring works (the non-obvious parts)

1. A tool links to a widget via `_meta["openai/outputTemplate"] = "ui://widget/<name>.html"`.
2. Tool must use `@mcp.tool(meta=..., structured_output=True)` and return `-> dict[str, Any]`.
   This produces `structuredContent`, which ChatGPT injects **byte-exact** into
   `window.openai.toolOutput` (the model never re-types it). A plain dict return alone is NOT enough.
3. **ChatGPT reads a widget's CSP/domain from the resource TEMPLATE** (`resources/templates/list`),
   not the concrete resource. FastMCP only auto-creates templates for *parameterized* URIs, so the
   static widget URIs need an explicit handler: `@mcp._mcp_server.list_resource_templates()` in `server.py`.
4. Widget CSP keys are **snake_case** (`resource_domains`, `redirect_domains`, `connect_domains`).
   camelCase is rejected by OpenAI's validator. `openai/widgetDomain` is required for submission.

## The two widgets

| Widget | Tool | What it shows |
|---|---|---|
| `room-results` | `check_availability` | Card list of rooms (image, name+subtitle, IDR price). CSP allows hotel image domains. |
| `checkout` | `create_order` | "Complete payment" button that opens the payment URL via `window.openai.openExternal`. CSP `redirect_domains` allows `m.grandalaric.com`. |

Source: `widgets/src/*.jsx`. Shared host-state hook: `widgets/src/openai.js`.

### ⚠️ The corrupted-payment-link bug (most important lesson)

Original symptom: checkout link gave "transaction no longer available". Root cause: **ChatGPT's
model corrupted the long JWT when echoing the payment URL as text** (invented characters, typos in
the token). The fix is the checkout widget: the URL comes from `structuredContent` verbatim and the
button opens it — the model never types it. Reinforced by:
- `create_order` docstring: "DO NOT write, paste, or retype that URL".
- Server `instructions`: "NEVER write the payment URL as text; retyping its token corrupts the link."

**Do not "fix" this by printing the URL as text. That reintroduces the bug.**

## Known platform limitation (not a code bug)

On an **unauthenticated dev-mode connector**, OpenAI gates WRITE actions at the system layer.
READS (`check_availability`) work reliably; `create_order` is **inconsistent** (sometimes "blocked by
safety checks"). This is OpenAI's behavior, confirmed by ChatGPT itself. Resolution = auth + app
submission, not a code change. Don't chase this in `server.py`.

## Building the widgets (only when editing widget UI)

```bash
cd widgets
npm install
npm run build      # builds BOTH widgets into ../assets/ (per-widget via WIDGET env var)
```

- Stack: React 19 + Tailwind 4 + Vite + `vite-plugin-singlefile`.
- `viteSingleFile` can't do multiple entries in one pass, so `package.json`'s build runs Vite once
  per widget: `WIDGET=room-results vite build && WIDGET=checkout vite build`.
- Local preview without ChatGPT: `npm run dev`, open `preview.html` / `preview-checkout.html`
  (they mock `window.openai` with sample data).
- After building, **commit the regenerated `assets/*.html`** — that's what ships.

## Running the server locally

```bash
MCP_TRANSPORT=streamable-http HOST=0.0.0.0 PORT=8000 MCP_ALLOWED_HOSTS='*' \
  GRAND_ALARIC_API_KEY=<key> uv run server.py
```
Then expose with a tunnel (`cloudflared tunnel --url http://localhost:8000`) and point a ChatGPT
dev connector at `<tunnel-url>/mcp`. `MCP_ALLOWED_HOSTS='*'` disables the host check for tunnels;
in production set it to the real host (`mcp.grandalaric.com`).

## Env / config knobs

- `GRAND_ALARIC_API_KEY` — **secret, never commit.** `.env` is gitignored (verified never in history).
- `MCP_TRANSPORT` — `streamable-http` for ChatGPT.
- `HOST`, `PORT`.
- `MCP_ALLOWED_HOSTS` — comma list of allowed Host headers, or `*`. **If unset/wrong → HTTP 421.**

## Security notes (preserve)

- Repo is **PUBLIC**. No secrets have ever been committed (audited). Postman files use blank `{{apiKey}}`.
- `create_order` places **REAL live bookings** (pending-until-paid). User has senior's permission.
- The deployed endpoint is currently **UNAUTHENTICATED** — anyone with the URL can call every tool,
  including `create_order`. Auth is deferred to production.
- Public-exposure commands (tunnels) must be run by the **user personally**, not by an agent.

## Repo housekeeping (stray files to deal with)

- `widgets/from mcp.server.py` — **junk** (old Playwright-based server, accidental save). Safe to delete.
- `rest_api_postman_collection.json` (repo root) — a flat Postman export duplicating what's already
  structured under `postman/`. Blank apiKey (safe). Decide: delete or move into `postman/`.
