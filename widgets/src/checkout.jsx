import { createRoot } from "react-dom/client";
import { useOpenAiGlobal } from "./openai.js";
import "./index.css";

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="w-5 h-5 text-neutral-400 dark:text-neutral-500 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

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
      <div className="antialiased w-full p-5 rounded-3xl border border-black/10 dark:border-white/10 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100">
        {url ? (
          <>
            <div className="flex items-center gap-2">
              <CheckIcon />
              <div className="text-base sm:text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                Booking ready
              </div>
            </div>
            {summary && (
              <div className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{summary}</div>
            )}
            <button
              onClick={pay}
              className="mt-4 w-full rounded-xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-medium py-3 transition-transform duration-150 hover:opacity-90 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-neutral-900"
            >
              Complete payment
            </button>
            <div className="mt-2 text-xs text-center text-neutral-400 dark:text-neutral-500">
              Opens the secure Grand Alaric checkout.
            </div>
          </>
        ) : (
          <div className="py-6 text-center text-sm text-neutral-500 dark:text-neutral-400">
            {out?.error || "Couldn't create the booking. Please try again."}
          </div>
        )}
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
