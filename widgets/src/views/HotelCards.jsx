import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "@openai/apps-sdk-ui/components/Icon";
import { Icon, Star, Pin, idr } from "./icons.jsx";

function HotelCard({ hotel, onDetails, onViewRooms }) {
  const rating = Number(hotel.star_rating ?? hotel.stars ?? 0);
  const priceFrom = hotel.price_from ?? hotel.from_price;
  return (
    <div className="flex w-[260px] flex-none snap-start flex-col overflow-hidden rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-neutral-900">
      <button type="button" onClick={() => onDetails(hotel)} aria-label="View hotel details" className="relative block h-40 w-full bg-black/5 dark:bg-white/10">
        <span className="absolute inset-0 flex items-center justify-center text-neutral-300 dark:text-neutral-600">
          <Icon name="grid" className="h-6 w-6" />
        </span>
        {hotel.image && <img src={hotel.image} alt={hotel.hotel_name} loading="lazy" onError={(e) => { e.currentTarget.style.display = "none"; }} className="relative h-full w-full object-cover" />}
      </button>
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
          <button type="button" onClick={() => onDetails(hotel)} className="mb-1.5 block text-[12.5px] font-medium text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100">
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
            onClick={() => onViewRooms(hotel)}
            className="mt-3 w-full rounded-xl bg-neutral-900 py-2.5 text-sm font-medium text-white dark:bg-white dark:text-neutral-900 transition-transform duration-150 hover:opacity-90 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500"
          >
            View rooms
          </button>
        </div>
      </div>
    </div>
  );
}

// Presentational hotel-list carousel. `onDetails(hotel)` and `onViewRooms(hotel)` fire
// per card; the controller decides whether that's an instant callTool or a model handoff.
export function HotelCards({ hotels, location, onDetails, onViewRooms }) {
  const scroller = useRef(null);
  const scroll = (dx) => scroller.current?.scrollBy({ left: dx, behavior: "smooth" });

  return (
    <div className="w-full text-neutral-900 dark:text-neutral-100">
      <div className="mb-1 flex items-end justify-between gap-3 px-1">
        <div className="min-w-0">
          <div className="text-base font-semibold">{location ? `Hotels in ${location}` : "Hotels"}</div>
          <div className="mt-0.5 text-[13px] text-neutral-500 dark:text-neutral-400">
            {hotels.length} {hotels.length === 1 ? "stay" : "stays"}
          </div>
        </div>
        {hotels.length > 1 && (
          <div className="hidden shrink-0 gap-2 sm:flex">
            <button type="button" onClick={() => scroll(-276)} aria-label="Previous" className="flex h-9 w-9 items-center justify-center rounded-full border border-black/10 dark:border-white/15 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 transition-colors hover:bg-black/5 dark:hover:bg-white/10">
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>
            <button type="button" onClick={() => scroll(276)} aria-label="Next" className="flex h-9 w-9 items-center justify-center rounded-full border border-black/10 dark:border-white/15 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 transition-colors hover:bg-black/5 dark:hover:bg-white/10">
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

      {hotels.length === 0 ? (
        <div className="py-10 text-center text-sm text-neutral-500 dark:text-neutral-400">No hotels found for this search.</div>
      ) : (
        <div ref={scroller} className="flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-2 pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {hotels.map((h) => (
            <HotelCard key={h.hotel_id} hotel={h} onDetails={onDetails} onViewRooms={onViewRooms} />
          ))}
        </div>
      )}
    </div>
  );
}
