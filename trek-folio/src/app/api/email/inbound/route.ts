import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseEmailToReservation } from "@/lib/email-parser";
import { verifyResendSignature } from "@/lib/webhook-verify";
import { sendReservationAddedEmail } from "@/lib/email-notifications";

// Force Node runtime — we use crypto module (not available on edge)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ResendInboundPayload {
  from?: string;
  to?: string | string[];
  subject?: string;
  text?: string;
  html?: string;
  headers?: Record<string, string>;
  // Resend sometimes nests fields under `data`
  data?: {
    from?: string;
    to?: string | string[];
    subject?: string;
    text?: string;
    html?: string;
    headers?: Record<string, string>;
  };
}

function normalizePayload(raw: ResendInboundPayload) {
  const d = raw.data ?? raw;
  return {
    from: typeof d.from === "string" ? d.from : "",
    to: Array.isArray(d.to) ? d.to : d.to ? [d.to] : [],
    subject: d.subject ?? "",
    text: d.text ?? "",
    html: d.html ?? "",
  };
}

/**
 * Extract the forwarding alias from the TO address.
 * Input:  "Foo <res+abc1234@trekfol.io>"  or  "res+abc1234@trekfol.io"
 * Output: "abc1234"  (or null if no plus-addressing match)
 */
function extractAlias(toAddresses: string[]): string | null {
  for (const raw of toAddresses) {
    const m = raw.match(/res\+([a-z0-9]+)@trekfol\.io/i);
    if (m) return m[1].toLowerCase();
  }
  return null;
}

/**
 * Strip common email-client quoting / signatures to improve parsing quality.
 * Forwarded emails often have "-------- Forwarded message --------" sections;
 * we keep everything after the last such marker if present.
 */
function preprocessEmailBody(body: string): string {
  const forwardMarker = /[-—]+\s*Forwarded message\s*[-—]+/gi;
  const matches: RegExpExecArray[] = [];
  let m: RegExpExecArray | null;
  while ((m = forwardMarker.exec(body)) !== null) {
    matches.push(m);
  }
  if (matches.length > 0) {
    const last = matches[matches.length - 1];
    return body.slice(last.index + last[0].length);
  }
  return body;
}

/**
 * Find the trip that best matches this reservation's date range.
 * Returns the trip id, or null if no match.
 */
async function autoMatchTrip(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  reservationStart: string | null
): Promise<string | null> {
  if (!reservationStart) return null;

  const start = new Date(reservationStart);
  // Candidate = any trip whose date range contains the reservation start
  const startDate = start.toISOString().slice(0, 10);

  const { data: trips } = await supabase
    .from("trips")
    .select("id, start_date, end_date")
    .eq("user_id", userId)
    .lte("start_date", startDate)
    .gte("end_date", startDate)
    .limit(1);

  if (trips && trips.length > 0) return trips[0].id;

  // Fallback: also try trips with no end_date (open-ended) that started on or before
  const { data: openEnded } = await supabase
    .from("trips")
    .select("id")
    .eq("user_id", userId)
    .lte("start_date", startDate)
    .is("end_date", null)
    .order("start_date", { ascending: false })
    .limit(1);

  if (openEnded && openEnded.length > 0) return openEnded[0].id;
  return null;
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("resend-signature");

  if (!verifyResendSignature(rawBody, signature, process.env.RESEND_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  let payload: ResendInboundPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const { from, to, subject, text, html } = normalizePayload(payload);
  const body = preprocessEmailBody(text || html || "");

  if (!body) {
    return NextResponse.json({ error: "empty_body" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // --- Identify user ---
  // Strategy 1: forwarding alias in TO address (res+{alias}@trekfol.io)
  const alias = extractAlias(to);
  let userId: string | null = null;
  let userEmail: string | null = null;
  let userName: string | null = null;

  if (alias) {
    const { data: user } = await supabase
      .from("users")
      .select("id, email, name")
      .eq("forwarding_alias", alias)
      .single();
    if (user) {
      userId = user.id;
      userEmail = user.email;
      userName = user.name;
    }
  }

  // Strategy 2: fall back to FROM email address
  if (!userId) {
    const fromEmail = from.match(/<(.+?)>/)?.[1] ?? from;
    if (fromEmail) {
      const { data: user } = await supabase
        .from("users")
        .select("id, email, name")
        .eq("email", fromEmail)
        .single();
      if (user) {
        userId = user.id;
        userEmail = user.email;
        userName = user.name;
      }
    }
  }

  if (!userId) {
    console.warn("[email/inbound] No user match for to=%s from=%s", to, from);
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }

  // --- Parse with OpenAI ---
  const parsed = await parseEmailToReservation(subject, body);
  if (!parsed) {
    // Save raw email as unparsed inbox item so user can see something arrived
    await supabase.from("reservations").insert({
      user_id: userId,
      type: "activity", // placeholder
      provider_name: subject || "Unparsed email",
      raw_email_body: body,
      parsed_data: null,
    });
    return NextResponse.json({ status: "saved_unparsed" }, { status: 200 });
  }

  // --- Auto-match trip ---
  const tripId = await autoMatchTrip(
    supabase,
    userId,
    parsed.start_datetime
  );

  // --- Insert reservation ---
  const { data: resRow, error: resErr } = await supabase
    .from("reservations")
    .insert({
      trip_id: tripId,
      user_id: userId,
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
    console.error("[email/inbound] insert failed:", resErr);
    return NextResponse.json({ error: "db_insert_failed" }, { status: 500 });
  }

  // --- Insert type-specific detail row ---
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

  // --- Look up trip name for notification ---
  let tripName: string | null = null;
  if (tripId) {
    const { data: trip } = await supabase
      .from("trips")
      .select("name, destination")
      .eq("id", tripId)
      .single();
    tripName = trip?.destination || trip?.name || null;
  }

  // --- Send confirmation email (best-effort) ---
  if (userEmail) {
    await sendReservationAddedEmail({
      to: userEmail,
      userName,
      providerName: parsed.provider_name ?? "your reservation",
      type: parsed.type,
      tripName,
      reservationId: resRow.id,
      tripId,
    });
  }

  return NextResponse.json(
    {
      status: "ok",
      reservation_id: resRow.id,
      trip_id: tripId,
      auto_matched: !!tripId,
    },
    { status: 200 }
  );
}
