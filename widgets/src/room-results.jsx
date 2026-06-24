import { createRoot } from "react-dom/client";
import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "@openai/apps-sdk-ui/components/Icon";
import { useOpenAiGlobal, sendFollowup } from "./openai.js";
import "./index.css";

const idr = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const ROOMS_PER_PAGE = 2;

// Meal plan from the room_id suffix (…ROO = room only, …BAR = bed & breakfast).
function mealLabel(roomId) {
  const id = (roomId || "").toUpperCase();
  if (id.endsWith("BAR")) return "Bed & breakfast";
  if (id.endsWith("ROO")) return "Room only";
  return null;
}

// check_availability returns one entry per rate (deal × meal plan); entries that share
// a display name are the same room type. Group them into room cards, each listing its
// rates. Future per-rate fields (meta, conditions, benefits) are read when present and
// hidden otherwise — so this renders today's flat data and fills in as the API grows.
function groupRooms(rooms) {
  const groups = [];
  const byName = new Map();
  for (const r of rooms) {
    const key = r.room_name || r.room_id;
    let g = byName.get(key);
    if (!g) {
      g = { name: key, image: r.room_image, meta: r.meta, rates: [] };
      byName.set(key, g);
      groups.push(g);
    }
    if (!g.image && r.room_image) g.image = r.room_image;
    if (!g.meta && r.meta) g.meta = r.meta;
    g.rates.push(r);
  }
  return groups;
}

// Selecting a rate hands the chosen rate's room_id back to the model, which collects
// guest details and calls create_order — the widget never books directly.
function selectRate(rate, roomName, query) {
  const q = query || {};
  const where = q.hotel_id ? ` at ${q.hotel_id}` : "";
  const stay = q.check_in && q.check_out ? ` for ${q.check_in} → ${q.check_out}` : "";
  const who = q.guests ? `, ${q.guests} guest${q.guests > 1 ? "s" : ""}` : "";
  sendFollowup(
    `I'd like to book the ${roomName} room — ${rate.room_name_sub || "standard rate"} (${rate.room_id})${where}${stay}${who}. ` +
      `Please ask me for the name, email, phone, and nationality you need, then create the booking.`,
  );
}

function viewDetails(roomName) {
  sendFollowup(`Tell me more about the ${roomName} room — what's included, the size, and the view.`);
}

function Caret({ open }) {
  return (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {open ? <path d="m6 15 6-6 6 6" /> : <path d="m6 9 6 6 6-6" />}
    </svg>
  );
}

