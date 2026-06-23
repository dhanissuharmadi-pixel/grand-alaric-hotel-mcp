import { createRoot } from "react-dom/client";
import { useState } from "react";
import { useOpenAiGlobal, sendFollowup } from "./openai.js";
import "./index.css";

const AMEN_PREVIEW = 8; // collapse long facility lists to this many, with a "show all" toggle

const idr = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

// Inline SVG inner markup, keyed by name. Amenity glyphs mirror the design the
// senior's API will drive; `icon` on each amenity selects one (falls back to a
// check). Stroke icons share the wrapper below; `star` is filled and special-cased.
const ICONS = {
  pin: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  users: '<circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>',
  paw: '<circle cx="8" cy="9" r="1.6"/><circle cx="16" cy="9" r="1.6"/><circle cx="10.5" cy="6" r="1.6"/><circle cx="13.5" cy="6" r="1.6"/><path d="M12 13c-2.2 0-4 1.6-4 3.4S9.8 20 12 20s4-.8 4-2.6S14.2 13 12 13z"/>',
  map: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/>',
  wifi: '<path d="M5 12.55a11 11 0 0 1 14 0"/><path d="M8.5 16.1a6 6 0 0 1 7 0"/><path d="M2 8.82a15 15 0 0 1 20 0"/><path d="M12 20h.01"/>',
  pool: '<path d="M2 18c1.5 0 1.5 1 3 1s1.5-1 3-1 1.5 1 3 1 1.5-1 3-1 1.5 1 3 1 1.5-1 3-1"/><path d="M2 14c1.5 0 1.5 1 3 1s1.5-1 3-1 1.5 1 3 1 1.5-1 3-1 1.5 1 3 1 1.5-1 3-1"/><path d="M8 14V4a2 2 0 0 1 4 0"/>',
  parking: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 17V8h3.5a2.5 2.5 0 0 1 0 5H9"/>',
  restaurant: '<path d="M4 3v7a2 2 0 0 0 4 0V3"/><path d="M6 10v11"/><path d="M17 3c-1.5 0-2.5 2-2.5 5s1 4 2.5 4 2.5-1 2.5-4-1-5-2.5-5z"/><path d="M17 12v9"/>',
  gym: '<path d="M6.5 6.5l11 11"/><path d="M3 8l2-2 3 3-2 2z"/><path d="M21 16l-2 2-3-3 2-2z"/>',
  spa: '<path d="M12 21c-3-3-7-5-7-10a7 7 0 0 1 14 0c0 5-4 7-7 10z"/><path d="M12 13c-1.5-1.5-3-2-3-4a3 3 0 0 1 6 0c0 2-1.5 2.5-3 4z"/>',
  bar: '<path d="M5 3h14l-7 8z"/><path d="M12 11v10"/><path d="M8 21h8"/>',
  ac: '<rect x="3" y="4" width="18" height="9" rx="2"/><path d="M7 17v1M12 17v2M17 17v1"/>',
  beach: '<circle cx="12" cy="8" r="5"/><path d="M12 13v8"/><path d="M8 21h8"/>',
  breakfast: '<path d="M4 8h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M17 8h1.6a2.4 2.4 0 0 1 0 4.8H17"/><path d="M7 2v2.5M11 2v2.5"/>',
};

function Icon({ name, className }) {
  if (name === "star") {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26" />
      </svg>
    );
  }
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: ICONS[name] || ICONS.check }}
    />
  );
}

function Section({ title, children }) {
  return (
    <div className="mt-6">
      <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-3">{title}</div>
      {children}
    </div>
  );
}

function Row({ icon, label, value, muted }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={`flex items-center gap-2.5 text-sm ${muted ? "text-neutral-400 dark:text-neutral-500" : "text-neutral-700 dark:text-neutral-300"}`}>
        <Icon name={icon} className="w-4 h-4 shrink-0 text-neutral-400 dark:text-neutral-500" />
        <span className={muted ? "line-through" : undefined}>{label}</span>
      </span>
      {value && <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100 shrink-0">{value}</span>}
    </div>
  );
}

