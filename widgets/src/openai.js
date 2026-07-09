import { useSyncExternalStore } from "react";

export function useOpenAiGlobal(key) {
  return useSyncExternalStore(
    (onChange) => {
      window.addEventListener("openai:set_globals", onChange);
      return () => window.removeEventListener("openai:set_globals", onChange);
    },
    () => window.openai?.[key],
  );
}

// Returns null if the host doesn't expose callTool (e.g. local preview without a mock).
export async function callTool(name, args) {
  const result = await window.openai?.callTool?.(name, args);
  return result?.structuredContent ?? result ?? null;
}
