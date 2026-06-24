import { createRoot } from "react-dom/client";
import { useOpenAiGlobal, sendFollowup } from "./openai.js";
import { HotelDetail } from "./views/HotelDetail.jsx";
import "./index.css";

// Standalone hotel-details widget (rendered when the model calls get_hotel_details
// directly). "View rooms" hands off to the model since this widget can't fetch rooms.
function App() {
  const out = useOpenAiGlobal("toolOutput");
  const theme = useOpenAiGlobal("theme");
  const hotel = out?.hotel ?? {};

  const viewRooms = () =>
    sendFollowup(
      `I'd like to see the rooms at ${hotel.hotel_name ?? hotel.name ?? "this hotel"}${hotel.hotel_id ? ` (hotel ${hotel.hotel_id})` : ""}. ` +
        `Please check availability.`,
    );

  return (
    <div className={theme === "dark" ? "dark" : undefined}>
      <div className="antialiased w-full">
        <HotelDetail hotel={hotel} onViewRooms={viewRooms} />
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
