# Widgets — Apps SDK UI for ChatGPT

React components that render inline in ChatGPT (the Apps SDK "widgets"). Each widget
builds to a **single self-contained HTML file** in `../assets/`, which `server.py`
serves as an MCP resource. No separate static host needed.

## Stack
React 19 · Tailwind 4 · Vite (single-file build). The built HTML inlines all JS+CSS.

## How it wires to the server
1. A tool declares its widget via `_meta` and returns `structuredContent`:
   ```python
   @mcp.tool(meta={"openai/outputTemplate": "ui://widget/room-results.html", ...},
             structured_output=True)
   async def check_availability(...) -> dict[str, Any]:
       return {"rooms": [...]}   # → window.openai.toolOutput in the widget
   ```
2. The widget HTML is served as a resource at that URI:
   ```python
   @mcp.resource("ui://widget/room-results.html", mime_type="text/html+skybridge")
   def room_results_widget() -> str: ...
   ```
3. The React component reads `window.openai.toolOutput` and renders.

## Develop
```bash
npm install
npm run dev      # then open /preview.html (rooms) or /preview-checkout.html (payment)
```
The preview pages mock `window.openai` with sample data so you can see each widget standalone.

## Build (regenerate the served HTML)
```bash
npm run build    # writes ../assets/room-results.html and ../assets/checkout.html
```
`viteSingleFile` can't bundle multiple entries in one pass, so the build runs vite once
per widget via the `WIDGET` env var. Commit the regenerated `assets/*.html` — the server
serves those files, and deployment does not run npm.

## Widgets
- `room-results` — room cards (image, name, price) for `check_availability`.
- `checkout` — "Complete payment" button for `create_order`. The payment URL comes
  from `structuredContent` so the model never retypes it (a long signed token gets
  corrupted if the model echoes it as text).
