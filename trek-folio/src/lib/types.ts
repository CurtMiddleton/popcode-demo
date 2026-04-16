export type ReservationType =
  | "flight"
  | "hotel"
  | "restaurant"
  | "bar"
  | "activity"
  | "car_rental"
  | "concert"
  | "parking"
  | "cruise"
  | "rail"
  | "ferry"
  | "theater"
  | "tour"
  | "meeting"
  | "transportation"
  | "note"
  | "directions";

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

// User-facing label for each plan type
export const RESERVATION_LABELS: Record<ReservationType, string> = {
  flight: "Flight",
  hotel: "Lodging",
  restaurant: "Restaurant",
  bar: "Bar",
  activity: "Activity",
  car_rental: "Car Rental",
  concert: "Concert",
  parking: "Parking",
  cruise: "Cruise",
  rail: "Rail",
  ferry: "Ferry",
  theater: "Theater",
  tour: "Tour",
  meeting: "Meeting",
  transportation: "Transportation",
  note: "Note",
  directions: "Directions",
};

// One-line subtitle shown in the plan picker tile under the label
export const RESERVATION_SUBTITLES: Record<ReservationType, string> = {
  flight: "Air travel with flight number",
  hotel: "Hotel, B&B, Airbnb",
  restaurant: "Dining reservation",
  bar: "Bar, cocktail spot",
  activity: "Tickets, excursions",
  car_rental: "Car hire pickup & drop-off",
  concert: "Live music, festival",
  parking: "Garage, lot reservation",
  cruise: "Multi-day boat trip",
  rail: "Train, metro, Eurostar",
  ferry: "Point-to-point ferry",
  theater: "Show, play, opera",
  tour: "Guided tour, walking tour",
  meeting: "Business meeting, appointment",
  transportation: "Bus, shuttle, transfer",
  note: "Free-form note",
  directions: "Route between two places",
};

// Map each plan type to one of the design-system color slots
export const RESERVATION_COLOR_KEY: Record<
  ReservationType,
  "flight" | "hotel" | "restaurant" | "bar" | "activity" | "car" | "note"
> = {
  flight: "flight",
  hotel: "hotel",
  restaurant: "restaurant",
  bar: "bar",
  activity: "activity",
  car_rental: "car",
  concert: "bar",
  parking: "car",
  cruise: "hotel",
  rail: "flight",
  ferry: "hotel",
  theater: "bar",
  tour: "activity",
  meeting: "car",
  transportation: "flight",
  note: "note",
  directions: "note",
};
