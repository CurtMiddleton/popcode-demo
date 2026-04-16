export type ReservationType =
  | "flight"
  | "hotel"
  | "restaurant"
  | "bar"
  | "activity"
  | "car_rental";

export interface User {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  home_city: string | null;
  forwarding_alias: string | null;
  created_at: string;
}

export interface Trip {
  id: string;
  user_id: string;
  name: string;
  destination: string | null;
  start_date: string | null;
  end_date: string | null;
  cover_image_url: string | null;
  created_at: string;
}

export interface Reservation {
  id: string;
  trip_id: string | null;
  user_id: string;
  type: ReservationType;
  provider_name: string | null;
  confirmation_number: string | null;
  start_datetime: string | null;
  end_datetime: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  google_place_id: string | null;
  price: number | null;
  currency: string | null;
  raw_email_body: string | null;
  parsed_data: Record<string, unknown> | null;
  notes: string | null;
  created_at: string;
}

export interface Flight {
  id: string;
  reservation_id: string;
  airline: string | null;
  flight_number: string | null;
  origin_airport: string | null;
  dest_airport: string | null;
  departure_time: string | null;
  arrival_time: string | null;
  terminal: string | null;
  gate: string | null;
  seat: string | null;
  booking_class: string | null;
  layovers: Array<{
    airport: string;
    arrival_time: string;
    departure_time: string;
    duration_minutes: number;
  }>;
}

export interface Hotel {
  id: string;
  reservation_id: string;
  hotel_name: string | null;
  address: string | null;
  check_in: string | null;
  check_out: string | null;
  room_type: string | null;
  phone: string | null;
  website: string | null;
  google_place_id: string | null;
}

export interface Photo {
  id: string;
  trip_id: string;
  user_id: string;
  storage_url: string;
  caption: string | null;
  taken_at: string | null;
  reservation_id: string | null;
  day_index: number | null;
  created_at: string;
}

export interface TripShare {
  id: string;
  trip_id: string;
  share_token: string;
  can_edit: boolean;
  expires_at: string | null;
  created_at: string;
}

export interface TripCollaborator {
  id: string;
  trip_id: string;
  user_id: string | null;
  role: "viewer" | "editor";
  invited_email: string | null;
  accepted_at: string | null;
  created_at: string;
}

export interface WishlistPlace {
  id: string;
  trip_id: string;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  google_place_id: string | null;
  category: string | null;
  notes: string | null;
  created_at: string;
}

// Color mapping for reservation types
export const RESERVATION_COLORS: Record<ReservationType, string> = {
  flight: "#3B82F6",     // blue
  hotel: "#22C55E",      // green
  restaurant: "#F97316", // orange
  bar: "#A855F7",        // purple
  activity: "#EAB308",   // yellow
  car_rental: "#6B7280", // gray
};

export const RESERVATION_LABELS: Record<ReservationType, string> = {
  flight: "Flight",
  hotel: "Hotel",
  restaurant: "Restaurant",
  bar: "Bar",
  activity: "Activity",
  car_rental: "Car Rental",
};