function Rate({ rate, roomName, query }) {
  const [open, setOpen] = useState(false);
  const off =
    rate.original_price && rate.original_price > rate.price
      ? Math.round((1 - rate.price / rate.original_price) * 100)
      : 0;
  const meal = mealLabel(rate.room_id);
  const conditions = rate.conditions ?? [];
  const benefits = rate.benefits ?? [];
  const hasDetails = conditions.length > 0 || benefits.length > 0;

  return (
    <div className="border border-black/10 dark:border-white/15 rounded-xl overflow-hidden">
      <div className="p-3">
        <div className="flex items-start justify-between gap-2.5">
          <div className="min-w-0">
            <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
              {rate.room_name_sub || "Standard rate"}
            </div>
            {meal && <div className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">{meal}</div>}
          </div>
          <div className="shrink-0 text-right">
            <div className="text-sm font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
              {idr.format(rate.price)}
            </div>
            {off > 0 && (
              <div className="mt-0.5 flex items-center justify-end gap-1.5">
                <span className="rounded px-1.5 py-px text-[11px] font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10">
                  -{off}%
                </span>
                <span className="text-xs tabular-nums text-neutral-400 dark:text-neutral-500 line-through">
                  {idr.format(rate.original_price)}
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between gap-2.5">
          {hasDetails ? (
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              className="flex items-center gap-1 text-[13px] font-medium text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"
            >
              Details <Caret open={open} />
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={() => selectRate(rate, roomName, query)}
            className="h-9 shrink-0 rounded-lg bg-neutral-900 px-5 text-sm font-medium text-white dark:bg-white dark:text-neutral-900 transition-transform duration-150 hover:opacity-90 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500"
          >
            Select
          </button>
        </div>
      </div>
      {hasDetails && open && (
        <div className="border-t border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] p-3">
          {conditions.map((c, i) => (
            <div key={i} className="mb-2 flex items-center gap-2.5 text-xs text-neutral-700 dark:text-neutral-300 last:mb-0">
              {c.label ?? c}
            </div>
          ))}
          {benefits.length > 0 && (
            <>
              <div className="my-3 h-px bg-black/10 dark:bg-white/10" />
              <div className="mb-2.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                +{benefits.length} Extra benefit{benefits.length > 1 ? "s" : ""} included
              </div>
              <div className="flex flex-col gap-2 pl-1">
                {benefits.map((b, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-black/5 dark:bg-white/10 text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                      {i + 1}
                    </span>
                    <span className="text-xs leading-snug text-neutral-700 dark:text-neutral-300">{b.text ?? b}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function RoomCard({ room, query }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-neutral-900">
      <button type="button" onClick={() => viewDetails(room.name)} aria-label="View room details" className="relative block w-full">
        <div className="aspect-[16/10] bg-black/5 dark:bg-white/10">
          {room.image && <img src={room.image} alt={room.name} loading="lazy" className="h-full w-full object-cover" />}
        </div>
        <span className="absolute bottom-2 right-2 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-medium text-white">
          View details
        </span>
      </button>
      <div className="p-3.5">
        <h3 className="text-[15px] font-medium text-neutral-900 dark:text-neutral-100">{room.name}</h3>
        {room.meta && <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{room.meta}</div>}
        <div className="mt-3.5 flex flex-col gap-2.5">
          {room.rates.map((rate) => (
            <Rate key={rate.room_id} rate={rate} roomName={room.name} query={query} />
          ))}
        </div>
      </div>
    </div>
  );
}

function NavButton({ side, onClick, disabled }) {
  const Chevron = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={side === "left" ? "Previous" : "Next"}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-black/10 dark:border-white/15 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
    >
      <Chevron className="h-5 w-5" aria-hidden="true" />
    </button>
  );
}

function App() {
  const out = useOpenAiGlobal("toolOutput");
  const theme = useOpenAiGlobal("theme");
  const query = out?.query;
  const groups = groupRooms(out?.rooms ?? []);
  const pages = [];
  for (let i = 0; i < groups.length; i += ROOMS_PER_PAGE) pages.push(groups.slice(i, i + ROOMS_PER_PAGE));

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

  const hotelName = out?.hotel?.hotel_name ?? out?.hotel_name ?? "Available rooms";
  const stay =
    query?.check_in && query?.check_out
      ? `${query.check_in} → ${query.check_out}${query.guests ? ` · ${query.guests} guests` : ""}`
      : null;

  return (
    <div className={theme === "dark" ? "dark" : undefined}>
      <div className="antialiased w-full text-neutral-900 dark:text-neutral-100">
        <div className="mb-3.5 flex items-center justify-between gap-3 px-1">
          <div className="flex min-w-0 flex-wrap items-baseline gap-2.5">
            <span className="text-base font-semibold">{hotelName}</span>
            {stay && <span className="text-[13px] font-medium text-neutral-500 dark:text-neutral-400">{stay}</span>}
          </div>
          {pages.length > 1 && (
            <div className="flex shrink-0 gap-2">
              <NavButton side="left" onClick={() => go(Math.max(0, page - 1))} disabled={page === 0} />
              <NavButton side="right" onClick={() => go(Math.min(pages.length - 1, page + 1))} disabled={page === pages.length - 1} />
            </div>
          )}
        </div>

        {groups.length === 0 ? (
          <div className="py-10 text-center text-sm text-neutral-500 dark:text-neutral-400">
            No rooms available for these dates.
          </div>
        ) : (
          <>
            <div
              ref={scroller}
              onScroll={onScroll}
              className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {pages.map((pg, i) => (
                <div key={i} className="grid w-full flex-none snap-start grid-cols-1 items-start gap-4 px-1 pb-1 sm:grid-cols-2">
                  {pg.map((room) => (
                    <RoomCard key={room.name} room={room} query={query} />
                  ))}
                </div>
              ))}
            </div>
            {pages.length > 1 && (
              <div className="mt-4 flex justify-center gap-1.5">
                {pages.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => go(i)}
                    aria-label={`Page ${i + 1}`}
                    className={`h-1.5 w-1.5 rounded-full transition-colors ${i === page ? "bg-neutral-900 dark:bg-white" : "bg-black/20 dark:bg-white/25"}`}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
