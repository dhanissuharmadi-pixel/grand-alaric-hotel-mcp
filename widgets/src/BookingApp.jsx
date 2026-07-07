import { useState, useEffect, useRef } from "react";
import { useOpenAiGlobal, callTool } from "./openai.js";
import { LoadingIndicator } from "@openai/apps-sdk-ui/components/Indicator";
import { Badge } from "@openai/apps-sdk-ui/components/Badge";
import { Check } from "@openai/apps-sdk-ui/components/Icon";
import { HotelCards } from "./views/HotelCards.jsx";
import { HotelDetail } from "./views/HotelDetail.jsx";
import { RoomList } from "./views/RoomList.jsx";
import { EnhanceStay } from "./views/EnhanceStay.jsx";
import { GuestForm } from "./views/GuestForm.jsx";
import { Calendar } from "./views/Calendar.jsx";
import "./index.css";

// Unified hotel + booking flow controller. Every step runs in-widget via callTool —
// no model turn — so screens appear instantly:
//   list → details → dates → rooms (qty) → enhance → guest → pay (create_order).
// The starting screen is INFERRED from the tool output shape, so the SAME controller
// drives all three entry tools:
//   search_hotels   → out.hotels  → start at "list"
//   get_hotel_details → out.hotel → start at "details"
//   check_availability → out.rooms → start at "rooms"
// This means no matter which tool the model calls first, the user can complete the
// whole booking in-widget. Pay sends the full cart to the cart-based create_order.

function normNationalities(x) {
  if (Array.isArray(x)) return x;
  return x?.nationalities ?? x?.data ?? x?.list ?? [];
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <svg className="h-6 w-6 animate-spin text-neutral-400" viewBox="0 0 24 24" fill="none" aria-label="Loading">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.4 0 0 5.4 0 12h4z" />
      </svg>
    </div>
  );
}

function DateForm({ hotelName, checkin, checkout, guests, set, onSubmit, onBack, loading, error }) {
  const hint = !checkin ? "Select a check-in date" : !checkout ? "Now select a check-out date" : `${checkin} → ${checkout}`;
  return (
    <div className="mx-auto w-full max-w-[640px] text-neutral-900 dark:text-neutral-100">
      <div className="mb-4 flex items-center gap-2">
        <button type="button" onClick={onBack} aria-label="Back" className="-ml-1 flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 hover:bg-black/5 dark:text-neutral-400 dark:hover:bg-white/10">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
        </button>
        <div className="min-w-0">
          <div className="text-base font-semibold">When are you staying?</div>
          {hotelName && <div className="truncate text-[13px] text-neutral-500 dark:text-neutral-400">{hotelName}</div>}
        </div>
      </div>

      <Calendar value={{ checkin, checkout }} onChange={(v) => { set.checkin(v.checkin); set.checkout(v.checkout); }} />

      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-[13px] font-medium text-neutral-600 dark:text-neutral-300">{hint}</span>
        <label className="flex items-center gap-2 text-[13px] font-medium text-neutral-700 dark:text-neutral-300">
          Guests
          <div className="flex items-center overflow-hidden rounded-xl border border-black/10 dark:border-white/15">
            <button type="button" aria-label="Fewer guests" onClick={() => set.guests(Math.max(1, guests - 1))} className="h-9 w-10 text-lg text-neutral-900 dark:text-neutral-100">−</button>
            <span className="min-w-7 text-center text-sm font-semibold tabular-nums">{guests}</span>
            <button type="button" aria-label="More guests" onClick={() => set.guests(guests + 1)} className="h-9 w-10 text-lg text-neutral-900 dark:text-neutral-100">+</button>
          </div>
        </label>
      </div>

      {error && <div className="mt-3 text-[13px] text-red-600 dark:text-red-400">{error}</div>}
      <button type="button" onClick={onSubmit} disabled={loading || !checkin || !checkout} className="mt-4 h-11 w-full rounded-xl bg-neutral-900 text-sm font-medium text-white dark:bg-white dark:text-neutral-900 disabled:opacity-40 transition-transform duration-150 hover:opacity-90 active:scale-[0.99]">
        {loading ? "Checking…" : "See rooms"}
      </button>
    </div>
  );
}

