import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "@openai/apps-sdk-ui/components/Icon";
import { Caret, idr } from "./icons.jsx";

const ROOMS_PER_PAGE = 2;

function mealLabel(roomId) {
  const id = (roomId || "").toUpperCase();
  if (id.endsWith("BAR")) return "Bed & breakfast";
  if (id.endsWith("ROO")) return "Room only";
  return null;
}

// One entry per rate (deal × meal plan); entries sharing a display name are one room
// type. Group into cards listing their rates. meta/description/facilities/images render
// when the API provides them and are hidden otherwise.
function groupRooms(rooms) {
  const groups = [];
  const byName = new Map();
  for (const r of rooms) {
    const key = r.room_name || r.room_id;
    let g = byName.get(key);
    if (!g) {
      g = { name: key, image: r.room_image, images: r.images, meta: r.meta, description: r.description, facilities: r.facilities, rates: [] };
      byName.set(key, g);
      groups.push(g);
    }
    if (!g.image && r.room_image) g.image = r.room_image;
    g.rates.push(r);
  }
  return groups;
}

function Stepper({ value, onDec, onInc }) {
  return (
    <div className="flex items-center overflow-hidden rounded-lg border border-black/10 dark:border-white/15">
      <button type="button" aria-label="Decrease" onClick={onDec} disabled={value === 0} className="h-9 w-9 text-lg text-neutral-900 dark:text-neutral-100 disabled:opacity-40">−</button>
      <span className="min-w-7 text-center text-sm font-semibold tabular-nums">{value}</span>
      <button type="button" aria-label="Increase" onClick={onInc} className="h-9 w-9 text-lg text-neutral-900 dark:text-neutral-100">+</button>
    </div>
  );
}

