import {
  IoAirplaneOutline,
  IoBusinessOutline,
  IoRestaurantOutline,
  IoWineOutline,
  IoCompassOutline,
  IoCarOutline,
  IoMusicalNotesOutline,
  IoCarSportOutline,
  IoBoatOutline,
  IoTrainOutline,
  IoFilmOutline,
  IoWalkOutline,
  IoPeopleOutline,
  IoBusOutline,
  IoDocumentTextOutline,
  IoNavigateOutline,
} from "react-icons/io5";
import type { IconType } from "react-icons";
import type { ReservationType } from "./types";
import { RESERVATION_COLOR_KEY } from "./types";

// Ionicons outline icons for each plan type
export const RESERVATION_ICONS: Record<ReservationType, IconType> = {
  flight: IoAirplaneOutline,
  hotel: IoBusinessOutline,
  restaurant: IoRestaurantOutline,
  bar: IoWineOutline,
  activity: IoCompassOutline,
  car_rental: IoCarOutline,
  concert: IoMusicalNotesOutline,
  parking: IoCarSportOutline,
  cruise: IoBoatOutline,
  rail: IoTrainOutline,
  ferry: IoBoatOutline,
  theater: IoFilmOutline,
  tour: IoWalkOutline,
  meeting: IoPeopleOutline,
  transportation: IoBusOutline,
  note: IoDocumentTextOutline,
  directions: IoNavigateOutline,
};

// Tailwind class fragments for each color slot
const COLOR_CLASSES: Record<
  "flight" | "hotel" | "restaurant" | "bar" | "activity" | "car" | "note",
  { tile: string; tileBorder: string; icon: string; pill: string }
> = {
  flight: {
    tile: "bg-tf-flight-tint",
    tileBorder: "border-tf-flight-border",
    icon: "text-tf-flight",
    pill: "bg-tf-flight",
  },
  hotel: {
    tile: "bg-tf-hotel-tint",
    tileBorder: "border-tf-hotel-border",
    icon: "text-tf-hotel",
    pill: "bg-tf-hotel",
  },
  restaurant: {
    tile: "bg-tf-restaurant-tint",
    tileBorder: "border-tf-restaurant-border",
    icon: "text-tf-restaurant",
    pill: "bg-tf-restaurant",
  },
  bar: {
    tile: "bg-tf-bar-tint",
    tileBorder: "border-tf-bar-border",
    icon: "text-tf-bar",
    pill: "bg-tf-bar",
  },
  activity: {
    tile: "bg-tf-activity-tint",
    tileBorder: "border-tf-activity-border",
    icon: "text-tf-activity",
    pill: "bg-tf-activity",
  },
  car: {
    tile: "bg-tf-car-tint",
    tileBorder: "border-tf-car-border",
    icon: "text-tf-car",
    pill: "bg-tf-car",
  },
  note: {
    tile: "bg-tf-note-tint",
    tileBorder: "border-tf-note-border",
    icon: "text-tf-note",
    pill: "bg-tf-note",
  },
};

// Resolve color classes per plan type via the COLOR_KEY indirection
export const RESERVATION_COLOR_CLASSES: Record<
  ReservationType,
  { tile: string; tileBorder: string; icon: string; pill: string }
> = Object.fromEntries(
  (Object.keys(RESERVATION_COLOR_KEY) as ReservationType[]).map((type) => [
    type,
    COLOR_CLASSES[RESERVATION_COLOR_KEY[type]],
  ])
) as Record<
  ReservationType,
  { tile: string; tileBorder: string; icon: string; pill: string }
>;
