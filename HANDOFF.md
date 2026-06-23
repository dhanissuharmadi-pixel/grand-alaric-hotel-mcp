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

- ✅ Widgets built, wired, and polished. Merged to `main`, pushed.
- ✅ Original price strikethrough on discounted rooms (derived server-side from room ID pattern).
- ✅ `splitName()` moved to server.py — widgets receive pre-parsed `room_name` + `room_name_sub`.
- ✅ Dev preview files deleted (were committed artifacts; no longer needed).
- ⏳ **Senior must:** pull latest `main`, redeploy, set env `MCP_ALLOWED_HOSTS=mcp.grandalaric.com`, restart.
  Until then `https://mcp.grandalaric.com/mcp` returns **421 Misdirected Request** (DNS-rebinding guard).
- ⏳ **User must:** connect ChatGPT to `https://mcp.grandalaric.com/mcp` once senior confirms.
- 🔜 **Widget rewrite (next):** rebuild `room-results` as an Embla carousel using `@openai/apps-sdk-ui`.
  See "Planned widget rewrite" section below.
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
| `room-results` | `check_availability` | Card list of rooms (image, name+subtitle, IDR price, strikethrough original price if discounted). CSP allows hotel image domains. |
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

## API response structure (confirmed by live call)

### `/hotels` (GET)
```json
{ "success": true, "hotels": [{ "hotel_id": "GSV", "hotel_name": "...", "hotel_phone_number": "..." }] }
```

### `/rooms` (POST)
```json
{ "success": true, "rooms": [{ "room_id": "SUPK-IWS312ROO", "room_name": "Superior City View - Book Direct & Save More", "room_image": "https://...", "currency": "IDR", "price": 140000 }] }
```

**No `original_price` field from the API.** server.py derives it. Room ID pattern:
- Base (rack) rate: `{type}-{ROO|BAR}` → e.g. `SUPK-ROO`, `SUPK-BAR`
- Discounted rate: `{type}-{dealcode}{ROO|BAR}` → e.g. `SUPK-IWS312ROO`, `SUPK-EB4339BAR`
- `ROO` = Without Breakfast, `BAR` = Bed & Breakfast
- Deal codes seen: `IWS312` (Book Direct & Save More), `EB4339` (Early Bird 14 Days)

server.py matches discounted rooms to their base variant and adds `original_price` when `original > discounted`.
This is reactive — runs fresh on every `check_availability` call, so prices update automatically as deals change.

## Known platform limitation (not a code bug)

On an **unauthenticated dev-mode connector**, OpenAI gates WRITE actions at the system layer.
READS (`check_availability`) work reliably; `create_order` is **inconsistent** (sometimes "blocked by
safety checks"). This is OpenAI's behavior, confirmed by ChatGPT itself. Resolution = auth + app
submission, not a code change. Don't chase this in `server.py`.

## Planned widget rewrite — room-results carousel

The `room-results` widget is planned for a full rebuild as an **Embla carousel** using
`@openai/apps-sdk-ui`. Read the OpenAI Apps SDK docs before starting.

### Design direction
- Display mode: **inline carousel** (3–8 cards, swipeable)
- Component: `PlaceCard`-style cards with room image, name, price, strikethrough original price
- CTA per card: single "Book this room" button → fires `ui/message` to initiate booking via model
- Arrow nav buttons: show at `md`+ breakpoint, hidden on mobile (swipe)
- Icons: use `@openai/apps-sdk-ui/components/Icon` (not lucide-react)
- Breakpoints: use `@openai/apps-sdk-ui` system (`xs`/`sm`/`md`/`lg`/`xl`/`2xl`), card width `w-[65vw] sm:w-[220px]`
- Dark mode: keep class-based (`@custom-variant dark (&:where(.dark, .dark *))`) — ChatGPT sends theme via `window.openai.theme`, `prefers-color-scheme` is NOT reliable inside the iframe

### Key deps to add
```bash
npm install @openai/apps-sdk-ui embla-carousel-react
```
Once added, `widgets/src/openai.js` can be deleted — `@openai/apps-sdk-ui` ships `useOpenAiGlobal`.

### MCP Apps bridge (forward-compatible pattern)
Current widgets use `window.openai.toolOutput` + `openai:set_globals`. The standard going forward
is `ui/notifications/tool-result` over `postMessage`. Both work in ChatGPT today. For new widgets,
prefer the bridge:
```js
window.addEventListener("message", (event) => {
  if (event.source !== window.parent) return;
  const msg = event.data;
  if (!msg || msg.jsonrpc !== "2.0") return;
  if (msg.method !== "ui/notifications/tool-result") return;
  const data = msg.params?.structuredContent;
  // render from data
}, { passive: true });
```

### Decoupled tool pattern (for future tools)
Current: `check_availability` fetches data AND owns the widget template (single tool).
Future tools should split: **data tool** (no outputTemplate, returns structuredContent) +
**render tool** (owns outputTemplate, takes data from data tool). Prevents unnecessary widget re-mounts.

### UI guidelines (from OpenAI Apps SDK docs)
- Max 2 primary actions per inline card
- No nested scrolling — cards auto-fit content
- No logo inside the widget — ChatGPT prepends it automatically
- Brand accent color on primary buttons only; system colors everywhere else
- Always include `alt` text on images (use `room_name` as alt)
- WCAG AA contrast on all text

## Building the widgets (only when editing widget UI)

```bash
cd widgets
npm install
npm run build      # builds BOTH widgets into ../assets/ (per-widget via WIDGET env var)
```

- Stack: React 19 + Tailwind 4 + Vite + `vite-plugin-singlefile`.
- `viteSingleFile` can't do multiple entries in one pass, so `package.json`'s build runs Vite once
  per widget: `WIDGET=room-results vite build && WIDGET=checkout vite build`.
- After building, **commit the regenerated `assets/*.html`** — that's what ships.
- Note: `preview.html` / `preview-checkout.html` were deleted. If you need local preview again,
  recreate them (see `widgets/README.md` for the `window.openai` mock pattern).

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

- `rest_api_postman_collection.json` (repo root) — a flat Postman export duplicating what's already
  structured under `postman/`. Blank apiKey (safe). Decide: delete or move into `postman/`.
