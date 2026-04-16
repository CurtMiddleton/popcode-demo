import { RESERVATION_COLOR_KEY, type ReservationType } from "./types";

// Hex colors pulled from globals.css — must stay in sync with the CSS
// variables there (--tf-flight, --tf-hotel, etc).
const COLOR_HEX = {
  flight: "#0A6E9E",
  hotel: "#0E9EC0",
  restaurant: "#00B8B0",
  bar: "#00A882",
  activity: "#1A8C50",
  car: "#0D5C30",
  note: "#8A7E68",
} as const;

export function colorForType(type: ReservationType): string {
  return COLOR_HEX[RESERVATION_COLOR_KEY[type]];
}
