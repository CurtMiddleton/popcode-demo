import crypto from "node:crypto";

/**
 * Verify the HMAC-SHA256 signature on an incoming Resend webhook.
 *
 * Resend signs inbound webhook payloads using a shared secret. We compute the
 * signature over the raw request body and compare against the header value in
 * constant time to prevent timing attacks.
 *
 * Returns true if the signature matches, false otherwise.
 */
export function verifyResendSignature(
  rawBody: string,
  signature: string | null,
  secret: string | undefined
): boolean {
  if (!secret) {
    // Dev mode: if no secret is configured, skip verification.
    // Warn so this doesn't silently ship to prod.
    console.warn(
      "[webhook-verify] RESEND_WEBHOOK_SECRET not set — signature check skipped"
    );
    return true;
  }
  if (!signature) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  // Resend may prefix the header with "sha256=" or not. Strip it.
  const received = signature.replace(/^sha256=/i, "").trim();

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(received, "hex")
    );
  } catch {
    // Length mismatch → definitely not equal
    return false;
  }
}
