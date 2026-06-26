import { createRoot } from "react-dom/client";
import { BookingApp } from "./BookingApp.jsx";

// check_availability renders this. BookingApp infers the "rooms" entry from out.rooms
// and drives the full flow in-widget (rooms → enhance → guest → pay).
createRoot(document.getElementById("root")).render(<BookingApp />);
