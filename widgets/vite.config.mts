import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// Builds ONE widget HTML entry into a single self-contained file (JS+CSS inlined)
// so the MCP server can serve it directly with no separate static host.
// viteSingleFile can't do multiple entries in one pass, so `npm run build` invokes
// this once per widget via the WIDGET env var.
const widget = process.env.WIDGET || "room-results";

export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile()],
  build: {
    outDir: "../assets",
    emptyOutDir: false,
    rollupOptions: {
      input: `${widget}.html`,
    },
  },
});
