import { createRoot } from "react-dom/client";
import { useOpenAiGlobal } from "./openai.js";
import "./index.css";

function App() {
  const out = useOpenAiGlobal("toolOutput");
  const theme = useOpenAiGlobal("theme");
  const url = out?.url;
  const b = out?.booking ?? {};

  // The payment URL comes from structuredContent verbatim — the model never
  // retypes it, so the link can't be corrupted. openExternal opens it for real.
  const pay = () => {
    if (url) window.openai?.openExternal?.({ href: url });
  };

  const summary = [
    b.guest_name,
    b.hotel_id,
    b.check_in && b.check_out ? `${b.check_in} → ${b.check_out}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className={theme === "dark" ? "dark" : undefined}>
      <div className="antialiased w-full p-4 border border-black/10 dark:border-white/10 rounded-2xl sm:rounded-3xl bg-white dark:bg-neutral-900 text-black dark:text-white">
        {url ? (
          <>
            <div className="text-base sm:text-lg font-medium">Booking ready</div>
            {summary && (
              <div className="mt-1 text-sm text-black/60 dark:text-white/60">{summary}</div>
            )}
            <button
              onClick={pay}
              className="mt-4 w-full rounded-xl bg-black text-white dark:bg-white dark:text-black font-medium py-3 hover:opacity-90 transition-opacity"
            >
              Complete payment
            </button>
            <div className="mt-2 text-xs text-center text-black/40 dark:text-white/40">
              Opens the secure Grand Alaric checkout.
            </div>
          </>
        ) : (
          <div className="py-6 text-center text-sm text-black/60 dark:text-white/60">
            {out?.error || "Couldn't create the booking. Please try again."}
          </div>
        )}
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
