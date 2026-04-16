import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendReservationAddedEmail } from "@/lib/email-notifications";
import { RESERVATION_LABELS, type ReservationType } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Fire a "reservation added" confirmation email to the current user.
 *
 * Called fire-and-forget from the client after createReservation succeeds.
 * Uses the session-based supabase client so it's RLS-safe; only sends to
 * the authenticated user's own email.
 */
export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { reservation_id } = (await request.json()) as {
    reservation_id?: string;
  };
  if (!reservation_id) {
    return NextResponse.json(
      { error: "missing_reservation_id" },
      { status: 400 }
    );
  }

  // Verify the reservation belongs to the caller (RLS enforces this too)
  const { data: res } = await supabase
    .from("reservations")
    .select("id, trip_id, type, provider_name")
    .eq("id", reservation_id)
    .single();
  if (!res) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Look up user's display name
  const { data: profile } = await supabase
    .from("users")
    .select("name")
    .eq("id", user.id)
    .single();

  // Look up trip for context
  let tripName: string | null = null;
  if (res.trip_id) {
    const { data: trip } = await supabase
      .from("trips")
      .select("name, destination")
      .eq("id", res.trip_id)
      .single();
    tripName = trip?.destination || trip?.name || null;
  }

  await sendReservationAddedEmail({
    to: user.email,
    userName: profile?.name ?? null,
    providerName:
      res.provider_name ?? RESERVATION_LABELS[res.type as ReservationType],
    type: res.type as ReservationType,
    tripName,
    reservationId: res.id,
    tripId: res.trip_id,
  });

  return NextResponse.json({ status: "sent" }, { status: 200 });
}
