import { OrderSummary } from "./OrderSummary.jsx";
import { idr } from "./icons.jsx";

function ExtraCard({ extra, chosen, onToggle }) {
  const off = extra.original_price && extra.original_price > extra.price ? Math.round((1 - extra.price / extra.original_price) * 100) : 0;
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-neutral-900">
      <div className="relative aspect-[16/9] bg-black/5 dark:bg-white/10">
        {extra.image && <img src={extra.image} alt={extra.name} loading="lazy" className="h-full w-full object-cover" />}
        {extra.popular && (
          <span className="absolute left-2 top-2 rounded-md bg-emerald-600 px-2 py-0.5 text-[11px] font-medium text-white">Popular choice</span>
        )}
      </div>
      <div className="flex flex-auto flex-col p-3.5">
        <div className="text-sm font-medium leading-snug text-neutral-900 dark:text-neutral-100">{extra.name}</div>
        <div className="mt-auto pt-3">
          <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
            <span className="text-base font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">{idr.format(extra.price)}</span>
            {off > 0 && (
              <>
                <span className="text-xs tabular-nums text-neutral-400 dark:text-neutral-500 line-through">{idr.format(extra.original_price)}</span>
                <span className="rounded px-1.5 py-px text-[11px] font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10">-{off}%</span>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={() => onToggle(extra)}
            className={`mt-3 flex h-9 w-full items-center justify-center gap-1.5 rounded-lg text-sm font-medium transition-transform duration-150 hover:opacity-90 active:scale-[0.99] ${chosen ? "border border-neutral-900 dark:border-white text-neutral-900 dark:text-neutral-100" : "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"}`}
          >
            {chosen ? (
              <>
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
                Added
              </>
            ) : (
              "Select"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export function EnhanceStay({ hotelName, query, selections, available = [], chosen = [], onToggleExtra, onRemoveRoom, onContinue, onBack }) {
  const chosenIds = new Set(chosen.map((e) => e.id));
  return (
    <div className="w-full text-neutral-900 dark:text-neutral-100">
      <div className="mb-4 flex items-center gap-2">
        <button type="button" onClick={onBack} aria-label="Back" className="-ml-1 flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 hover:bg-black/5 dark:text-neutral-400 dark:hover:bg-white/10">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
        </button>
        <div className="text-base font-semibold">Enhance your stay</div>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-[1fr_300px]">
        <div>
          <p className="mb-4 px-1 text-[13px] text-neutral-500 dark:text-neutral-400">
            Optional extras to make your stay better — continue whenever you're ready.
          </p>
          {available.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {available.map((e) => (
                <ExtraCard key={e.id} extra={e} chosen={chosenIds.has(e.id)} onToggle={onToggleExtra} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-black/15 dark:border-white/15 px-4 py-8 text-center text-sm text-neutral-500 dark:text-neutral-400">
              No extras available for this stay.
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <OrderSummary hotelName={hotelName} query={query} selections={selections} extras={chosen} onRemove={onRemoveRoom} />
          <button
            type="button"
            onClick={onContinue}
            className="h-11 w-full rounded-xl bg-neutral-900 text-sm font-medium text-white dark:bg-white dark:text-neutral-900 transition-transform duration-150 hover:opacity-90 active:scale-[0.99]"
          >
            Continue to guest details
          </button>
        </div>
      </div>
    </div>
  );
}
