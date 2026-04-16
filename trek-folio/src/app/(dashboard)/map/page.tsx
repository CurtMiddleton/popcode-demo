import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { GlobalMap, type TripPin } from "@/components/global-map";
import type { Trip } from "@/lib/types";

type ReservationCoord = {
  trip_id: string | null;
  lat: number | null;
  lng: number | null;
};

export const metadata = {
  title: "Map — Trek Folio",
};

export default async function MapPage() {
  const supabase = createClient();

  const { data: trips } = await supabase
    .from("trips")
    .select("*")
    .order("start_date", { ascending: true });

  const { data: reservations } = await supabase
    .from("reservations")
    .select("id, trip_id, lat, lng")
    .not("lat", "is", null)
    .not("lng", "is", null);

  const today = new Date().toISOString().slice(0, 10);
  const pins = buildTripPins(
    trips ?? [],
    (reservations ?? []) as ReservationCoord[],
    today
  );

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        eyebrow="Geographic View"
        title="Map"
        description="Every trip, pinned. Click a pin to open the trip."
      />
      <GlobalMap pins={pins} />
    </div>
  );
}

// One pin per trip at the centroid of its plans with coordinates.
// Trips with no geocoded plans are skipped.
function buildTripPins(
  trips: Trip[],
  reservations: ReservationCoord[],
  today: string
): TripPin[] {
  const coordsByTrip = new Map<string, { lat: number; lng: number }[]>();
  for (const r of reservations) {
    if (r.lat == null || r.lng == null || !r.trip_id) continue;
    const list = coordsByTrip.get(r.trip_id) ?? [];
    list.push({ lat: r.lat, lng: r.lng });
    coordsByTrip.set(r.trip_id, list);
  }

  const pins: TripPin[] = [];
  for (const trip of trips) {
    const coords = coordsByTrip.get(trip.id);
    if (!coords || coords.length === 0) continue;
    const lat = coords.reduce((s, c) => s + c.lat, 0) / coords.length;
    const lng = coords.reduce((s, c) => s + c.lng, 0) / coords.length;
    pins.push({
      tripId: trip.id,
      name: trip.name,
      destination: trip.destination,
      startDate: trip.start_date,
      endDate: trip.end_date,
      lat,
      lng,
      planCount: coords.length,
      isUpcoming: isTripUpcoming(trip, today),
    });
  }
  return pins;
}

// Upcoming = end_date is today or later. If no end_date, fall back to
// start_date. Trips with no dates default to upcoming so new/draft trips
// aren't visually demoted.
function isTripUpcoming(trip: Trip, today: string): boolean {
  const anchor = trip.end_date ?? trip.start_date;
  if (!anchor) return true;
  return anchor >= today;
}
