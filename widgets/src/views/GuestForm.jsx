import { useState } from "react";
import { OrderSummary } from "./OrderSummary.jsx";

// Salutation codes per the API (create_order's `salutation`). Mr is the documented
// default (3); the others are best-effort and should be confirmed against the backend.
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

export function GuestForm({ hotelName, query, selections, extras, nationalities = [], onPay, onBack, paying, error }) {
  const [salutation, setSalutation] = useState(3);
  const [name, setName] = useState("");
  const [phoneCode, setPhoneCode] = useState("+62");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [nation, setNation] = useState("");
  const [touched, setTouched] = useState(false);

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
              <select value={phoneCode} onChange={(e) => setPhoneCode(e.target.value)} className={`h-11 w-24 shrink-0 rounded-xl border ${ok} bg-white dark:bg-neutral-900 px-2 text-sm`}>
                {(nationalities.length ? nationalities : [{ phone_code: "+62", nationality: "Indonesia" }])
                  .filter((n) => natPhone(n))
                  .map((n, i) => (
                    <option key={i} value={natPhone(n)}>{natPhone(n)}</option>
                  ))}
              </select>
              <input value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))} placeholder="8221xxxxxxx" inputMode="numeric" className={`h-11 min-w-0 flex-1 rounded-xl border ${show("phone") ? bad : ok} bg-white dark:bg-neutral-900 px-3 text-sm`} />
            </div>
            {show("phone") && <div className={errCls}>{errs.phone}</div>}
          </div>
          <label className="min-w-0">
            <span className={labelCls}>Email address *</span>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" inputMode="email" className={`${inputCls} ${show("email") ? bad : ok}`} />
            {show("email") && <div className={errCls}>{errs.email}</div>}
          </label>
        </div>

        <label>
          <span className={labelCls}>Nationality *</span>
          <select value={nation} onChange={(e) => setNation(e.target.value)} className={`${inputCls} ${show("nation") ? bad : ok}`}>
            <option value="">Select your nationality</option>
            {nationalities.map((n, i) => (
              <option key={i} value={natCode(n)}>{natName(n)}</option>
            ))}
          </select>
          {show("nation") && <div className={errCls}>{errs.nation}</div>}
        </label>

        <OrderSummary hotelName={hotelName} query={query} selections={selections} extras={extras} />

        {error && <div className={errCls}>{error}</div>}

        <button
          type="button"
          onClick={submit}
          disabled={paying}
          className="h-12 w-full rounded-xl bg-neutral-900 text-sm font-medium text-white dark:bg-white dark:text-neutral-900 disabled:opacity-60 transition-transform duration-150 hover:opacity-90 active:scale-[0.99]"
        >
          {paying ? "Processing…" : "Pay now"}
        </button>
      </div>
    </div>
  );
}
