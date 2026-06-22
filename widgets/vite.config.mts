import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// Builds each widget HTML entry into a single self-contained file (JS+CSS inlined)
// so the MCP server can serve it directly with no separate static host.
export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile()],
  build: {
    outDir: "../assets",
    emptyOutDir: false,
    rollupOptions: {
      input: "room-results.html",
    },
  },
});
