import { useSyncExternalStore } from "react";

// Read host state from window.openai (populated by ChatGPT).
// `toolOutput` is the tool's structuredContent; `theme` is "light" | "dark".
export function useOpenAiGlobal(key) {
  return useSyncExternalStore(
    (onChange) => {
      window.addEventListener("openai:set_globals", onChange);
      return () => window.removeEventListener("openai:set_globals", onChange);
    },
    () => window.openai?.[key],
  );
}

// Call an MCP tool directly from the widget and return its structuredContent — no
// model turn, no chat message. Used for instant in-widget navigation (e.g. open a
// hotel's details or rooms without waiting for ChatGPT to call the tool). Returns null
// if the host doesn't expose callTool (e.g. local preview without a mock).
export async function callTool(name, args) {
  const result = await window.openai?.callTool?.(name, args);
  return result?.structuredContent ?? result ?? null;
}
