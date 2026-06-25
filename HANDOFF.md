# Handoff — Grand Alaric Hotel MCP + ChatGPT widgets

> Context dump for the next Claude session (or human). Read this first, then `server.py`
> and `widgets/src/hotel-list.jsx`.
> Last updated: 2026-06-25.

## What this project is

A FastMCP server (Python) that exposes the Grand Alaric Hotel (Bandung, Indonesia)
booking backend as MCP tools, **plus four ChatGPT Apps SDK widgets** that render inline
in ChatGPT. Public GitHub repo. Deployed by a senior at `mcp.grandalaric.com`.

Backend: `https://api6.alarichotels.com/webapi/chatgpt` (Postman collection: "General
Mobile API - v1"). `server.py` proxies it with header `phm-chat-api-key: $GRAND_ALARIC_API_KEY`.

## Current status

- ✅ Full booking flow built: search → hotel list → details → dates → rooms → enhance → guest → pay.
- ✅ All backend APIs updated by the senior and wired (see "API shapes" — `/rooms` is grouped now,
  `/hotels` is rich, `/enchance-stay` is live, `/hotel/info` has `starting_price`).
- ⚠️ **Not yet tested live in ChatGPT.** The whole in-widget flow relies on `window.openai.callTool`
  behaving a certain way (see "The callTool assumption"). Needs one real connector test.
- 🔜 **Production (deferred):** auth + OpenAI app submission — required for *consistent* writes
  (see "Known platform limitation").

## Architecture

```
ChatGPT ──MCP (streamable-HTTP, /mcp)──▶ server.py ──REST + phm-chat-api-key──▶ api6.alarichotels.com
                                            └─ serves widget HTML from assets/*.html
```

- Widgets are **self-contained single HTML files** in `assets/` (JS+CSS inlined). Server reads them
  at runtime, serves as MCP resources, MIME `text/html+skybridge`. **Deploy does NOT run npm** — the
  built `assets/*.html` are committed.

## The four widgets + tools

| Widget | Tool (outputTemplate) | Role |
|---|---|---|
| `hotel-list` | `search_hotels(location)` | **The main flow controller.** Carousel of hotel cards → drives list → details → dates → rooms → enhance → guest → pay, all in-widget. |
| `hotel-details` | `get_hotel_details(hotel_id)` | Standalone details card (gallery, amenities, map, policies) for when the *model* calls it directly. |
| `room-results` | `check_availability(...)` | Standalone room list for when the *model* calls it directly. |
| `checkout` | `create_order(...)` | "Complete payment" button (opens payment URL via `openExternal`). |

### How the flow actually works (the key design)

`hotel-list.jsx` is a **controller** with a `view` state machine. Each step fetches via
`window.openai.callTool(name, args)` — a direct tool call that returns `structuredContent`
with **no model turn**, so the next screen appears instantly. Booking (`create_order`) is the
only step that could fall back to the model.

- Views are **shared modules** in `widgets/src/views/`: `HotelCards`, `HotelDetail`, `RoomList`
  (compact cards + tap-for-detail + quantity steppers), `EnhanceStay`, `GuestForm`, `OrderSummary`,
  `Calendar` (2-month range picker), `icons`.
- `hotel-details.jsx` / `room-results.jsx` are **thin wrappers** around those same view components
  for the model-driven entry points (they hand off to the model, since they can't drive the full flow).
- `callTool` + `sendFollowup` helpers live in `widgets/src/openai.js`.

### ⚠️ The callTool assumption (verify this first)

The in-widget flow assumes **`callTool` returns data to the calling widget WITHOUT swapping to the
called tool's own widget**. If ChatGPT instead auto-renders `get_hotel_details`/`check_availability`'s
template on `callTool`, the unified flow double-renders. Fix would be: drop `outputTemplate` from those
two tools (keep them as data tools), or rework. **This needs a live ChatGPT test** — the local previews
can't exercise it.

### ⚠️ The corrupted-payment-link rule (do not break)

ChatGPT's model corrupts the long payment JWT if it echoes the URL as text. So the URL flows via
`structuredContent` → widget → `openExternal`, never through the model. `create_order` docstring +
server `instructions` forbid printing it. **Never "fix" anything by printing the payment URL as text.**

## API shapes (live, confirmed 2026-06-25)

All POST bodies use `_stay_body`: `{hotel_id, checkin, checkout, adult, child, promocode}`.

- **`/hotels`** (GET) → `hotels: [{hotel_id, hotel_cover, hotel_name, hotel_phone_number, rating, city_name, province_name, starting_price}]`. `search_hotels` maps this straight to cards — **no per-hotel enrichment**.
- **`/rooms`** (POST) → `rooms: [{room_images[], room_name, room_desc(HTML), room_info, rates: [{room_rate_id, room_rate, breakfast, cancellation_info[], benefit:{info,data[]}, currency, price, original_price, discount}]}]`. **Already grouped by room type.** `check_availability` reshapes to the widget's `{name, image, images, description, meta, rates:[{room_id, room_name_sub, meal, conditions[], benefits[], price, original_price}]}` and skips no-rate rooms.
- **`/hotel/info`** (POST `{id, ...dates}`) → `{hotel: {hotel_name, rating, hotel_address, hotel_city_name, hotel_state, hotel_description(HTML), images[], facilities[{name,icon}], attraction[{name,distance}], checkintime, checkouttime, hotel_loc_lat/long, starting_price, hotel_badge[], ...}}`. `_normalize_hotel` maps field names → widget keys (`rating→star_rating`, `facilities→amenities` via `_facility_icon`, HTML stripped, `starting_price→price_from`, lat/long → Google static map if `GOOGLE_MAPS_API_KEY` set).
- **`/enchance-stay`** (POST, note the misspelling) → `[{enhance_stay_id, title, image, end_price, original_price, discount}]`. `check_availability` attaches normalized `extras: [{id, name, image, price, original_price}]` for the Enhance step.

server.py is the **adapter layer** — it normalizes every backend response to stable widget keys, so
the widgets don't change when backend field names do.

## Pending / known gaps (the `ponytail:` debt + caveats)

- **Multi-room booking** — `create_order` takes one `room_id`, no count. The room UI is **capped to 1
  room** (`setQty` exclusive, stepper `+` disabled at 1) so the total never lies. Restore quantity when
  the API takes a room count. (`ponytail:` comments in `RoomList.jsx`.)
- **Salutation codes guessed** — `GuestForm.jsx` `TITLES`: only `Mr=3` is documented; Mrs/Ms guessed.
  Confirm against the backend. (`ponytail:` comment there.)
- **Per-room facilities** — not in `/rooms`, so the room-detail "Room facilities" section stays empty
  (only `room_desc` + `room_info` + images exist). Wire when the API adds them.
- **In-widget "Pay now"** is a write via `callTool` — gated on the unauthenticated connector (see below).
- Run `ponytail-debt` to list all deferred shortcuts.

## Known platform limitation (not a code bug)

On an **unauthenticated dev connector**, OpenAI gates WRITE actions. Reads work; `create_order` is
inconsistent ("blocked by safety checks"). Resolution = auth + app submission, not code. Don't chase it.

## Building widgets (only when editing widget UI)

```bash
cd widgets && npm install && npm run build   # builds all 4 into ../assets/ (one vite pass per WIDGET)
```
Stack: React 19 + Tailwind 4 + Vite + `vite-plugin-singlefile` + `@openai/apps-sdk-ui` (icons).
After building, **commit the regenerated `assets/*.html`** — that's what ships.

**Offline preview (no API, no ChatGPT):** `npm run dev`, open `preview-hotel-list.html` (full flow),
`preview-rooms.html`, `preview-hotel-details.html`, `preview-checkout.html` — each mocks `window.openai`
(incl. `callTool`) with sample data. Switch `theme: "light"` → `"dark"` in a preview to test dark mode.

## Running the server locally

1. `.env` (gitignored, never commit):
   ```
   GRAND_ALARIC_API_KEY=<key>
   GOOGLE_MAPS_API_KEY=<key>        # optional — hotel-details map thumbnail
   MCP_TRANSPORT=streamable-http
   HOST=0.0.0.0
   MCP_ALLOWED_HOSTS=*
   ```
2. `uv run server.py`
3. Tunnel: `ngrok http 8000` (NOT Cloudflare — drops SSE). Add connector at `https://<ngrok>/mcp`.

## Debugging lessons (hard-won — don't repeat)

- **`.env` must exist** — empty `GRAND_ALARIC_API_KEY` → 403 → widgets render "not found" (widget fine, data missing).
- **Restart after any server.py edit** — FastMCP doesn't hot-reload. Then **disconnect + reconnect** the
  connector in ChatGPT (it caches the tool list) and start a fresh conversation.
- **`MCP_ALLOWED_HOSTS=*`** required for tunnels, else HTTP 421.
- **`tools/list`** is the diagnostic: check each tool's `_meta` for `openai/outputTemplate`.
- Theme adaptivity already works: widgets read `window.openai.theme` → `.dark` class → Tailwind `dark:`.
  The SDK's `[data-theme]` + `useDocumentTheme` API is an alternative; only switch if live-toggle breaks.
- `GOOGLE_MAPS_API_KEY` must also be set in the **deploy env** (`.env` is local only), and **restricted**
  in Google Cloud (HTTP referrer + Maps Static API) — it's exposed in the map image URL.

## Security notes (preserve)

- Repo is **PUBLIC**. No secrets committed (keys live only in gitignored `.env`).
- `create_order` places **REAL live bookings** (pending-until-paid). User has senior's permission.
- Deployed endpoint is **UNAUTHENTICATED** — anyone with the URL can call every tool. Auth deferred.
- Tunnel/public-exposure commands must be run by the **user personally**, not an agent.
