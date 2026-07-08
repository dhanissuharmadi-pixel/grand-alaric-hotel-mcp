# Handoff — Grand Alaric Hotel MCP + ChatGPT widgets

> Context dump for the next Claude session (or human). Read this first, then `server.py`
> and `widgets/src/BookingApp.jsx`.
> Last updated: 2026-07-06.

## Branch layout — develop HERE, deploy from main

- **`dev` (this branch)** — everything: widget source (`widgets/`), local previews, this file.
- **`main`** — deploy-only, what the senior pulls: `server.py`, built `assets/`, uv files,
  `README.md`/`DEPLOY.md`. **No widget source** — never develop on main.
- **`local-dev`** — stale pre-widget testing tooling (Postman collections, `openai_agent.py`).

Ship dev → main (keeps README/DEPLOY identical on both so nothing conflicts):
```bash
npm --prefix widgets run build            # writes assets/*.html
git commit -am "..." && git push          # commit on dev first
git checkout main
git checkout dev -- server.py assets pyproject.toml uv.lock README.md DEPLOY.md
git commit -m "ship: <what changed>" && git push
git checkout dev
```

## What this project is

A FastMCP server (Python) that exposes a hotel booking backend as MCP tools, **plus four
ChatGPT Apps SDK widgets** that render inline in ChatGPT. Public GitHub repo. Deployed by a
senior at `mcp.grandalaric.com`. Currently configured for Grand Alaric Hotel (Bandung,
Indonesia), but `server.py` is now **white-labeled** — all hotel-specific values come from
`.env` (see "White-labeling").

Backend: `https://api6.alarichotels.com/webapi/chatgpt`. `server.py` proxies it with header
`phm-chat-api-key: $API_KEY` (header name + base URL are env-overridable).

## Current status

- (Done) Full in-widget booking flow: search → hotel list → details → dates → rooms → enhance → guest → pay.
- (Done) **Tested live in ChatGPT.** The unified in-widget flow works — `callTool` returns data to the
  calling widget without swapping templates (the "callTool assumption" held).
- (Done) **Cart-based booking + multi-room** wired to the new `/orders` contract (see "API shapes").
- (Done) Light + dark mode both render correctly (see "Theme / background").
- (issue) **Two backend/config issues block polish** (not our code): broken `hotel_cover` images and an
  unauthorized Google Maps key (see "Known backend/config issues").
- (soon) **Production (deferred):** auth + OpenAI app submission — required for *consistent* writes
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
with **no model turn**, so the next screen appears instantly. `callTool` returns data to the
calling widget without auto-rendering the called tool's template (verified live).

- Views are **shared modules** in `widgets/src/views/`: `HotelCards`, `HotelDetail`, `RoomList`
  (compact cards + tap-for-detail + quantity steppers), `EnhanceStay`, `GuestForm`, `OrderSummary`,
  `Calendar` (2-month range picker), `icons`.
