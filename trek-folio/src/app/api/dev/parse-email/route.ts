import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseEmailToReservation } from "@/lib/email-parser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * DEV/TEST endpoint — paste an email body, get it parsed and optionally
 * saved as a real reservation. Requires an authenticated user.
 *
 * Uses the regular (session-based) Supabase client so RLS applies. No
 * service_role key required.
 *
 * POST body: { subject: string, body: string, save?: boolean }
 * Returns:   { parsed: ParsedReservation | null, reservation_id?: string,
 *              trip_id?: string | null }
 */
export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { subject, body, save } = (await request.json()) as {
    subject?: string;
    body?: string;
    save?: boolean;
  };

  if (!body) {
    return NextResponse.json({ error: "missing_body" }, { status: 400 });
  }

  const parsed = await parseEmailToReservation(subject ?? "", body);

  if (!parsed) {
    return NextResponse.json({ parsed: null }, { status: 200 });
  }

  if (!save) {
    return NextResponse.json({ parsed }, { status: 200 });
  }

  // Auto-match trip using user's own session (RLS applies)
  let tripId: string | null = null;
  if (parsed.start_datetime) {
    const startDate = new Date(parsed.start_datetime).toISOString().slice(0, 10);
    const { data: trips } = await supabase
      .from("trips")
      .select("id")
      .eq("user_id", user.id)
      .lte("start_date", startDate)
      .gte("end_date", startDate)
      .limit(1);
    if (trips && trips.length > 0) tripId = trips[0].id;
  }

  const { data: resRow, error: resErr } = await supabase
    .from("reservations")
    .insert({
      trip_id: tripId,
      user_id: user.id,
      type: parsed.type,
      provider_name: parsed.provider_name,
      confirmation_number: parsed.confirmation_number,
      start_datetime: parsed.start_datetime,
      end_datetime: parsed.end_datetime,
      address: parsed.address,
      price: parsed.price,
      currency: parsed.currency,
      raw_email_body: body,
      parsed_data: parsed as unknown as Record<string, unknown>,
    })
    .select("id")
    .single();

  if (resErr || !resRow) {
    return NextResponse.json(
      { error: "db_insert_failed", detail: resErr?.message },
      { status: 500 }
    );
  }

  if (parsed.type === "flight" && parsed.flight_details) {
    await supabase.from("flights").insert({
      reservation_id: resRow.id,
      ...parsed.flight_details,
    });
  } else if (parsed.type === "hotel" && parsed.hotel_details) {
    await supabase.from("hotels").insert({
      reservation_id: resRow.id,
      ...parsed.hotel_details,
    });
  }

  return NextResponse.json(
    {
      parsed,
      reservation_id: resRow.id,
      trip_id: tripId,
    },
    { status: 200 }
  );
}
