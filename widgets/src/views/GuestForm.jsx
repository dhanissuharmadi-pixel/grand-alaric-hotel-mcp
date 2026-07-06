import { useState } from "react";
import { OrderSummary } from "./OrderSummary.jsx";

// ponytail: only Mr=3 is documented; Mrs/Ms codes are guessed. Confirm against the
// backend and fix these values before relying on the title.
const TITLES = [
  { label: "Mr.", value: 3 },
  { label: "Mrs.", value: 2 },
  { label: "Ms.", value: 1 },
];

// /nationality items vary in field names — read defensively.
function natCode(n) { return n.nation_code ?? n.code ?? n.id ?? ""; }
function natName(n) { return n.nationality ?? n.name ?? n.country ?? natCode(n); }
function natPhone(n) { return n.phone_code ?? n.phonecode ?? n.calling_code ?? n.phone ?? ""; }

const labelCls = "text-sm font-medium text-neutral-900 dark:text-neutral-100";
const inputCls = "mt-1.5 h-11 w-full rounded-xl border bg-white dark:bg-neutral-900 px-3 text-sm text-neutral-900 dark:text-neutral-100";
const ok = "border-black/10 dark:border-white/15";
const bad = "border-red-400 dark:border-red-500";
const errCls = "mt-1 text-[13px] text-red-600 dark:text-red-400";

// Type-to-filter dropdown — replaces a 176-option native <select> so the guest can find a
// country by typing instead of scrolling. `selectedText` is shown when collapsed; options
// match on label (country) or hint (phone code).
function Combobox({ options, value, onChange, placeholder, selectedText, triggerClassName, wrapperClassName = "" }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ql = q.trim().toLowerCase();
  const filtered = ql
    ? options.filter((o) => o.label.toLowerCase().includes(ql) || (o.hint ?? "").toLowerCase().includes(ql))
    : options;
  return (
    <div className={`relative ${wrapperClassName}`}>
      <input
        type="text"
        role="combobox"
        aria-expanded={open}
        autoComplete="off"
        value={open ? q : selectedText ?? ""}
        placeholder={placeholder}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => { setOpen(true); setQ(""); }}
        onBlur={() => setTimeout(() => { setOpen(false); setQ(""); }, 150)}
        className={triggerClassName}
      />
      {open && (
        <div className="absolute left-0 z-30 mt-1 max-h-60 w-max min-w-full max-w-[20rem] overflow-y-auto rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-neutral-900 shadow-xl [scrollbar-width:thin]">
          {filtered.length === 0 ? (
            <div className="px-3 py-2.5 text-sm text-neutral-500 dark:text-neutral-400">No matches</div>
          ) : (
            filtered.map((o) => (
              <button
                key={`${o.value}-${o.label}`}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { onChange(o.value); setOpen(false); setQ(""); }}
                className={`flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10 ${o.value === value ? "bg-black/5 dark:bg-white/10" : ""}`}
              >
                <span className="truncate text-neutral-900 dark:text-neutral-100">{o.label}</span>
                {o.hint && <span className="shrink-0 text-xs tabular-nums text-neutral-500 dark:text-neutral-400">{o.hint}</span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// (No `paying` prop: the parent swaps the whole form for a spinner while the order
// is in flight, so a disabled/processing button state here would be unreachable.)
export function GuestForm({ hotelName, query, selections, extras, nationalities = [], onPay, onBack, error }) {
  const [salutation, setSalutation] = useState(3);
  const [name, setName] = useState("");
  const [phoneCode, setPhoneCode] = useState("+62");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [nation, setNation] = useState("");
  const [touched, setTouched] = useState(false);

  const natOptions = nationalities.map((n) => ({ value: natCode(n), label: natName(n), hint: natPhone(n) }));
  const phoneOptions = (nationalities.length ? nationalities : [{ phone_code: "+62", name: "Indonesia" }])
    .filter((n) => natPhone(n))
    .map((n) => ({ value: natPhone(n), label: natName(n), hint: natPhone(n) }));
  const selectedNatName = natOptions.find((o) => o.value === nation)?.label ?? "";

  const errs = {
    name: !name.trim() ? "Please enter your full name" : null,
    phone: !/^\d{6,}$/.test(phone) ? "Enter a valid mobile number" : null,
    email: !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? "Enter a valid email address" : null,
    nation: !nation ? "Please select your nationality" : null,
  };
  const valid = !errs.name && !errs.phone && !errs.email && !errs.nation;

  const submit = () => {
    setTouched(true);
    if (!valid) return;
    onPay({
      salutation,
      guest_name: name.trim(),
      guest_phone: `${phoneCode}${phone}`,
      guest_email: email.trim(),
      nation_code: nation,
    });
  };

  const show = (k) => touched && errs[k];

  return (
    <div className="mx-auto w-full max-w-[560px] text-neutral-900 dark:text-neutral-100">
      <div className="mb-4 flex items-center gap-2">
        <button type="button" onClick={onBack} aria-label="Back" className="-ml-1 flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 hover:bg-black/5 dark:text-neutral-400 dark:hover:bg-white/10">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
        </button>
        <div className="text-base font-semibold">Guest details</div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex gap-3">
          <div>
            <span className={labelCls}>Title</span>
            <select value={salutation} onChange={(e) => setSalutation(Number(e.target.value))} className={`${inputCls} ${ok} w-24`}>
              {TITLES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <label className="flex-1">
            <span className={labelCls}>Full name *</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="As shown on your ID" className={`${inputCls} ${show("name") ? bad : ok}`} />
            {show("name") && <div className={errCls}>{errs.name}</div>}
          </label>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="min-w-0">
            <span className={labelCls}>Mobile number *</span>
            <div className="mt-1.5 flex gap-2">
              <Combobox
                options={phoneOptions}
                value={phoneCode}
                onChange={setPhoneCode}
                selectedText={phoneCode}
                placeholder="Code"
                wrapperClassName="shrink-0"
                triggerClassName={`h-11 w-24 rounded-xl border ${ok} bg-white dark:bg-neutral-900 px-3 text-sm text-neutral-900 dark:text-neutral-100`}
              />
              <input value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))} placeholder="8221xxxxxxx" inputMode="numeric" className={`h-11 min-w-0 flex-1 rounded-xl border ${show("phone") ? bad : ok} bg-white dark:bg-neutral-900 px-3 text-sm text-neutral-900 dark:text-neutral-100`} />
            </div>
            {show("phone") && <div className={errCls}>{errs.phone}</div>}
          </div>
          <label className="min-w-0">
            <span className={labelCls}>Email address *</span>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" inputMode="email" className={`${inputCls} ${show("email") ? bad : ok}`} />
            {show("email") && <div className={errCls}>{errs.email}</div>}
          </label>
        </div>

        <div>
          <span className={labelCls}>Nationality *</span>
          <Combobox
            options={natOptions}
            value={nation}
            onChange={setNation}
            selectedText={selectedNatName}
            placeholder="Search your nationality"
            triggerClassName={`${inputCls} ${show("nation") ? bad : ok}`}
          />
          {show("nation") && <div className={errCls}>{errs.nation}</div>}
        </div>

        <OrderSummary hotelName={hotelName} query={query} selections={selections} extras={extras} />

        {error && <div className={errCls}>{error}</div>}

        <button
          type="button"
          onClick={submit}
          className="h-12 w-full rounded-xl bg-neutral-900 text-sm font-medium text-white dark:bg-white dark:text-neutral-900 transition-transform duration-150 hover:opacity-90 active:scale-[0.99]"
        >
          Pay now
        </button>
      </div>
    </div>
  );
}
