import { createRoot } from "react-dom/client";
import { useOpenAiGlobal } from "./openai.js";
import "./index.css";

const idr = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

// Room names often carry a marketing suffix ("Superior City View - Book Direct &
// Save More"); split it so the room type reads clean and the offer is a subtitle.
function splitName(name) {
  const [main, ...rest] = (name || "Room").split(" - ");
  return { main, sub: rest.join(" - ") };
}

function RoomCard({ room }) {
  const { main, sub } = splitName(room.room_name);
  return (
    <div className="flex items-center gap-4 px-2 py-3 -mx-2 rounded-2xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors duration-200">
      <div className="w-20 h-20 sm:w-24 sm:h-24 shrink-0 rounded-xl overflow-hidden bg-black/5 dark:bg-white/10">
        {room.room_image && (
          <img
            src={room.room_image}
            alt={main}
            loading="lazy"
            className="w-full h-full object-cover"
          />
        )}
      </div>
      <div className="min-w-0 flex-auto">
        <div className="font-medium leading-snug text-neutral-900 dark:text-neutral-100 line-clamp-2">
          {main}
        </div>
        {sub && (
          <div className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400 line-clamp-1">
            {sub}
          </div>
        )}
      </div>
      <div className="shrink-0 text-right">
        <div className="font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
          {idr.format(room.price)}
        </div>
        <div className="text-xs text-neutral-400 dark:text-neutral-500">per night</div>
      </div>
    </div>
  );
}

function App() {
  const out = useOpenAiGlobal("toolOutput");
  const theme = useOpenAiGlobal("theme");
  const rooms = out?.rooms ?? [];

  return (
    <div className={theme === "dark" ? "dark" : undefined}>
      <div className="antialiased w-full px-4 pb-2 rounded-3xl overflow-hidden border border-black/10 dark:border-white/10 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100">
        <div className="pt-4 pb-3 border-b border-black/5 dark:border-white/10">
          <div className="text-base sm:text-lg font-semibold text-neutral-900 dark:text-neutral-100">
            Available rooms
          </div>
          <div className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">
            {rooms.length} {rooms.length === 1 ? "option" : "options"}
          </div>
        </div>
        {rooms.length === 0 ? (
          <div className="py-10 text-center text-sm text-neutral-500 dark:text-neutral-400">
            No rooms available for these dates.
          </div>
        ) : (
          <div className="flex flex-col py-1">
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
