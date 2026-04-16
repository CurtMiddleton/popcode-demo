import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReservationType } from "./types";

// Shape of the form (what the dialog collects).
// All fields optional because create and edit both use this.
export interface ReservationInput {
  id?: string;
  trip_id: string;
  user_id: string;
  type: ReservationType;
  provider_name?: string | null;
  confirmation_number?: string | null;
  start_datetime?: string | null;
  end_datetime?: string | null;
  address?: string | null;
  price?: number | null;
  currency?: string | null;
  notes?: string | null;

  // Flight-specific
  flight?: {
    airline?: string | null;
    flight_number?: string | null;
    origin_airport?: string | null;
    dest_airport?: string | null;
    departure_time?: string | null;
    arrival_time?: string | null;
    terminal?: string | null;
    gate?: string | null;
    seat?: string | null;
    booking_class?: string | null;
  };

  // Hotel-specific
  hotel?: {
    hotel_name?: string | null;
    address?: string | null;
    check_in?: string | null;
    check_out?: string | null;
    room_type?: string | null;
    phone?: string | null;
    website?: string | null;
  };
}

function emptyToNull<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = v === "" ? null : v;
  }
  return out as T;
}

/**
 * Create a reservation plus optional flight/hotel detail row.
 * Returns the new reservation id on success, throws on error.
 */
export async function createReservation(
  supabase: SupabaseClient,
  input: ReservationInput
): Promise<string> {
  const { flight, hotel, ...common } = input;

  // Insert common reservation row
  const { data: res, error: resErr } = await supabase
    .from("reservations")
    .insert(
      emptyToNull({
        trip_id: common.trip_id,
        user_id: common.user_id,
        type: common.type,
        provider_name: common.provider_name ?? null,
        confirmation_number: common.confirmation_number ?? null,
        start_datetime: common.start_datetime ?? null,
        end_datetime: common.end_datetime ?? null,
        address: common.address ?? null,
        price: common.price ?? null,
        currency: common.currency ?? null,
        notes: common.notes ?? null,
      })
    )
    .select("id")
    .single();

  if (resErr || !res) throw resErr ?? new Error("Failed to create reservation");

  // Insert type-specific detail row
  if (input.type === "flight" && flight) {
    const { error } = await supabase.from("flights").insert(
      emptyToNull({
        reservation_id: res.id,
        airline: flight.airline ?? null,
        flight_number: flight.flight_number ?? null,
        origin_airport: flight.origin_airport ?? null,
        dest_airport: flight.dest_airport ?? null,
        departure_time: flight.departure_time ?? null,
        arrival_time: flight.arrival_time ?? null,
        terminal: flight.terminal ?? null,
        gate: flight.gate ?? null,
        seat: flight.seat ?? null,
        booking_class: flight.booking_class ?? null,
      })
    );
    if (error) throw error;
  } else if (input.type === "hotel" && hotel) {
    const { error } = await supabase.from("hotels").insert(
      emptyToNull({
        reservation_id: res.id,
        hotel_name: hotel.hotel_name ?? null,
        address: hotel.address ?? null,
        check_in: hotel.check_in ?? null,
        check_out: hotel.check_out ?? null,
        room_type: hotel.room_type ?? null,
        phone: hotel.phone ?? null,
        website: hotel.website ?? null,
      })
    );
    if (error) throw error;
  }

  return res.id;
}

/**
 * Update an existing reservation. Upserts the flight/hotel detail row.
 */
export async function updateReservation(
  supabase: SupabaseClient,
  id: string,
  input: ReservationInput
): Promise<void> {
  const { flight, hotel } = input;

  const { error: resErr } = await supabase
    .from("reservations")
    .update(
      emptyToNull({
        type: input.type,
        provider_name: input.provider_name ?? null,
        confirmation_number: input.confirmation_number ?? null,
        start_datetime: input.start_datetime ?? null,
        end_datetime: input.end_datetime ?? null,
        address: input.address ?? null,
        price: input.price ?? null,
        currency: input.currency ?? null,
        notes: input.notes ?? null,
      })
    )
    .eq("id", id);

  if (resErr) throw resErr;

  if (input.type === "flight" && flight) {
    const { error } = await supabase.from("flights").upsert(
      emptyToNull({
        reservation_id: id,
        airline: flight.airline ?? null,
        flight_number: flight.flight_number ?? null,
        origin_airport: flight.origin_airport ?? null,
        dest_airport: flight.dest_airport ?? null,
        departure_time: flight.departure_time ?? null,
        arrival_time: flight.arrival_time ?? null,
        terminal: flight.terminal ?? null,
        gate: flight.gate ?? null,
        seat: flight.seat ?? null,
        booking_class: flight.booking_class ?? null,
      }),
      { onConflict: "reservation_id" }
    );
    if (error) throw error;
  } else if (input.type === "hotel" && hotel) {
    const { error } = await supabase.from("hotels").upsert(
      emptyToNull({
        reservation_id: id,
        hotel_name: hotel.hotel_name ?? null,
        address: hotel.address ?? null,
        check_in: hotel.check_in ?? null,
        check_out: hotel.check_out ?? null,
        room_type: hotel.room_type ?? null,
        phone: hotel.phone ?? null,
        website: hotel.website ?? null,
      }),
      { onConflict: "reservation_id" }
    );
    if (error) throw error;
  }
}

export async function deleteReservation(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  // Cascades handle flights/hotels rows automatically
  const { error } = await supabase.from("reservations").delete().eq("id", id);
  if (error) throw error;
}
