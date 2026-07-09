const ICONS = {
  pin: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  users: '<circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>',
  paw: '<circle cx="8" cy="9" r="1.6"/><circle cx="16" cy="9" r="1.6"/><circle cx="10.5" cy="6" r="1.6"/><circle cx="13.5" cy="6" r="1.6"/><path d="M12 13c-2.2 0-4 1.6-4 3.4S9.8 20 12 20s4-.8 4-2.6S14.2 13 12 13z"/>',
  wifi: '<path d="M5 12.55a11 11 0 0 1 14 0"/><path d="M8.5 16.1a6 6 0 0 1 7 0"/><path d="M2 8.82a15 15 0 0 1 20 0"/><path d="M12 20h.01"/>',
  pool: '<path d="M2 18c1.5 0 1.5 1 3 1s1.5-1 3-1 1.5 1 3 1 1.5-1 3-1 1.5 1 3 1 1.5-1 3-1"/><path d="M2 14c1.5 0 1.5 1 3 1s1.5-1 3-1 1.5 1 3 1 1.5-1 3-1 1.5 1 3 1 1.5-1 3-1"/><path d="M8 14V4a2 2 0 0 1 4 0"/>',
  parking: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 17V8h3.5a2.5 2.5 0 0 1 0 5H9"/>',
  restaurant: '<path d="M4 3v7a2 2 0 0 0 4 0V3"/><path d="M6 10v11"/><path d="M17 3c-1.5 0-2.5 2-2.5 5s1 4 2.5 4 2.5-1 2.5-4-1-5-2.5-5z"/><path d="M17 12v9"/>',
  gym: '<path d="M6.5 6.5l11 11"/><path d="M3 8l2-2 3 3-2 2z"/><path d="M21 16l-2 2-3-3 2-2z"/>',
  spa: '<path d="M12 21c-3-3-7-5-7-10a7 7 0 0 1 14 0c0 5-4 7-7 10z"/><path d="M12 13c-1.5-1.5-3-2-3-4a3 3 0 0 1 6 0c0 2-1.5 2.5-3 4z"/>',
  bar: '<path d="M5 3h14l-7 8z"/><path d="M12 11v10"/><path d="M8 21h8"/>',
  ac: '<rect x="3" y="4" width="18" height="9" rx="2"/><path d="M7 17v1M12 17v2M17 17v1"/>',
  breakfast: '<path d="M4 8h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M17 8h1.6a2.4 2.4 0 0 1 0 4.8H17"/><path d="M7 2v2.5M11 2v2.5"/>',
};

export function Icon({ name, className }) {
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

export function Star() {
  return <Icon name="star" className="h-3.5 w-3.5 text-amber-500" />;
}

export function Pin({ className = "h-3.5 w-3.5 shrink-0" }) {
  return <Icon name="pin" className={className} />;
}

export function Caret({ open }) {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {open ? <path d="m6 15 6-6 6 6" /> : <path d="m6 9 6 6 6-6" />}
    </svg>
  );
}

export const idr = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});
