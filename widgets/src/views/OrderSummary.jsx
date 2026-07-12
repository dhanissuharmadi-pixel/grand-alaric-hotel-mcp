import { idr, fmtDate } from "./icons.jsx";

export function selectionsTotal(selections, extras = []) {
  const rooms = selections.reduce((s, r) => s + r.price * r.qty, 0);
  const add = extras.reduce((s, e) => s + e.price * (e.qty || 1), 0);
  return rooms + add;
}

export function OrderSummary({ hotelName, query, selections, extras = [], onRemove }) {
  const total = selectionsTotal(selections, extras);
  const nights =
    query?.check_in && query?.check_out
      ? Math.max(1, Math.round((new Date(query.check_out) - new Date(query.check_in)) / 86400000))
      : null;
  return (
    <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-neutral-900 p-4 text-neutral-900 dark:text-neutral-100">
      <div className="text-[15px] font-semibold">{hotelName}</div>
      {query?.check_in && query?.check_out && (
        <div className="mt-1 text-[13px] text-neutral-500 dark:text-neutral-400">
          {fmtDate(query.check_in)} → {fmtDate(query.check_out)}
          {nights ? ` · ${nights} night${nights > 1 ? "s" : ""}` : ""}
        </div>
      )}
      <div className="my-3 h-px bg-black/10 dark:bg-white/10" />
      <div className="mb-1 text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Rooms</div>
      <div className="flex flex-col gap-2.5">
        {selections.map((r) => (
          <div key={r.room_id} className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-medium">
                {r.roomName} <span className="text-neutral-400">× {r.qty}</span>
              </div>
              <div className="text-xs text-neutral-500 dark:text-neutral-400">{r.rateLabel}</div>
              {onRemove && (
                <button type="button" onClick={() => onRemove(r.room_id)} className="mt-0.5 text-xs font-medium text-red-600 dark:text-red-400">
                  Remove
                </button>
              )}
            </div>
            <div className="shrink-0 text-sm font-medium tabular-nums">{idr.format(r.price * r.qty)}</div>
          </div>
        ))}
      </div>
      {extras.length > 0 && (
        <>
          <div className="mb-1 mt-3 text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Extras</div>
          <div className="flex flex-col gap-2">
            {extras.map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate">{e.name}{(e.qty || 1) > 1 ? <span className="text-neutral-400"> × {e.qty}</span> : null}</span>
                <span className="shrink-0 tabular-nums">{idr.format(e.price * (e.qty || 1))}</span>
              </div>
            ))}
          </div>
        </>
      )}
      <div className="my-3 h-px bg-black/10 dark:bg-white/10" />
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-semibold">Total</span>
        <span className="text-lg font-semibold tabular-nums">{idr.format(total)}</span>
      </div>
      <div className="mt-0.5 text-right text-xs text-neutral-500 dark:text-neutral-400">Includes taxes &amp; fees</div>
    </div>
  );
}