function Rate({ rate, qty, onInc, onDec }) {
  const [open, setOpen] = useState(false);
  const off = rate.original_price && rate.original_price > rate.price ? Math.round((1 - rate.price / rate.original_price) * 100) : 0;
  const meal = mealLabel(rate.room_id);
  const conditions = rate.conditions ?? [];
  const benefits = rate.benefits ?? [];
  const hasDetails = conditions.length > 0 || benefits.length > 0;
  const selected = qty > 0;

  return (
    <div className={`overflow-hidden rounded-xl border ${selected ? "border-neutral-900 dark:border-white" : "border-black/10 dark:border-white/15"}`}>
      <div className="p-3">
        <div className="flex items-start justify-between gap-2.5">
          <div className="min-w-0">
            <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{rate.room_name_sub || "Standard rate"}</div>
            {meal && <div className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">{meal}</div>}
          </div>
          <div className="shrink-0 text-right">
            <div className="text-sm font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">{idr.format(rate.price)}</div>
            {off > 0 && (
              <div className="mt-0.5 flex items-center justify-end gap-1.5">
                <span className="rounded px-1.5 py-px text-[11px] font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10">-{off}%</span>
                <span className="text-xs tabular-nums text-neutral-400 dark:text-neutral-500 line-through">{idr.format(rate.original_price)}</span>
              </div>
            )}
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between gap-2.5">
          {hasDetails ? (
            <button type="button" onClick={() => setOpen((o) => !o)} className="flex items-center gap-1 text-[13px] font-medium text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100">
              Details <Caret open={open} />
            </button>
          ) : (
            <span />
          )}
          <Stepper value={qty} onDec={onDec} onInc={onInc} />
        </div>
      </div>
      {hasDetails && open && (
        <div className="border-t border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] p-3">
          {conditions.map((c, i) => (
            <div key={i} className="mb-2 flex items-center gap-2.5 text-xs text-neutral-700 dark:text-neutral-300 last:mb-0">{c.label ?? c}</div>
          ))}
          {benefits.length > 0 && (
            <>
              <div className="my-3 h-px bg-black/10 dark:bg-white/10" />
              <div className="mb-2.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">+{benefits.length} Extra benefit{benefits.length > 1 ? "s" : ""} included</div>
              <div className="flex flex-col gap-2 pl-1">
                {benefits.map((b, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-black/5 dark:bg-white/10 text-[11px] font-medium text-neutral-500 dark:text-neutral-400">{i + 1}</span>
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

function RoomCard({ room, qty, setQty, onDetails }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-neutral-900">
      <button type="button" onClick={() => onDetails(room)} aria-label="View room details" className="relative block w-full">
        <div className="aspect-[16/9] bg-black/5 dark:bg-white/10">
          {room.image && <img src={room.image} alt={room.name} loading="lazy" className="h-full w-full object-cover" />}
        </div>
        <span className="absolute bottom-2 right-2 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-medium text-white">View details</span>
      </button>
      <div className="p-3">
        <h3 className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{room.name}</h3>
        {room.meta && <div className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">{room.meta}</div>}
        <div className="mt-3 flex flex-col gap-2">
          {room.rates.map((rate) => (
            <Rate key={rate.room_id} rate={rate} qty={qty[rate.room_id] || 0} onInc={() => setQty(rate.room_id, (qty[rate.room_id] || 0) + 1)} onDec={() => setQty(rate.room_id, Math.max(0, (qty[rate.room_id] || 0) - 1))} />
          ))}
        </div>
      </div>
    </div>
  );
}

function RoomDetail({ room, qty, setQty, onClose }) {
  const subtotal = room.rates.reduce((s, r) => s + r.price * (qty[r.room_id] || 0), 0);
  const facilities = room.facilities ?? [];
  const addToBooking = () => {
    if (subtotal === 0 && room.rates[0]) setQty(room.rates[0].room_id, 1);
    onClose();
  };
  return (
    <div className="w-full text-neutral-900 dark:text-neutral-100">
      <div className="mb-3 flex items-center gap-2">
        <button type="button" onClick={onClose} aria-label="Back" className="-ml-1 flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 hover:bg-black/5 dark:text-neutral-400 dark:hover:bg-white/10">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
        </button>
        <div className="text-base font-semibold">{room.name}</div>
      </div>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div>
          <div className="aspect-[16/10] overflow-hidden rounded-2xl bg-black/5 dark:bg-white/10">
            {room.image && <img src={room.image} alt={room.name} className="h-full w-full object-cover" />}
          </div>
          {facilities.length > 0 && (
            <div className="mt-4">
              <div className="mb-2 text-sm font-semibold">Room facilities</div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                {facilities.map((f, i) => (
                  <div key={i} className="text-[13px] text-neutral-700 dark:text-neutral-300">{f.name ?? f}</div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div>
          {room.meta && <div className="text-[13px] text-neutral-500 dark:text-neutral-400">{room.meta}</div>}
          {room.description && <p className="mt-2 text-[13px] leading-relaxed text-neutral-600 dark:text-neutral-300">{room.description}</p>}
          <div className="mt-4 flex flex-col gap-2.5">
            {room.rates.map((rate) => (
              <Rate key={rate.room_id} rate={rate} qty={qty[rate.room_id] || 0} onInc={() => setQty(rate.room_id, (qty[rate.room_id] || 0) + 1)} onDec={() => setQty(rate.room_id, Math.max(0, (qty[rate.room_id] || 0) - 1))} />
            ))}
          </div>
        </div>
      </div>
      <button type="button" onClick={addToBooking} className="mt-5 h-12 w-full rounded-xl bg-neutral-900 text-sm font-medium text-white dark:bg-white dark:text-neutral-900 transition-transform duration-150 hover:opacity-90 active:scale-[0.99]">
        {subtotal > 0 ? `Add to booking · ${idr.format(subtotal)}` : "Add to booking"}
      </button>
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

// Quantity-mode room list: each rate has a stepper; a footer shows the running total and
// Continue → onContinue(selections, total). Tapping a card opens an in-place room-detail
// view (image, facilities, description, rates) sharing the same quantity state.
export function RoomList({ rooms, title = "Available rooms", subtitle, onContinue, onBack }) {
  const groups = groupRooms(rooms ?? []);
  const pages = [];
  for (let i = 0; i < groups.length; i += ROOMS_PER_PAGE) pages.push(groups.slice(i, i + ROOMS_PER_PAGE));

  const scroller = useRef(null);
  const [page, setPage] = useState(0);
  const [qty, setQtyState] = useState({});
  const [detail, setDetail] = useState(null);
  const setQty = (id, n) => setQtyState((q) => ({ ...q, [id]: n }));

  const go = (idx) => {
    const el = scroller.current;
    if (el) el.scrollTo({ left: el.clientWidth * idx, behavior: "smooth" });
  };
  const onScroll = () => {
    const el = scroller.current;
    if (el) setPage(Math.round(el.scrollLeft / el.clientWidth));
  };

  const selections = groups.flatMap((g) =>
    g.rates.filter((r) => (qty[r.room_id] || 0) > 0).map((r) => ({ room_id: r.room_id, roomName: g.name, rateLabel: r.room_name_sub || "Standard rate", price: r.price, qty: qty[r.room_id] })),
  );
  const roomCount = selections.reduce((s, r) => s + r.qty, 0);
  const total = selections.reduce((s, r) => s + r.price * r.qty, 0);

  if (detail) {
    return (
      <div className="w-full">
        <RoomDetail room={detail} qty={qty} setQty={setQty} onClose={() => setDetail(null)} />
      </div>
    );
  }

  return (
    <div className="w-full text-neutral-900 dark:text-neutral-100">
      <div className="mb-3.5 flex items-center justify-between gap-3 px-1">
        <div className="flex min-w-0 items-center gap-2">
          {onBack && (
            <button type="button" onClick={onBack} aria-label="Back" className="-ml-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-neutral-500 hover:bg-black/5 dark:text-neutral-400 dark:hover:bg-white/10">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
            </button>
          )}
          <div className="min-w-0">
            <div className="truncate text-base font-semibold">{title}</div>
            {subtitle && <div className="mt-0.5 truncate text-[13px] font-medium text-neutral-500 dark:text-neutral-400">{subtitle}</div>}
          </div>
        </div>
        {pages.length > 1 && (
          <div className="flex shrink-0 gap-2">
            <NavButton side="left" onClick={() => go(Math.max(0, page - 1))} disabled={page === 0} />
            <NavButton side="right" onClick={() => go(Math.min(pages.length - 1, page + 1))} disabled={page === pages.length - 1} />
          </div>
        )}
      </div>

      {groups.length === 0 ? (
        <div className="py-10 text-center text-sm text-neutral-500 dark:text-neutral-400">No rooms available for these dates.</div>
      ) : (
        <>
          <div ref={scroller} onScroll={onScroll} className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {pages.map((pg, i) => (
              <div key={i} className="grid w-full flex-none snap-start grid-cols-1 items-start gap-3 px-1 pb-1 sm:grid-cols-2">
                {pg.map((room) => (
                  <RoomCard key={room.name} room={room} qty={qty} setQty={setQty} onDetails={setDetail} />
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
          <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-neutral-900 px-4 py-3">
            <div className="min-w-0">
              <div className="text-xs text-neutral-500 dark:text-neutral-400">{roomCount} {roomCount === 1 ? "room" : "rooms"} selected</div>
              <div className="text-lg font-semibold tabular-nums">{idr.format(total)}</div>
              <div className="text-[11px] text-neutral-500 dark:text-neutral-400">Includes taxes &amp; fees</div>
            </div>
            <button type="button" disabled={roomCount === 0} onClick={() => onContinue(selections, total)} className="h-11 shrink-0 rounded-xl bg-neutral-900 px-6 text-sm font-medium text-white dark:bg-white dark:text-neutral-900 disabled:opacity-40 transition-transform duration-150 hover:opacity-90 active:scale-[0.99]">
              Continue
            </button>
          </div>
        </>
      )}
    </div>
  );
}