function Gallery({ images }) {
  const slots = Array.from({ length: 5 }, (_, i) => images[i]);
  return (
    <div className="relative px-4 pt-4">
      <div className="grid grid-cols-[2fr_1fr_1fr] grid-rows-2 gap-1.5 h-44 sm:h-52 rounded-2xl overflow-hidden">
        {slots.map((src, i) => (
          <div
            key={i}
            className={`bg-black/5 dark:bg-white/10 flex items-center justify-center ${i === 0 ? "row-span-2" : ""}`}
          >
            {src ? (
              <img src={src} alt="" loading="lazy" className="w-full h-full object-cover" />
            ) : (
              <Icon name="grid" className="w-5 h-5 text-neutral-300 dark:text-neutral-600" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function normAmenities(list) {
  return (list ?? []).map((a) =>
    typeof a === "string"
      ? { label: a, icon: "check", available: true }
      : { label: a.label ?? a.name, icon: a.icon ?? "check", available: a.available !== false },
  );
}

function App() {
  const out = useOpenAiGlobal("toolOutput");
  const theme = useOpenAiGlobal("theme");
  const [showAllAmen, setShowAllAmen] = useState(false);
  const hotel = out?.hotel ?? out?.hotels?.[0] ?? out ?? {};

  const name = hotel.hotel_name ?? hotel.name;
  const id = hotel.hotel_id;
  const address = hotel.address ?? hotel.location;
  const rating = Number(hotel.star_rating ?? hotel.stars ?? 0);
  const gallery = hotel.gallery ?? hotel.images ?? [];
  const amenities = normAmenities(hotel.amenities);
  const nearby = hotel.nearby ?? [];
  const policies = hotel.policies ?? {};
  const priceFrom = hotel.price_from ?? hotel.from_price;

  const viewRooms = () =>
    sendFollowup(
      `I'd like to see the rooms at ${name ?? "this hotel"}${id ? ` (hotel ${id})` : ""}. ` +
        `Please check availability.`,
    );

  if (!name) {
    return (
      <div className={theme === "dark" ? "dark" : undefined}>
        <div className="antialiased w-full p-6 rounded-3xl border border-black/10 dark:border-white/10 bg-white dark:bg-neutral-900 text-center text-sm text-neutral-500 dark:text-neutral-400">
          No matching hotel found.
        </div>
      </div>
    );
  }

  return (
    <div className={theme === "dark" ? "dark" : undefined}>
      <div className="antialiased w-full max-w-[600px] mx-auto flex flex-col rounded-3xl overflow-hidden border border-black/10 dark:border-white/10 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100">

        <Gallery images={gallery} />

        <div className="px-4 pb-4">
          {/* HEADER */}
          {rating > 0 && (
            <div className="flex items-center gap-1 mt-4 mb-1 text-amber-500">
              {Array.from({ length: rating }, (_, i) => (
                <Icon key={i} name="star" className="w-3.5 h-3.5" />
              ))}
              <span className="ml-1 text-xs text-neutral-500 dark:text-neutral-400">{rating}-star hotel</span>
            </div>
          )}
          <h2 className="text-lg font-semibold leading-tight">{name}</h2>
          {address && (
            <div className="flex items-center gap-1.5 mt-1.5 text-[13px] text-neutral-500 dark:text-neutral-400">
              <Icon name="pin" className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{address}</span>
            </div>
          )}
          {hotel.description && (
            <p className="mt-3.5 text-[13px] leading-relaxed text-neutral-600 dark:text-neutral-300">
              {hotel.description}
            </p>
          )}

          {/* AMENITIES */}
          {amenities.length > 0 && (
            <Section title="Popular amenities">
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                {(showAllAmen ? amenities : amenities.slice(0, AMEN_PREVIEW)).map((a, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-2.5 text-[13px] ${a.available ? "text-neutral-700 dark:text-neutral-300" : "text-neutral-400 dark:text-neutral-500"}`}
                  >
                    <Icon name={a.icon} className="w-[18px] h-[18px] shrink-0 text-neutral-500 dark:text-neutral-400" />
                    <span className={a.available ? undefined : "line-through"}>{a.label}</span>
                  </div>
                ))}
              </div>
              {amenities.length > AMEN_PREVIEW && (
                <button
                  type="button"
                  onClick={() => setShowAllAmen((v) => !v)}
                  className="mt-3 rounded-xl border border-black/10 dark:border-white/15 px-4 py-2 text-xs font-medium text-neutral-900 dark:text-neutral-100 hover:bg-black/5 dark:hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500"
                >
                  {showAllAmen ? "Show less" : `Show all ${amenities.length} amenities`}
                </button>
              )}
            </Section>
          )}

          {/* LOCATION */}
          {(hotel.map_image || nearby.length > 0) && (
            <Section title="Location">
              {hotel.map_image && (
                <div className="relative h-32 rounded-xl overflow-hidden border border-black/10 dark:border-white/10">
                  <img src={hotel.map_image} alt="Map" className="w-full h-full object-cover" />
                  <Icon
                    name="pin"
                    className="w-6 h-6 text-neutral-900 dark:text-neutral-100 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full"
                  />
                </div>
              )}
              {nearby.length > 0 && (
                <div className="flex flex-col gap-2.5 mt-3">
                  {nearby.map((n, i) => (
                    <div key={i} className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2.5 text-[13px] text-neutral-700 dark:text-neutral-300 min-w-0">
                        <Icon name={n.icon ?? "pin"} className="w-4 h-4 shrink-0 text-neutral-400 dark:text-neutral-500" />
                        <span className="truncate">{n.label}</span>
                      </span>
                      <span className="text-xs text-neutral-500 dark:text-neutral-400 shrink-0">{n.distance ?? n.dist}</span>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          )}

          {/* POLICIES */}
          {(policies.check_in || policies.check_out || policies.cancellation || policies.children || policies.pets) && (
            <Section title="Good to know">
              <div className="flex flex-col gap-2.5">
                {policies.check_in && <Row icon="clock" label="Check-in" value={policies.check_in} />}
                {policies.check_out && <Row icon="clock" label="Check-out" value={policies.check_out} />}
                {policies.cancellation && <Row icon="check" label="Free cancellation" value={policies.cancellation} />}
                {policies.children && <Row icon="users" label="Children" value={policies.children} />}
                {policies.pets && <Row icon="paw" label="Pets" value={policies.pets} />}
              </div>
            </Section>
          )}
        </div>

        {/* STICKY FOOTER */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-black/10 dark:border-white/10 bg-white dark:bg-neutral-900">
          <div className="min-w-0">
            {priceFrom != null && (
              <>
                <div className="text-xs text-neutral-500 dark:text-neutral-400">From</div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-base font-semibold tabular-nums">{idr.format(priceFrom)}</span>
                  <span className="text-xs text-neutral-500 dark:text-neutral-400">/ night</span>
                </div>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={viewRooms}
            className="shrink-0 h-11 px-6 rounded-xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 text-sm font-medium transition-transform duration-150 hover:opacity-90 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-neutral-900"
          >
            View rooms
          </button>
        </div>

      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
