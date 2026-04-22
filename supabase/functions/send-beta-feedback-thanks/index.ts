// Supabase Edge Function: send-beta-feedback-thanks
//
// Sends a branded thank-you email via Resend when the beta feedback widget
// is submitted with an email address. Called from public/beta-feedback.js
// after the DB insert succeeds.
//
// Secrets (set with `supabase secrets set`):
//   RESEND_API_KEY     required — re_xxx token from resend.com
//   FROM_EMAIL         optional — defaults to "Popcode <info@popcodeapp.com>"
//   REPLY_TO_EMAIL     optional — defaults to "info@popcodeapp.com"
//
// Deploy:
//   supabase functions deploy send-beta-feedback-thanks --no-verify-jwt
//
// --no-verify-jwt is intentional: the feedback widget posts anonymously from
// the public site. The body is low-value (it just triggers a thank-you email
// to whoever submitted) so we don't gate on auth. Resend's sender domain
// verification is what prevents abuse of our `from` address.

import { THANKS_HTML } from "./template.ts";

const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "Popcode <info@popcodeapp.com>";
const REPLY_TO_EMAIL = Deno.env.get("REPLY_TO_EMAIL") ?? "info@popcodeapp.com";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isValidEmail(value: unknown): value is string {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method not allowed" }), {
      status: 405,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  if (!RESEND_API_KEY) {
    console.error("RESEND_API_KEY not set");
    return new Response(JSON.stringify({ error: "server not configured" }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  let body: { email?: string; description?: string; page_url?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid json" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const { email, description, page_url } = body;

  if (!isValidEmail(email)) {
    return new Response(JSON.stringify({ error: "invalid email" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const safeDescription = escapeHtml((description ?? "").trim().slice(0, 4000));
  const safePageUrl = escapeHtml((page_url ?? "").trim().slice(0, 500));

  const html = THANKS_HTML
    .replaceAll("{{DESCRIPTION}}", safeDescription || "(no description)")
    .replaceAll("{{PAGE_URL}}", safePageUrl || "popcode.app");

  const resendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: email,
      reply_to: REPLY_TO_EMAIL,
      subject: "Thanks for the Popcode feedback",
      html,
    }),
  });

  if (!resendRes.ok) {
    const detail = await resendRes.text();
    console.error("Resend failure", resendRes.status, detail);
    return new Response(JSON.stringify({ error: "send failed" }), {
      status: 502,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ sent: true }), {
    status: 200,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
});
