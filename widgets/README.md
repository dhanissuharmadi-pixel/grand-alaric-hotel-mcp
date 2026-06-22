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
npm run dev      # open http://localhost:<port>/preview.html — mocks window.openai with sample rooms
```

## Build (regenerate the served HTML)
```bash
npm run build    # writes ../assets/room-results.html
```
Commit the regenerated `assets/*.html` — the server serves that file, and deployment
does not run npm.

## Widgets
- `room-results` — room cards (image, name, price) for `check_availability`.
