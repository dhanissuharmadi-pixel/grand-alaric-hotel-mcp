import { createRoot } from "react-dom/client";
import { useRef } from "react";
import { useOpenAiGlobal, sendFollowup } from "./openai.js";
import "./index.css";

const idr = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

// Clicking "Book this room" sends a message to ChatGPT as if the user typed it,
// naming the chosen room (id + hotel + dates from check_availability's `query`
// echo). The model then collects guest details and calls create_order — the widget
// never places the order itself (it has no guest info). Prefer the window.openai
// helper; fall back to the documented ui/message postMessage.
function bookRoom(room, query) {
  const q = query || {};
  const where = q.hotel_id ? ` at ${q.hotel_id}` : "";
  const stay = q.check_in && q.check_out ? ` for ${q.check_in} → ${q.check_out}` : "";
  const who = q.guests ? `, ${q.guests} guest${q.guests > 1 ? "s" : ""}` : "";
  const text =
    `I'd like to book the ${room.room_name} room (${room.room_id})${where}${stay}${who}. ` +
    `Please ask me for the name, email, phone, and nationality you need, then create the booking.`;
  sendFollowup(text);
}

function Arrow({ side, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Scroll left" : "Scroll right"}
      className={`hidden md:flex absolute top-16 z-10 w-9 h-9 items-center justify-center rounded-full border border-black/10 dark:border-white/15 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-sm hover:bg-black/5 dark:hover:bg-white/10 transition-colors ${side === "left" ? "left-2" : "right-2"}`}
    >
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {side === "left" ? <path d="m15 18-6-6 6-6" /> : <path d="m9 18 6-6-6-6" />}
      </svg>
    </button>
  );
}

function RoomCard({ room, query }) {
  return (
    <div className="flex-none w-[65vw] sm:w-[220px] snap-start flex flex-col rounded-2xl overflow-hidden border border-black/10 dark:border-white/10 bg-white dark:bg-neutral-900">
      <div className="aspect-[4/3] bg-black/5 dark:bg-white/10">
        {room.room_image && (
          <img
            src={room.room_image}
            alt={room.room_name}
            loading="lazy"
            className="w-full h-full object-cover"
          />
        )}
      </div>
      <div className="flex flex-col flex-auto p-3.5">
        <div className="font-medium leading-snug text-neutral-900 dark:text-neutral-100 line-clamp-2">
          {room.room_name}
        </div>
        <div className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400 line-clamp-1 min-h-[16px]">
          {room.room_name_sub || " "}
        </div>
        {/* price + CTA anchored to the card bottom so they align across cards of
            differing name length; the strikethrough line is always reserved so
            discounted and full-price rooms share a price baseline. */}
        <div className="mt-auto pt-3">
          <div className="h-4 text-xs tabular-nums text-neutral-400 dark:text-neutral-500 line-through">
            {room.original_price ? idr.format(room.original_price) : " "}
          </div>
          <div className="flex items-baseline gap-1.5 whitespace-nowrap">
            <span className="font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
              {idr.format(room.price)}
            </span>
            <span className="text-xs text-neutral-400 dark:text-neutral-500">/ night</span>
          </div>
          <button
            type="button"
            onClick={() => bookRoom(room, query)}
            className="mt-3 w-full rounded-xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 text-sm font-medium py-2.5 transition-transform duration-150 hover:opacity-90 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-neutral-900"
          >
            Book this room
          </button>
        </div>
      </div>
    </div>
  );
}

function App() {
  const out = useOpenAiGlobal("toolOutput");
  const theme = useOpenAiGlobal("theme");
  const rooms = out?.rooms ?? [];
  const query = out?.query;
  const scroller = useRef(null);
  const scroll = (dx) => scroller.current?.scrollBy({ left: dx, behavior: "smooth" });

  return (
    <div className={theme === "dark" ? "dark" : undefined}>
      <div className="antialiased w-full rounded-3xl overflow-hidden border border-black/10 dark:border-white/10 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100">
        <div className="px-4 pt-4 pb-3">
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
          <div className="relative">
            <div
              ref={scroller}
              className="flex items-stretch gap-3 overflow-x-auto snap-x snap-mandatory px-4 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {rooms.map((room) => (
                <RoomCard key={room.room_id} room={room} query={query} />
              ))}
            </div>
            <Arrow side="left" onClick={() => scroll(-240)} />
            <Arrow side="right" onClick={() => scroll(240)} />
          </div>
        )}
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
