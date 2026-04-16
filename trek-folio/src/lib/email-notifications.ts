import { Resend } from "resend";
import { RESERVATION_LABELS, type ReservationType } from "./types";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = "Trek Folio <notifications@trekfol.io>";

interface AddedEmailOptions {
  to: string;
  userName?: string | null;
  providerName: string;
  type: ReservationType;
  tripName?: string | null;
  reservationId: string;
  tripId?: string | null;
}

/**
 * Send the "we added your reservation" confirmation email.
 * Uses inline styles so it renders consistently across clients.
 */
export async function sendReservationAddedEmail(opts: AddedEmailOptions) {
  const { to, userName, providerName, type, tripName, reservationId, tripId } =
    opts;

  const greeting = userName ? `Hi ${userName.split(" ")[0]},` : "Hi,";
  const typeLabel = RESERVATION_LABELS[type];
  const detailUrl = tripId
    ? `https://trekfol.io/trips/${tripId}/reservations/${reservationId}`
    : `https://trekfol.io/inbox`;
  const tripLine = tripName
    ? `It's been added to your <strong>${tripName}</strong> trip.`
    : `We couldn't auto-match it to a trip — visit your inbox to assign one.`;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:40px 20px;background:#FAF8F3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:520px;margin:0 auto;background:#FFFFFF;border:0.5px solid #E0D8C8;border-radius:12px;padding:40px;">
    <p style="font-size:9px;font-weight:400;letter-spacing:0.16em;text-transform:uppercase;color:#8A7E68;margin:0 0 12px 0;">Reservation added</p>
    <h1 style="font-family:Georgia,serif;font-weight:300;font-size:36px;line-height:1.1;color:#1A1814;margin:0 0 24px 0;letter-spacing:-0.02em;">
      ${escapeHtml(providerName)}
    </h1>
    <p style="font-size:14px;line-height:1.6;color:#1A1814;margin:0 0 8px 0;">${greeting}</p>
    <p style="font-size:14px;line-height:1.6;color:#1A1814;margin:0 0 24px 0;">
      Your ${escapeHtml(typeLabel)} reservation has been parsed and added to Trek Folio. ${tripLine}
    </p>
    <a href="${detailUrl}" style="display:inline-block;background:#1A1814;color:#FFFFFF;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:11px;font-weight:500;letter-spacing:0.16em;text-transform:uppercase;">
      View reservation
    </a>
    <p style="font-size:11px;font-weight:300;color:#8A7E68;margin:32px 0 0 0;border-top:0.5px solid #EAE5D9;padding-top:16px;">
      Trek Folio · trekfol.io
    </p>
  </div>
</body>
</html>`.trim();

  try {
    await resend.emails.send({
      from: FROM,
      to,
      subject: `${providerName} added to Trek Folio`,
      html,
    });
  } catch (err) {
    console.error("[sendReservationAddedEmail] failed:", err);
    // Don't throw — notification failure shouldn't fail the whole webhook
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
