import { useState } from "react";
import { Icon, idr } from "./icons.jsx";

const AMEN_PREVIEW = 8; // collapse long facility lists to this many, with a "show all" toggle

function Section({ title, children }) {
  return (
    <div className="mt-6">
      <div className="mb-3 text-sm font-semibold text-neutral-900 dark:text-neutral-100">{title}</div>
      {children}
    </div>
  );
}

function Row({ icon, label, value }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2.5 text-sm text-neutral-700 dark:text-neutral-300">
        <Icon name={icon} className="h-4 w-4 shrink-0 text-neutral-400 dark:text-neutral-500" />
        {label}
      </span>
      {value && <span className="shrink-0 text-sm font-medium text-neutral-900 dark:text-neutral-100">{value}</span>}
    </div>
  );
}

function Gallery({ images }) {
  const slots = Array.from({ length: 5 }, (_, i) => images[i]);
  return (
    <div className="relative px-4 pt-4">
      <div className="grid h-44 grid-cols-[2fr_1fr_1fr] grid-rows-2 gap-1.5 overflow-hidden rounded-2xl sm:h-52">
        {slots.map((src, i) => (
          <div key={i} className={`relative flex items-center justify-center bg-black/5 dark:bg-white/10 ${i === 0 ? "row-span-2" : ""}`}>
            <Icon name="grid" className="absolute h-5 w-5 text-neutral-300 dark:text-neutral-600" />
            {src && (
              <img src={src} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.display = "none"; }} className="relative h-full w-full object-cover" />
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
      ? { label: a, icon: "check", iconUrl: null, available: true }
      : { label: a.label ?? a.name, icon: a.icon ?? "check", iconUrl: a.icon_url ?? a.iconUrl ?? null, available: a.available !== false },
  );
}

// Prefer the backend's PNG icon (dark line art — inverted for dark mode); fall back to a
// built-in SVG if there's no URL or the image fails to load.
function AmenityIcon({ iconUrl, icon, className }) {
  const [failed, setFailed] = useState(false);
  if (iconUrl && !failed) {
    return <img src={iconUrl} alt="" loading="lazy" onError={() => setFailed(true)} className={`${className} object-contain opacity-80 dark:opacity-90 dark:invert`} />;
  }
  return <Icon name={icon} className={`${className} text-neutral-500 dark:text-neutral-400`} />;
}

// Presentational hotel-details card. `onViewRooms` fires when the footer button is
// tapped; `onBack` (optional) renders a back chevron for in-widget navigation.
export function HotelDetail({ hotel, onViewRooms, onBack }) {
  const [showAllAmen, setShowAllAmen] = useState(false);
  hotel = hotel ?? {};

  const name = hotel.hotel_name ?? hotel.name;
  const address = hotel.address ?? hotel.location;
  const rating = Number(hotel.star_rating ?? hotel.stars ?? 0);
  const gallery = hotel.gallery ?? hotel.images ?? [];
  const amenities = normAmenities(hotel.amenities);
  const nearby = hotel.nearby ?? [];
  const policies = hotel.policies ?? {};
  const priceFrom = hotel.price_from ?? hotel.from_price;

  if (!name) {
    return (
      <div className="w-full rounded-3xl border border-black/10 p-6 text-center text-sm text-neutral-500 dark:border-white/10 dark:text-neutral-400">
        No matching hotel found.
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[600px] flex-col overflow-hidden rounded-3xl border border-black/10 dark:border-white/10 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100">
      <div className="relative">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="absolute left-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-black/10 dark:border-white/15 bg-white/90 dark:bg-neutral-900/90 text-neutral-900 dark:text-neutral-100 backdrop-blur"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
          </button>
        )}
        <Gallery images={gallery} />
      </div>

      <div className="px-4 pb-4">
        {rating > 0 && (
          <div className="mb-1 mt-4 flex items-center gap-1 text-amber-500">
            {Array.from({ length: rating }, (_, i) => (
              <Icon key={i} name="star" className="h-3.5 w-3.5" />
            ))}
            <span className="ml-1 text-xs text-neutral-500 dark:text-neutral-400">{rating}-star hotel</span>
          </div>
        )}
        <h2 className="text-lg font-semibold leading-tight">{name}</h2>
        {address && (
          <div className="mt-1.5 flex items-center gap-1.5 text-[13px] text-neutral-500 dark:text-neutral-400">
            <Icon name="pin" className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{address}</span>
          </div>
        )}
        {hotel.description && (
          <p className="mt-3.5 text-[13px] leading-relaxed text-neutral-600 dark:text-neutral-300">{hotel.description}</p>
        )}

        {amenities.length > 0 && (
          <Section title="Popular amenities">
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              {(showAllAmen ? amenities : amenities.slice(0, AMEN_PREVIEW)).map((a, i) => (
                <div key={i} className={`flex items-center gap-2.5 text-[13px] ${a.available ? "text-neutral-700 dark:text-neutral-300" : "text-neutral-400 dark:text-neutral-500"}`}>
                  <AmenityIcon iconUrl={a.iconUrl} icon={a.icon} className="h-[18px] w-[18px] shrink-0" />
                  <span className={a.available ? undefined : "line-through"}>{a.label}</span>
                </div>
              ))}
            </div>
            {amenities.length > AMEN_PREVIEW && (
              <button
                type="button"
                onClick={() => setShowAllAmen((v) => !v)}
                className="mt-3 rounded-xl border border-black/10 px-4 py-2 text-xs font-medium text-neutral-900 transition-colors hover:bg-black/5 dark:border-white/15 dark:text-neutral-100 dark:hover:bg-white/10"
              >
                {showAllAmen ? "Show less" : `Show all ${amenities.length} amenities`}
              </button>
            )}
          </Section>
        )}

        {(hotel.map_image || nearby.length > 0) && (
          <Section title="Location">
            {hotel.map_image && (
              <div className="relative h-32 overflow-hidden rounded-xl border border-black/10 dark:border-white/10">
                <img src={hotel.map_image} alt="Map" onError={(e) => { e.currentTarget.style.display = "none"; }} className="h-full w-full object-cover" />
                <Icon name="pin" className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-full text-neutral-900 dark:text-neutral-100" />
              </div>
            )}
            {nearby.length > 0 && (
              <div className="mt-3 flex flex-col gap-2.5">
                {nearby.map((n, i) => (
                  <div key={i} className="flex items-center justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-2.5 text-[13px] text-neutral-700 dark:text-neutral-300">
                      <Icon name={n.icon ?? "pin"} className="h-4 w-4 shrink-0 text-neutral-400 dark:text-neutral-500" />
                      <span className="truncate">{n.label}</span>
                    </span>
                    <span className="shrink-0 text-xs text-neutral-500 dark:text-neutral-400">{n.distance ?? n.dist}</span>
                  </div>
                ))}
              </div>
            )}
          </Section>
        )}

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

      <div className="flex items-center justify-between gap-3 border-t border-black/10 dark:border-white/10 bg-white dark:bg-neutral-900 px-4 py-3">
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
          onClick={onViewRooms}
          className="h-11 shrink-0 rounded-xl bg-neutral-900 px-6 text-sm font-medium text-white dark:bg-white dark:text-neutral-900 transition-transform duration-150 hover:opacity-90 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500"
        >
          View rooms
        </button>
      </div>
    </div>
  );
}
