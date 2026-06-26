import { createRoot } from "react-dom/client";
import { BookingApp } from "./BookingApp.jsx";

// get_hotel_details renders this. BookingApp infers the "details" entry from out.hotel
// and drives the full flow in-widget (details → dates → rooms → enhance → guest → pay).
createRoot(document.getElementById("root")).render(<BookingApp />);
