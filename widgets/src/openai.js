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
