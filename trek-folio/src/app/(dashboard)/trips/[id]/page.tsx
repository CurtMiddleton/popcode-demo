import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TripDetail } from "./trip-detail";

interface TripPageProps {
  params: { id: string };
}

export async function generateMetadata({ params }: TripPageProps) {
  const supabase = createClient();
  const { data: trip } = await supabase
    .from("trips")
    .select("name")
    .eq("id", params.id)
    .single();

  return {
    title: trip ? `${trip.name} — Trek Folio` : "Trip — Trek Folio",
  };
}

export default async function TripPage({ params }: TripPageProps) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: trip } = await supabase
    .from("trips")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!trip) {
    notFound();
  }

  // Fetch reservations for this trip
  const { data: reservations } = await supabase
    .from("reservations")
    .select("*")
    .eq("trip_id", params.id)
    .order("start_datetime", { ascending: true });

  // Fetch photos for this trip
  const { data: photos } = await supabase
    .from("photos")
    .select("*")
    .eq("trip_id", params.id)
    .order("created_at", { ascending: true });

  return (
    <TripDetail
      trip={trip}
      reservations={reservations ?? []}
      photos={photos ?? []}
      userId={user!.id}
    />
  );
}