const PAID_STATUSES = ["paid", "settlement", "capture", "success"];
const FAILED_STATUSES = ["expired", "expire", "cancel", "cancelled", "deny", "denied", "failure", "failed"];
// Poll fast while the user is likely mid-payment, then back off: 3s for the first
// minute, 10s for the next few, then 30s — ~85 min of coverage before the timer
// stops. Tab-return (visibilitychange) always re-checks regardless, and browsers
// throttle hidden-tab timers anyway, so the backoff mostly shapes the visible case.
const MAX_POLLS = 200;
const pollDelay = (n) => (n < 20 ? 3000 : n < 40 ? 10000 : 30000);

function Done({ url, trackingId, hotelName }) {
  const [status, setStatus] = useState("waiting"); // waiting | paid | failed
  const [failReason, setFailReason] = useState("");
  const timerRef = useRef(null);
  const pollsRef = useRef(0);
  const settledRef = useRef(false);

  const poll = async () => {
    if (!trackingId || settledRef.current) return;
    const data = await callTool("check_order_status", { tracking_id: trackingId });
    if (settledRef.current) return; // a concurrent poll already resolved it
    const s = (data?.payment_status ?? data?.message ?? "").toLowerCase();
    if (PAID_STATUSES.includes(s)) {
      settledRef.current = true;
      setStatus("paid");
    } else if (FAILED_STATUSES.includes(s)) {
      settledRef.current = true;
      setFailReason(s);
      setStatus("failed");
    }
  };

  useEffect(() => {
    if (status !== "waiting") return;
    const tick = async () => {
      await poll();
      if (settledRef.current) return;
      const n = ++pollsRef.current;
      if (n >= MAX_POLLS) return; // stop the timer; tab-return still re-checks
      timerRef.current = setTimeout(tick, pollDelay(n));
    };
    tick(); // check immediately — matters after a widget remount mid-payment
    const onVisible = () => { if (document.visibilityState === "visible") poll(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(timerRef.current);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [status]);

  if (status === "paid") {
    return (
      <div className="mx-auto w-full max-w-[420px] rounded-3xl border border-black/10 dark:border-white/10 bg-white dark:bg-neutral-900 p-5 text-neutral-900 dark:text-neutral-100">
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-500/15">
            <Check className="h-6 w-6 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
          </span>
          <div className="text-lg font-semibold">Payment confirmed</div>
          {hotelName && <div className="text-sm text-neutral-500 dark:text-neutral-400">{hotelName}</div>}
          <Badge color="success" size="md">Booking confirmed</Badge>
        </div>
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="mx-auto w-full max-w-[420px] rounded-3xl border border-black/10 dark:border-white/10 bg-white dark:bg-neutral-900 p-5 text-neutral-900 dark:text-neutral-100">
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <div className="text-lg font-semibold">Payment {failReason === "expired" || failReason === "expire" ? "expired" : "not completed"}</div>
          {hotelName && <div className="text-sm text-neutral-500 dark:text-neutral-400">{hotelName}</div>}
          <Badge color="danger" size="md">{failReason || "failed"}</Badge>
          <div className="text-sm text-neutral-500 dark:text-neutral-400">Ask for a new booking to try again.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[420px] rounded-3xl border border-black/10 dark:border-white/10 bg-white dark:bg-neutral-900 p-5 text-neutral-900 dark:text-neutral-100">
      <div className="flex flex-col items-center gap-3 py-4">
        <LoadingIndicator size={32} strokeWidth={2} />
        <div className="text-base font-semibold">Waiting for payment</div>
        {hotelName && <div className="text-sm text-neutral-500 dark:text-neutral-400">{hotelName}</div>}
        <Badge color="secondary" size="md">In progress</Badge>
      </div>
      <button type="button" onClick={() => window.openai?.openExternal?.({ href: url })} className="mt-2 h-10 w-full rounded-xl border border-black/10 dark:border-white/15 text-sm font-medium text-neutral-600 dark:text-neutral-400 transition-opacity hover:opacity-70">
        Reopen payment page
      </button>
    </div>
  );
}

export function BookingApp() {
  const out = useOpenAiGlobal("toolOutput");
  const theme = useOpenAiGlobal("theme");
  // Persisted snapshot from a previous mount of this widget instance (survives ChatGPT
  // unmounting/rebuilding the iframe, e.g. while the user is off paying).
  const saved = useOpenAiGlobal("widgetState");
  const hotels = out?.hotels ?? [];
  const location = out?.query?.location;

  // Infer the entry point from the tool output shape (see header comment).
  const roomsEntry = Array.isArray(out?.rooms) && !out?.hotels;       // check_availability
  const detailsEntry = !!out?.hotel && !out?.hotels && !roomsEntry;   // get_hotel_details

  const [view, setView] = useState(roomsEntry ? "rooms" : detailsEntry ? "details" : "list"); // list | details | dates | rooms | enhance | guest | done
  const [hotel, setHotel] = useState(detailsEntry ? out.hotel : roomsEntry ? { hotel_id: out?.query?.hotel_id } : null);
  const [detail, setDetail] = useState(detailsEntry ? out.hotel : null);
  const [rooms, setRooms] = useState(roomsEntry ? out.rooms : null);
  const [roomQuery, setRoomQuery] = useState(roomsEntry ? out.query : null);
  const [selections, setSelections] = useState([]);
  const [availableExtras, setAvailableExtras] = useState(roomsEntry ? (out.extras ?? []) : []);
  const [extras, setExtras] = useState([]);
  const [nationalities, setNationalities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [paying, setPaying] = useState(false);
  const [payUrl, setPayUrl] = useState(null);
  const [trackingId, setTrackingId] = useState(null);
  const [checkin, setCheckin] = useState("");
  const [checkout, setCheckout] = useState("");
  const [guests, setGuests] = useState(out?.query?.guests ?? 2);

  const hotelName = hotel?.hotel_name ?? detail?.hotel_name;

  // toolOutput can be set (or re-set) after mount — useState initializers only run
  // once, so sync the entry state when `out` arrives late. Guards keep an in-progress
  // flow from being clobbered by a re-emitted global.
  useEffect(() => {
    if (saved?.view === "done") return; // a restored payment screen outranks entry inference
    if (roomsEntry && !rooms) {
      setRooms(out.rooms);
      setRoomQuery(out.query ?? null);
      setAvailableExtras(out.extras ?? []);
      setHotel((h) => h ?? { hotel_id: out?.query?.hotel_id });
      setView("rooms");
    } else if (detailsEntry && !detail) {
      setHotel(out.hotel);
      setDetail(out.hotel);
      setView("details");
    }
  }, [out, saved]);

  // Remount recovery: if a previous mount reached the payment screen, jump straight
  // back to it so status polling resumes — otherwise a rebuilt iframe would dump the
  // user at the entry view with no way back to their in-flight booking.
  useEffect(() => {
    if (saved?.view === "done" && saved.trackingId && !trackingId) {
      setTrackingId(saved.trackingId);
      setPayUrl(saved.payUrl ?? null);
      setHotel((h) => h ?? (saved.hotelName ? { hotel_name: saved.hotelName } : null));
      setView("done");
    }
  }, [saved]);

  const openDetails = async (h) => {
    setHotel(h);
    setDetail(null);
    setError(null);
    setView("details");
    setLoading(true);
    const data = await callTool("get_hotel_details", { hotel_id: h.hotel_id });
    setDetail(data?.hotel ?? { hotel_name: h.hotel_name, hotel_id: h.hotel_id });
    setLoading(false);
  };

  const openDates = (h) => {
    setHotel(h);
    setError(null);
    setView("dates");
  };

  const loadRooms = async () => {
    if (!checkin || !checkout) return setError("Pick check-in and check-out dates.");
    setError(null);
    setLoading(true);
    const data = await callTool("check_availability", { hotel_id: hotel.hotel_id, check_in_date: checkin, check_out_date: checkout, guests: Number(guests) });
    setLoading(false);
    if (!data || data.error) return setError(data?.error || "Couldn't load rooms. Please try again.");
    setRooms(data.rooms ?? []);
    setRoomQuery(data.query ?? null);
    setAvailableExtras(data.extras ?? data.services ?? []); // add-ons when the API provides them
    setView("rooms");
  };

  const continueToEnhance = async (sel) => {
    setSelections(sel);
    setView("enhance");
    if (!nationalities.length) {
      const data = await callTool("list_nationalities", {});
      setNationalities(normNationalities(data?.nationalities ?? data));
    }
  };

  const toggleExtra = (extra) =>
    setExtras((cur) => (cur.some((e) => e.id === extra.id) ? cur.filter((e) => e.id !== extra.id) : [...cur, extra]));
  const removeRoom = (roomId) => setSelections((cur) => cur.filter((r) => r.room_id !== roomId));

  const pay = async (guest) => {
    if (!selections.length) return setError("No room selected.");
    setPaying(true);
    setError(null);
    const data = await callTool("create_order", {
      hotel_id: roomQuery.hotel_id,
      check_in_date: roomQuery.check_in,
      check_out_date: roomQuery.check_out,
      guests: roomQuery.guests ?? guests,
      rooms: selections.map((s) => ({ room_rate_id: s.room_id, qty: s.qty })),
      enhance_stay: extras.map((e) => ({ ehance_stay_id: String(e.id), qty: e.qty || 1, notes: "" })),
      ...guest,
    });
    setPaying(false);
    if (data?.url) {
      setPayUrl(data.url);
      setTrackingId(data.tracking_id ?? null);
      // Snapshot the payment screen so a remounted iframe can restore it (kept tiny —
      // widget state is also surfaced to the model).
      window.openai?.setWidgetState?.({ view: "done", trackingId: data.tracking_id ?? null, payUrl: data.url, hotelName });
      window.openai?.openExternal?.({ href: data.url });
      setView("done");
    } else {
      setError(data?.error || "Couldn't create the booking. Please try again.");
    }
  };

  let body;
  if (view === "details") {
    body = loading && !detail ? <Spinner /> : <HotelDetail hotel={detail} onViewRooms={() => openDates(hotel)} onBack={hotels.length ? () => setView("list") : undefined} />;
  } else if (view === "dates") {
    body = <DateForm hotelName={hotel?.hotel_name} checkin={checkin} checkout={checkout} guests={guests} set={{ checkin: setCheckin, checkout: setCheckout, guests: setGuests }} onSubmit={loadRooms} onBack={() => setView(detail ? "details" : rooms ? "rooms" : "list")} loading={loading} error={error} />;
  } else if (view === "rooms") {
    body = (
      <RoomList
        rooms={rooms}
        title={hotelName ?? "Available rooms"}
        subtitle={roomQuery?.check_in ? `${roomQuery.check_in} → ${roomQuery.check_out}${roomQuery.guests ? ` · ${roomQuery.guests} guests` : ""}` : null}
        onContinue={continueToEnhance}
        onBack={roomsEntry ? undefined : () => setView("dates")}
        onChangeDates={() => setView("dates")}
      />
    );
  } else if (view === "enhance") {
    body = <EnhanceStay hotelName={hotelName} query={roomQuery} selections={selections} available={availableExtras} chosen={extras} onToggleExtra={toggleExtra} onRemoveRoom={removeRoom} onContinue={() => setView("guest")} onBack={() => setView("rooms")} />;
  } else if (view === "guest") {
    body = paying ? (
      <div className="mx-auto w-full max-w-[420px] rounded-3xl border border-black/10 dark:border-white/10 bg-white dark:bg-neutral-900 p-8 text-neutral-900 dark:text-neutral-100">
        <div className="flex flex-col items-center gap-3 py-4">
          <LoadingIndicator size={36} strokeWidth={2} />
          <div className="text-base font-semibold">Creating your booking…</div>
          <div className="text-sm text-neutral-500 dark:text-neutral-400 text-center">This will only take a moment.</div>
        </div>
      </div>
    ) : <GuestForm hotelName={hotelName} query={roomQuery} selections={selections} extras={extras} nationalities={nationalities} onPay={pay} onBack={() => setView("enhance")} error={error} />;
  } else if (view === "done") {
    body = <Done url={payUrl} trackingId={trackingId} hotelName={hotelName} />;
  } else if (out?.error) {
    // Tool returned an error (bad dates, upstream failure) — surface it instead of a
    // misleading "no hotels found" empty state.
    body = (
      <div className="mx-auto w-full max-w-[480px] rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-neutral-900 px-4 py-8 text-center text-sm text-neutral-600 dark:text-neutral-300">
        {String(out.error)}
      </div>
    );
  } else {
    body = <HotelCards hotels={hotels} location={location} onDetails={openDetails} onViewRooms={openDates} />;
  }

  return (
    <div
      className={`${theme === "dark" ? "dark " : ""}bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100`}
      style={{ colorScheme: theme === "dark" ? "dark" : "light" }}
    >
      <div className="antialiased w-full">{body}</div>
    </div>
  );
}