- `hotel-details.jsx` / `room-results.jsx` are **thin wrappers** around those same view components
  for the model-driven entry points (they hand off to the model, since they can't drive the full flow).
- `callTool` + `sendFollowup` helpers live in `widgets/src/openai.js`.

###  The corrupted-payment-link rule

ChatGPT's model corrupts the long payment JWT if it echoes the URL as text. So the URL flows via
`structuredContent` → widget → `openExternal`, never through the model. `create_order` docstring +
server `instructions` forbid printing it. **Never "fix" anything by printing the payment URL as text.**

### Theme / background

Widgets read `window.openai.theme` → mirror it as a `.dark` class on the root → Tailwind class-based
`dark:` variants (`@custom-variant dark` in `index.css`). **Each widget root also paints its own
background** (`bg-white dark:bg-neutral-950` + `color-scheme`) — the iframe's default canvas is black,
so without this, light mode showed dark text on black. The SDK's `[data-theme]` + `applyDocumentTheme`
API is the canonical alternative; not adopted (our `.dark` approach works) but fine to migrate to.

## API shapes (live, confirmed 2026-06-26)

All POST bodies use `_stay_body`: `{hotel_id, checkin, checkout, adult, child, promocode}`.

- **`/hotels`** (GET) → `hotels: [{hotel_id, hotel_cover, hotel_name, hotel_phone_number, rating, city_name, province_name, starting_price}]`. `search_hotels` maps straight to cards — **no per-hotel enrichment**. ⚠️ **`hotel_cover` URLs 404** (backend bug — see "Known backend/config issues"); gallery/room images on the same host work fine.
- **`/rooms`** (POST) → `rooms: [{room_images[], room_name, room_desc(HTML), room_info, room_available, rates: [{room_rate_id, room_rate, breakfast, cancellation_info[], benefit:{info,data[]}, currency, price, original_price, discount}]}]`. Grouped by room type. `check_availability` reshapes to `{name, image, images, description, meta, available, rates:[{room_id(=room_rate_id), room_name_sub, meal, conditions[], benefits[], price, original_price}]}` and skips no-rate rooms. `available` = max bookable of that room type (the multi-room qty cap).
- **`/hotel/info`** (POST `{id}`) → `{hotel: {hotel_name, rating, hotel_address, hotel_city_name, hotel_state, hotel_description(HTML), images[], facilities[{name, icon(PNG url)}], attraction[{name,distance}], checkintime, checkouttime, hotel_loc_lat/long, starting_price, ...}}`. `_normalize_hotel` maps to widget keys (`rating→star_rating`, HTML stripped, `starting_price→price_from`). **Amenities pass through the API's PNG `icon` url** as `icon_url` (widget renders it, `dark:invert`ed, with a built-in SVG fallback). Map thumbnail built from lat/long only if `GOOGLE_MAPS_API_KEY` set.
- **`/enchance-stay`** (POST, note the misspelling) → `[{enhance_stay_id, title, image, end_price, original_price, discount}]`. `check_availability` attaches `extras: [{id, name, image, price, original_price}]` for the Enhance step.
- **`/orders`** (POST) → **cart-based** (changed by the senior; the `local-dev` Postman collection is now stale). Body:
  ```json
  {"hotel_id","checkin","checkout","adult","child","promocode",
   "cart": {"rooms":[{"room_rate_id","qty"}],
            "enhance_stay":[{"ehance_stay_id","notes","qty"}]},
   "guest":{"salutation","nation_code","name","phone","email"}}
  ```
  Note `ehance_stay_id` (API's misspelling). Backend enforces availability/limits and returns
  `{success:false, error:"..."}` on failure (e.g. "Cart is required", "Room is not avaialble").
  Success returns `{success, tracking_id, url}`. `create_order` accepts `rooms`/`enhance_stay` lists
  (or a single `room_id` back-compat) and builds the cart.
- **`/nationality`** (GET) → `{success, hotels:[{nation_code, nation_name, country_name, phone_code}]}` —
  the list is nested under the `hotels` key (backend quirk). `list_nationalities` normalizes to
  `{code, name, phone_code}` so the guest form reads it cleanly.

server.py is the **adapter layer** — it normalizes every backend response to stable widget keys.

## Pending / known gaps

- **Salutation codes guessed** — `GuestForm.jsx` `TITLES`: only `Mr=3` is documented; Mrs/Ms guessed.
  Confirm against the backend. (`ponytail:` comment there.)
- **Per-room facilities** — not in `/rooms`, so the room-detail "Room facilities" section stays empty.
- **Package booking is unwired** — `create_order` dropped `package_code`/`package_id` (not in the new
  cart contract). `check_packages`/`check_room_packages` still list packages, but booking one needs its
  own cart shape from the backend.
- **Extras send `qty: 1`** (toggle) — the cart API supports per-extra quantity; add qty steppers to the
  Enhance cards if clients want e.g. "Breakfast × 2".
- **No verified successful booking** — testing a real success places a live reservation, so the
  `success`/`url` path is wired but unconfirmed against the new cart API. Do one real end-to-end test.
- Run `ponytail-debt` to list all deferred shortcuts.

### Multi-room (DONE this session)
`create_order` is cart-based; `RoomList` steppers accumulate a qty per rate, capped per room type at
`room_available` ("Only N left" badge when ≤5). Chosen add-ons are now actually sent (previously shown
in the total but dropped). `OrderSummary` already rendered multi-room/qty.

## Known backend/config issues (NOT code bugs)

- **(Fixed 2026-07-08) `/orders` books extras.** For ~a day the handler parsed `cart.rooms` and
  ignored `cart.enhance_stay` (tested 7 placements, all rooms-only). Backend fixed it; verified
  against the live API: room-only `amount 59.400`, same room + "Drop off to airport" (1.5M) ->
  `amount 1.559.400` (delta exactly 1.5M), and a new `product_carts.enhancestay` bucket appears
  in the reservation.
  - The handler books extras ONLY under the key `ehance_stay_id` (the historical misspelling) —
    which is exactly what `create_order` already sends. The correct spelling `enhance_stay_id`
    is dropped. Do NOT "fix" the spelling in `server.py` or extras break again (inline comment
    guards this).
  - `EXTRAS_ENABLED` now defaults `true`; extras show and book end-to-end. Env kept only as an
    off-switch if the backend regresses.
- **Payment status never leaves "Waiting" after QRIS payment (2026-07-06).** User paid via
  QRIS; `GET /tracking-id/{id}` still returned `payment_status: "Waiting"` 1.5h later, so the
  widget's confirmed screen never fires. Likely the gateway→PHM webhook broke when the
  checkout flow changed (WhatsApp redirect → close). Backend must sync gateway status.
- **`hotel_cover` 404** — `/hotels` returns dead cover URLs (`.../unit/GSV_picture.jpg`). Gallery/room
  images on the same host (`booking.grandalaric.com`) work. **Backend must fix the cover path.** The
  widgets degrade broken images to a clean placeholder (icon on a gray box) instead of the `?` glyph.
  (Decision: not re-adding per-hotel enrichment; backend to fix.)
- **Google Maps 403** — the static-map URL returns *"This API key is not authorized to use this
  service"*. The key needs the **Maps Static API enabled** (+ referrer restrictions checked) in Google
  Cloud Console, and must be set in the **deploy env**. Code/CSP are correct.

## Known platform limitation (not a code bug)

On an **unauthenticated dev connector**, OpenAI gates WRITE actions. Reads work; `create_order` can be
inconsistent ("blocked by safety checks"). Resolution = auth + app submission, not code.

## White-labeling

`server.py` is env-driven for handoff to other clients: `API_BASE_URL`, `API_KEY`, `API_KEY_HEADER`,
`HOTEL_NAME`, `HOTEL_LOCATION`, `HOTEL_DOMAIN`, `RESOURCE_DOMAINS`, `PAYMENT_DOMAIN`,
`GOOGLE_MAPS_API_KEY`, `MCP_ALLOWED_HOSTS`. **Still hardcoded in the widgets** (would need a rebuild,
not just env): the **currency/locale** (`idr` = `Intl.NumberFormat("id-ID", {currency:"IDR"})` in
`views/icons.jsx`, used in ~6 files) and minor **brand text** ("Opens the secure Grand Alaric
checkout"). Proposed fix (parked): emit a `{currency, locale, brand}` config in tool output and format
money from that → env-only handoff, zero rebuild.

## Building widgets (only when editing widget UI)

```bash
cd widgets && npm install && npm run build   # builds all 4 into ../assets/ (one vite pass per WIDGET)
```
Stack: React 19 + Tailwind 4 + Vite + `vite-plugin-singlefile` + `@openai/apps-sdk-ui` (icons).
After building, **commit the regenerated `assets/*.html`** — that's what ships.

**Offline preview (no API, no ChatGPT):** `npm run dev`, open `preview-hotel-list.html` (full flow),
`preview-rooms.html`, `preview-hotel-details.html`, `preview-checkout.html` — each mocks `window.openai`
(incl. `callTool`) with sample data. Switch `theme: "light"` ↔ `"dark"` in a preview to test both modes.
(`.claude/launch.json` is set up for the preview-server tooling; it's untracked.)

## Running the server locally

1. `.env` (gitignored, never commit):
   ```
   API_KEY=<key>                    # or legacy GRAND_ALARIC_API_KEY
   GOOGLE_MAPS_API_KEY=<key>        # optional — hotel-details map thumbnail (needs Static API enabled)
   MCP_TRANSPORT=streamable-http
   HOST=0.0.0.0
   MCP_ALLOWED_HOSTS=*
   ```
2. `uv run server.py`
3. Tunnel: `ngrok http 8000` (NOT Cloudflare — drops SSE). Add connector at `https://<ngrok>/mcp`.

## Debugging lessons (hard-won — don't repeat)

- **`.env` must exist** — empty `API_KEY` → 403 → widgets render "not found" (widget fine, data missing).
- **Restart after any server.py edit** — FastMCP doesn't hot-reload. Then **disconnect + reconnect** the
  connector in ChatGPT (it caches the tool list) and start a fresh conversation.
- **Test BOTH light and dark mode** — the iframe canvas is black, so a missing widget background only
  surfaces in light mode. (Cost us a round-trip.)
- **`MCP_ALLOWED_HOSTS=*`** required for tunnels, else HTTP 421.
- **`tools/list`** is the diagnostic: check each tool's `_meta` for `openai/outputTemplate`.
- To diagnose API/data issues fast, hit the backend directly with the project's `httpx` + the `.env`
  key (urllib fails SSL verify on this machine). Read-only GETs are safe; never fire a *valid* `/orders`
  (it books for real) — use an over-limit qty to test the cart shape without booking.

## Security notes (preserve)

- Repo is **PUBLIC**. No secrets committed (keys live only in gitignored `.env`).
- `create_order` places **REAL live bookings** (pending-until-paid). User has senior's permission.
- Deployed endpoint is **UNAUTHENTICATED** — anyone with the URL can call every tool. Auth deferred.
- Tunnel/public-exposure commands must be run by the **user personally**, not an agent.
