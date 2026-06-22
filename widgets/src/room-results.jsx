import { useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";

// --- read host state from window.openai (populated by ChatGPT) ----------------
// `toolOutput` is the tool's structuredContent; `theme` is "light" | "dark".
function useOpenAiGlobal(key) {
  return useSyncExternalStore(
    (onChange) => {
      window.addEventListener("openai:set_globals", onChange);
      return () => window.removeEventListener("openai:set_globals", onChange);
    },
    () => window.openai?.[key],
  );
}

const idr = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

function formatPrice(price, currency) {
  if (typeof price !== "number") return "";
  if (currency && currency !== "IDR") {
    return `${currency} ${price.toLocaleString()}`;
  }
  return idr.format(price);
}

function RoomCard({ room }) {
  return (
    <div className="flex items-center gap-3 sm:gap-4 px-2 py-3 -mx-2 rounded-2xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
      <div className="w-20 h-20 sm:w-24 sm:h-24 shrink-0 rounded-xl overflow-hidden bg-black/5 dark:bg-white/10">
        {room.room_image ? (
          <img
            src={room.room_image}
            alt={room.room_name || "Room"}
            loading="lazy"
            className="w-full h-full object-cover"
          />
        ) : null}
      </div>
      <div className="min-w-0 flex-auto">
        <div className="text-sm sm:text-base font-medium leading-snug line-clamp-2">
          {room.room_name || "Room"}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-sm sm:text-base font-semibold">
          {formatPrice(room.price, room.currency)}
        </div>
        <div className="text-xs text-black/50 dark:text-white/50">per night</div>
      </div>
    </div>
  );
}

function App() {
  const toolOutput = useOpenAiGlobal("toolOutput");
  const theme = useOpenAiGlobal("theme");
  const rooms = toolOutput?.rooms ?? [];

  return (
    <div className={theme === "dark" ? "dark" : undefined}>
      <div className="antialiased w-full px-4 pb-2 border border-black/10 dark:border-white/10 rounded-2xl sm:rounded-3xl overflow-hidden bg-white dark:bg-neutral-900 text-black dark:text-white">
        <div className="py-4 border-b border-black/5 dark:border-white/10">
          <div className="text-base sm:text-lg font-medium">Available rooms</div>
          <div className="text-sm text-black/60 dark:text-white/60">
            {rooms.length} {rooms.length === 1 ? "option" : "options"} found
          </div>
        </div>
        {rooms.length === 0 ? (
          <div className="py-8 text-center text-sm text-black/50 dark:text-white/50">
            No rooms available for these dates.
          </div>
        ) : (
          <div className="flex flex-col">
            {rooms.map((room) => (
              <RoomCard key={room.room_id} room={room} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
