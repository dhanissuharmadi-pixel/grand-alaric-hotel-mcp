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

// Send a message to ChatGPT as if the user typed it, to kick off the next step
// of the booking flow (e.g. "show rooms" → check_availability, "book this room"
// → create_order). The model drives the tool call; the widget never calls write
// tools itself. Prefer the window.openai helper; fall back to the documented
// ui/message postMessage.
export function sendFollowup(text) {
  if (window.openai?.sendFollowUpMessage) {
    window.openai.sendFollowUpMessage({ prompt: text });
  } else {
    window.parent.postMessage(
      { jsonrpc: "2.0", method: "ui/message", params: { role: "user", content: [{ type: "text", text }] } },
      "*",
    );
  }
}
