import {
  IoAirplaneOutline,
  IoBusinessOutline,
  IoRestaurantOutline,
  IoWineOutline,
  IoCompassOutline,
  IoCarOutline,
} from "react-icons/io5";
import type { IconType } from "react-icons";
import type { ReservationType } from "./types";

// Ionicons outline icons for each reservation type
export const RESERVATION_ICONS: Record<ReservationType, IconType> = {
  flight: IoAirplaneOutline,
  hotel: IoBusinessOutline,
  restaurant: IoRestaurantOutline,
  bar: IoWineOutline,
  activity: IoCompassOutline,
  car_rental: IoCarOutline,
};

// Tailwind class fragments for each type — keeps JSX clean
export const RESERVATION_COLOR_CLASSES: Record<
  ReservationType,
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
  car_rental: {
    tile: "bg-tf-car-tint",
    tileBorder: "border-tf-car-border",
    icon: "text-tf-car",
    pill: "bg-tf-car",
  },
};
