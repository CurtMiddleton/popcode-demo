import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ReservationDetail } from "./reservation-detail";
import type { Flight, Hotel } from "@/lib/types";

interface ReservationPageProps {
  params: { id: string; resId: string };
}

export async function generateMetadata({ params }: ReservationPageProps) {
  const supabase = createClient();
  const { data: res } = await supabase
    .from("reservations")
    .select("provider_name, type")
    .eq("id", params.resId)
    .single();

  return {
    title: res
      ? `${res.provider_name ?? res.type} — Trek Folio`
      : "Reservation — Trek Folio",
  };
}

export default async function ReservationPage({ params }: ReservationPageProps) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch reservation
  const { data: reservation } = await supabase
    .from("reservations")
    .select("*")
    .eq("id", params.resId)
    .eq("trip_id", params.id)
    .single();

  if (!reservation) notFound();

  // Fetch trip (for header context)
  const { data: trip } = await supabase
    .from("trips")
    .select("id, name, destination")
    .eq("id", params.id)
    .single();

  if (!trip) notFound();

  // Fetch type-specific detail row
  let flight: Flight | null = null;
  let hotel: Hotel | null = null;

  if (reservation.type === "flight") {
    const { data } = await supabase
      .from("flights")
      .select("*")
      .eq("reservation_id", params.resId)
      .maybeSingle();
    flight = data;
  } else if (reservation.type === "hotel") {
    const { data } = await supabase
      .from("hotels")
      .select("*")
      .eq("reservation_id", params.resId)
      .maybeSingle();
    hotel = data;
  }

  return (
    <ReservationDetail
      reservation={reservation}
      flight={flight}
      hotel={hotel}
      trip={trip}
      userId={user!.id}
    />
  );
}
