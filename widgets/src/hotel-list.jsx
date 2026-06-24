import { createRoot } from "react-dom/client";
import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "@openai/apps-sdk-ui/components/Icon";
import { useOpenAiGlobal, sendFollowup } from "./openai.js";
import "./index.css";

const idr = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

function Star() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-amber-500" fill="currentColor" aria-hidden="true">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26" />
    </svg>
  );
}

function Pin() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

// Both actions hand off to the model: "Hotel details" → get_hotel_details (details
// card), "View rooms" → check_availability (room list). The widget calls no tools itself.
function showDetails(hotel) {
  sendFollowup(`Show me the details for ${hotel.hotel_name ?? "this hotel"}${hotel.hotel_id ? ` (hotel ${hotel.hotel_id})` : ""}.`);
}
function viewRooms(hotel) {
  sendFollowup(
    `I'd like to see the rooms at ${hotel.hotel_name ?? "this hotel"}${hotel.hotel_id ? ` (hotel ${hotel.hotel_id})` : ""}. ` +
      `Please check availability.`,
  );
}

function HotelCard({ hotel }) {
  const rating = Number(hotel.star_rating ?? hotel.stars ?? 0);
  const priceFrom = hotel.price_from ?? hotel.from_price;
  return (
    <div className="flex w-[260px] flex-none snap-start flex-col overflow-hidden rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-neutral-900">
      <div className="h-40 bg-black/5 dark:bg-white/10">
        {hotel.image && <img src={hotel.image} alt={hotel.hotel_name} loading="lazy" className="h-full w-full object-cover" />}
      </div>
      <div className="flex flex-auto flex-col p-3.5">
        {rating > 0 && (
          <div className="flex items-center gap-0.5">
            {Array.from({ length: rating }, (_, i) => (
              <Star key={i} />
            ))}
          </div>
        )}
        <h3 className="mt-2 text-[15px] font-medium leading-snug text-neutral-900 dark:text-neutral-100">{hotel.hotel_name}</h3>
        {hotel.area && (
          <div className="mt-1.5 flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
            <Pin />
            <span className="truncate">{hotel.area}</span>
          </div>
        )}
        <div className="mt-auto pt-3.5">
          <button
            type="button"
            onClick={() => showDetails(hotel)}
            className="mb-1.5 block text-[12.5px] font-medium text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
          >
            Hotel details →
          </button>
          {priceFrom != null && (
            <div className="flex items-baseline gap-1">
              <span className="text-[11px] text-neutral-500 dark:text-neutral-400">From</span>
              <span className="text-[17px] font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">{idr.format(priceFrom)}</span>
              <span className="text-[11px] text-neutral-500 dark:text-neutral-400">/ night</span>
            </div>
          )}
          <button
            type="button"
            onClick={() => viewRooms(hotel)}
            className="mt-3 w-full rounded-xl bg-neutral-900 py-2.5 text-sm font-medium text-white dark:bg-white dark:text-neutral-900 transition-transform duration-150 hover:opacity-90 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500"
          >
            View rooms
          </button>
        </div>
      </div>
    </div>
  );
}

function NavButton({ side, onClick }) {
  const Chevron = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Previous" : "Next"}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-black/10 dark:border-white/15 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
    >
      <Chevron className="h-5 w-5" aria-hidden="true" />
    </button>
  );
}

function App() {
  const out = useOpenAiGlobal("toolOutput");
  const theme = useOpenAiGlobal("theme");
  const hotels = out?.hotels ?? [];
  const location = out?.query?.location;
  const scroller = useRef(null);
  const scroll = (dx) => scroller.current?.scrollBy({ left: dx, behavior: "smooth" });

  return (
    <div className={theme === "dark" ? "dark" : undefined}>
      <div className="antialiased w-full text-neutral-900 dark:text-neutral-100">
        <div className="mb-1 flex items-end justify-between gap-3 px-1">
          <div className="min-w-0">
            <div className="text-base font-semibold">{location ? `Hotels in ${location}` : "Hotels"}</div>
            <div className="mt-0.5 text-[13px] text-neutral-500 dark:text-neutral-400">
              {hotels.length} {hotels.length === 1 ? "stay" : "stays"}
            </div>
          </div>
          {hotels.length > 1 && (
            <div className="hidden shrink-0 gap-2 sm:flex">
              <NavButton side="left" onClick={() => scroll(-276)} />
              <NavButton side="right" onClick={() => scroll(276)} />
            </div>
          )}
        </div>

        {hotels.length === 0 ? (
          <div className="py-10 text-center text-sm text-neutral-500 dark:text-neutral-400">
            No hotels found for this search.
          </div>
        ) : (
          <div
            ref={scroller}
            className="flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-2 pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {hotels.map((h) => (
              <HotelCard key={h.hotel_id} hotel={h} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
