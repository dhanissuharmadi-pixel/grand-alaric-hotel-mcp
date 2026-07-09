import { useState } from "react";

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parse = (s) => (s ? new Date(s + "T00:00:00") : null);

function Month({ year, month, checkin, checkout, today, onPick }) {
  const first = new Date(year, month, 1);
  const lead = first.getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(new Date(year, month, d));
  const ci = parse(checkin);
  const co = parse(checkout);

  return (
    <div className="flex-1">
      <div className="mb-2 text-center text-sm font-semibold text-neutral-900 dark:text-neutral-100">{MONTHS[month]} {year}</div>
      <div className="grid grid-cols-7 gap-y-1">
        {DOW.map((d) => (
          <div key={d} className="py-1 text-center text-[11px] font-medium text-neutral-400 dark:text-neutral-500">{d}</div>
        ))}
        {cells.map((cell, i) => {
          if (!cell) return <div key={i} />;
          const past = cell < today;
          const isCi = ci && cell.getTime() === ci.getTime();
          const isCo = co && cell.getTime() === co.getTime();
          const inRange = ci && co && cell > ci && cell < co;
          const edge = isCi || isCo;
          return (
            <div key={i} className={`flex justify-center ${inRange ? "bg-neutral-100 dark:bg-white/10" : ""} ${isCi && co ? "rounded-l-full bg-neutral-100 dark:bg-white/10" : ""} ${isCo ? "rounded-r-full bg-neutral-100 dark:bg-white/10" : ""}`}>
              <button
                type="button"
                disabled={past}
                onClick={() => onPick(cell)}
                className={`h-9 w-9 rounded-full text-sm tabular-nums transition-colors ${
                  edge
                    ? "bg-neutral-900 font-semibold text-white dark:bg-white dark:text-neutral-900"
                    : past
                      ? "text-neutral-300 dark:text-neutral-600"
                      : "text-neutral-900 hover:bg-black/5 dark:text-neutral-100 dark:hover:bg-white/10"
                }`}
              >
                {cell.getDate()}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function Calendar({ value, onChange }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [base, setBase] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  const pick = (day) => {
    const ci = parse(value.checkin);
    if (!ci || value.checkout || day <= ci) onChange({ checkin: iso(day), checkout: "" });
    else onChange({ checkin: value.checkin, checkout: iso(day) });
  };

  const m2 = new Date(base.getFullYear(), base.getMonth() + 1, 1);
  const canPrev = base > new Date(today.getFullYear(), today.getMonth(), 1);

  return (
    <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-neutral-900 p-4">
      <div className="mb-1 flex items-center justify-between">
        <button type="button" aria-label="Previous month" disabled={!canPrev} onClick={() => setBase(new Date(base.getFullYear(), base.getMonth() - 1, 1))} className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-700 hover:bg-black/5 disabled:opacity-30 dark:text-neutral-300 dark:hover:bg-white/10">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
        </button>
        <button type="button" aria-label="Next month" onClick={() => setBase(new Date(base.getFullYear(), base.getMonth() + 1, 1))} className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-700 hover:bg-black/5 dark:text-neutral-300 dark:hover:bg-white/10">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
        </button>
      </div>
      <div className="flex gap-6">
        <Month year={base.getFullYear()} month={base.getMonth()} checkin={value.checkin} checkout={value.checkout} today={today} onPick={pick} />
        <div className="hidden sm:block flex-1">
          <Month year={m2.getFullYear()} month={m2.getMonth()} checkin={value.checkin} checkout={value.checkout} today={today} onPick={pick} />
        </div>
      </div>
    </div>
  );
}
