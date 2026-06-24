import { createRoot } from "react-dom/client";
import { useOpenAiGlobal, sendFollowup } from "./openai.js";
import { RoomList } from "./views/RoomList.jsx";
import "./index.css";

// Standalone room-results widget (rendered when the model calls check_availability
// directly). It can't run the full in-widget booking, so Continue hands the selected
// rooms to the model to proceed with guest details + create_order.
function App() {
  const out = useOpenAiGlobal("toolOutput");
  const theme = useOpenAiGlobal("theme");
  const query = out?.query;
  const subtitle =
    query?.check_in && query?.check_out
      ? `${query.check_in} → ${query.check_out}${query.guests ? ` · ${query.guests} guests` : ""}`
      : null;

  const proceed = (selections) => {
    const q = query || {};
    const list = selections.map((s) => `${s.qty}× ${s.roomName} — ${s.rateLabel} (${s.room_id})`).join(", ");
    const where = q.hotel_id ? ` at ${q.hotel_id}` : "";
    const stay = q.check_in && q.check_out ? ` for ${q.check_in} → ${q.check_out}` : "";
    sendFollowup(
      `I'd like to book: ${list}${where}${stay}. ` +
        `Please ask me for the name, email, phone, and nationality you need, then create the booking.`,
    );
  };

  return (
    <div className={theme === "dark" ? "dark" : undefined}>
      <div className="antialiased w-full">
        <RoomList rooms={out?.rooms ?? []} title="Available rooms" subtitle={subtitle} onContinue={proceed} />
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
