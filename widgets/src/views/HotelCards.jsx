import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "@openai/apps-sdk-ui/components/Icon";
import { Icon, Star, Pin, idr } from "./icons.jsx";

const HOTELS_PER_PAGE = 2;

function HotelCard({ hotel, onDetails, onViewRooms }) {
  const rating = Number(hotel.star_rating ?? hotel.stars ?? 0);
  const priceFrom = hotel.price_from ?? hotel.from_price;
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-neutral-900">
      <button type="button" onClick={() => onDetails(hotel)} aria-label="View hotel details" className="relative block w-full">
        <div className="relative aspect-[16/9] bg-black/5 dark:bg-white/10">
          <span className="absolute inset-0 flex items-center justify-center text-neutral-300 dark:text-neutral-600"><Icon name="grid" className="h-6 w-6" /></span>
          {hotel.image && <img src={hotel.image} alt={hotel.hotel_name} loading="lazy" onError={(e) => { e.currentTarget.style.display = "none"; }} className="relative h-full w-full object-cover" />}
        </div>
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

function NavButton({ side, onClick, disabled }) {
  const Chevron = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={side === "left" ? "Previous" : "Next"}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-black/10 dark:border-white/15 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 transition-colors hover:bg-black/5 disabled:opacity-40 disabled:hover:bg-transparent dark:hover:bg-white/10">
      <Chevron className="h-5 w-5" aria-hidden="true" />
    </button>
  );
}

export function HotelCards({ hotels, location, onDetails, onViewRooms }) {
  const list = hotels ?? [];
  const pages = [];
  for (let i = 0; i < list.length; i += HOTELS_PER_PAGE) pages.push(list.slice(i, i + HOTELS_PER_PAGE));

  const scroller = useRef(null);
  const [page, setPage] = useState(0);

  const go = (idx) => {
    const el = scroller.current;
    if (el) el.scrollTo({ left: el.clientWidth * idx, behavior: "smooth" });
  };
  const onScroll = () => {
    const el = scroller.current;
    if (el) setPage(Math.round(el.scrollLeft / el.clientWidth));
  };

  return (
    <div className="w-full text-neutral-900 dark:text-neutral-100">
      <div className="mb-3.5 flex items-center justify-between gap-3 px-1">
        <div className="min-w-0">
          <div className="truncate text-base font-semibold">{location ? `Hotels in ${location}` : "Hotels"}</div>
          <div className="mt-0.5 text-[13px] text-neutral-500 dark:text-neutral-400">
            {list.length} {list.length === 1 ? "stay" : "stays"}
          </div>
        </div>
        {pages.length > 1 && (
          <div className="flex shrink-0 gap-2">
            <NavButton side="left" onClick={() => go(Math.max(0, page - 1))} disabled={page === 0} />
            <NavButton side="right" onClick={() => go(Math.min(pages.length - 1, page + 1))} disabled={page === pages.length - 1} />
          </div>
        )}
      </div>

      {list.length === 0 ? (
        <div className="py-10 text-center text-sm text-neutral-500 dark:text-neutral-400">No hotels found for this search.</div>
      ) : (
        <>
          <div ref={scroller} onScroll={onScroll} className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {pages.map((pg, i) => (
              <div key={i} className="grid w-full flex-none snap-start grid-cols-1 items-stretch gap-3 px-1 pb-1 sm:grid-cols-2">
                {pg.map((h) => (
                  <HotelCard key={h.hotel_id} hotel={h} onDetails={onDetails} onViewRooms={onViewRooms} />
                ))}
              </div>
            ))}
          </div>
          {pages.length > 1 && (
            <div className="mt-4 flex justify-center gap-1.5">
              {pages.map((_, i) => (
                <button key={i} type="button" onClick={() => go(i)} aria-label={`Page ${i + 1}`} className={`h-1.5 w-1.5 rounded-full transition-colors ${i === page ? "bg-neutral-900 dark:bg-white" : "bg-black/20 dark:bg-white/25"}`} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
