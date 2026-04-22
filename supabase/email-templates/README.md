# Popcode — branded email templates

All of Popcode's outbound email lives here: the Supabase Auth transactional flows (Confirm signup, Reset password, Magic link, Change email, Invite), the beta-feedback thank-you (sent from an Edge Function), and a signature block for manual replies from `info@popcodeapp.com`. Supabase does **not** import template files — the dashboard is the runtime source of truth for auth emails. This folder is the design source so we can edit, diff, and re-paste. Same pattern as the RLS policies and RPC SQL (server-side, not in git).

## Files

| File | Used by | Variables |
|---|---|---|
| `confirm-signup.html` | Supabase Auth → Confirm signup | `{{ .ConfirmationURL }}` |
| `reset-password.html` | Supabase Auth → Reset Password | `{{ .ConfirmationURL }}` |
| `magic-link.html` | Supabase Auth → Magic Link | `{{ .ConfirmationURL }}` |
| `change-email.html` | Supabase Auth → Change Email Address | `{{ .ConfirmationURL }}`, `{{ .Email }}`, `{{ .NewEmail }}` |
| `invite.html` | Supabase Auth → Invite user | `{{ .ConfirmationURL }}` |
| `beta-feedback-thanks.html` | Edge Function `send-beta-feedback-thanks` (mirrored inline in `supabase/functions/send-beta-feedback-thanks/template.ts`) | `{{DESCRIPTION}}`, `{{PAGE_URL}}` |
| `reply-signature.html` | Manual signature paste for info@popcodeapp.com in Apple Mail / Gmail / Outlook | — |

## 1. Supabase Auth templates (Confirm signup, Reset password, Magic link, Change email, Invite)

### Paste into the dashboard

1. Open **Supabase Dashboard → Authentication → Email Templates**.
2. Pick the template tab (Confirm signup, Invite user, Magic Link, Change Email Address, Reset Password).
3. Copy the entire HTML from the matching file here, paste into the dashboard's **Message body** field.
4. Set the **Subject** (suggestions below).
5. Click **Save**.

### Suggested subjects

| Template | Subject |
|---|---|
| Confirm signup | `Confirm your Popcode account` |
| Reset password | `Reset your Popcode password` |
| Magic link | `Your Popcode sign-in link` |
| Change email | `Confirm your new Popcode email` |
| Invite user | `You're invited to Popcode` |

### Template variables Supabase exposes

- `{{ .ConfirmationURL }}` — the full action URL. **Use this, not `{{ .Token }}`.**
- `{{ .Token }}` — 6-digit code, for code-style flows.
- `{{ .TokenHash }}` — longer token hash, for custom verification flows.
- `{{ .SiteURL }}` — configured Site URL from Auth settings.
- `{{ .Email }}` — recipient's current email address.
- `{{ .NewEmail }}` — only populated on Change Email Address.
- `{{ .RedirectTo }}` — optional redirect target.

## 2. Custom SMTP for deliverability (STRONGLY recommended)

Pretty templates still ship from Supabase's default shared SMTP by default, which is heavily rate-limited (a few emails per hour on free/Pro) and not great for inbox placement. Put a real sender behind it before inviting beta users.

1. Create an account at **[resend.com](https://resend.com)** (free tier: 100/day, 3000/month, plenty for now).
2. Add **popcodeapp.com** under Resend → Domains, copy the SPF/DKIM records (usually 3: one TXT for SPF, two CNAMEs for DKIM).
3. Add those records in Squarespace → Domains → DNS settings for popcodeapp.com. Wait for Resend to show "Verified" (usually 5–30 min).
4. In Resend → API Keys, create a key with "Sending access" scope. Copy it (starts with `re_`).
5. In **Supabase Dashboard → Authentication → Auth Providers → SMTP Settings**, toggle **Enable custom SMTP** and fill in:
   - Host: `smtp.resend.com`
   - Port: `465` (TLS) or `587` (STARTTLS)
   - Username: `resend`
   - Password: *(the API key from step 4)*
   - Sender email: `info@popcodeapp.com`
   - Sender name: `Popcode`
6. Click **Save**. Trigger a password reset to yourself to verify.

If Resend isn't the right fit later, Postmark and Amazon SES work identically — same SMTP config slot, same DNS pattern.

## 3. Beta feedback thank-you email (Edge Function)

Sends automatically after a user submits the beta feedback widget with an email address. Triggered from `public/beta-feedback.js` after the DB insert.

### One-time setup

1. **Custom SMTP for Auth is NOT sufficient here** — the Edge Function calls the Resend REST API directly. You still need a Resend API key, but it's stored as a function secret (not the SMTP setting above). If you already set up Resend in section 2, reuse the same API key.
2. Install the Supabase CLI locally if you haven't: `brew install supabase/tap/supabase`.
3. From the repo root, link once per machine: `supabase link --project-ref <your-project-ref>` (ref is in the Supabase dashboard URL).
4. Set the function secret:
   ```bash
   supabase secrets set RESEND_API_KEY=re_your_key_here
   # Optional overrides (defaults shown):
   # supabase secrets set FROM_EMAIL="Popcode <info@popcodeapp.com>"
   # supabase secrets set REPLY_TO_EMAIL="info@popcodeapp.com"
   ```
5. Deploy:
   ```bash
   supabase functions deploy send-beta-feedback-thanks --no-verify-jwt
   ```
   `--no-verify-jwt` is intentional — the widget posts anonymously from the public site. The body is low-value (it just triggers a thank-you email to whoever submitted), and Resend's sender-domain verification prevents abuse of our `from` address.
6. Test: open any logged-out page on popcode.app, click the Beta Feedback pill, submit with your own email. The thank-you should arrive in under 30 seconds. Check Supabase Dashboard → Edge Functions → Logs if it doesn't.

### Editing the template

`beta-feedback-thanks.html` in this folder is the design source. The function bundles its own copy at `supabase/functions/send-beta-feedback-thanks/template.ts`. When the design changes:

1. Edit `beta-feedback-thanks.html`.
2. Copy the full `<!DOCTYPE html>…</html>` into the `THANKS_HTML` template literal in `template.ts`, preserving the `{{DESCRIPTION}}` and `{{PAGE_URL}}` placeholders.
3. Re-deploy: `supabase functions deploy send-beta-feedback-thanks --no-verify-jwt`.

### Failure behavior

`beta-feedback.js` calls the function fire-and-forget — if it fails or isn't deployed, the widget still shows its success state and the DB insert is preserved. No user-visible impact. Monitor the Edge Function logs if deliverability looks wrong.

## 4. Manual replies from info@popcodeapp.com

`reply-signature.html` is a compact brand signature for pasting into Apple Mail / Gmail / Outlook when replying by hand. Instructions are at the top of that file. It's not wired to anything — it's just a designed block you'd install once in your mail client.

For longer-form broadcasts (beta-wide announcements, onboarding nudges, changelog digests), use one of the transactional templates in this folder as a starting point and send via Resend's dashboard or a mailing tool like Loops/Customer.io. We deliberately haven't built a newsletter pipeline; those should go through a tool designed for it, not our Edge Functions.

## Design notes (for future edits)

- **Brand gradient**: `linear-gradient(135deg, #7657FC 0%, #589AF9 100%)` — matches `site-header` on auth.html and the primary `.submit-btn`.
- **Body background**: `#f2f0eb` — matches the site's warm off-white.
- **Card**: white, `border-radius: 20px`, soft shadow — matches `.card` on auth.html.
- **Font stack**: `'Helvetica Neue', Helvetica, Arial, sans-serif`. Email clients don't reliably render custom web fonts, so we don't load FilsonPro. The bold weight + letter-spacing on the wordmark keeps it close to the site look.
- **Wordmark**: live text, not an image. Renders even when the client blocks images (Gmail default on desktop).
- **Layout**: table-based with inline styles only — required for Outlook and most enterprise clients. Don't refactor into semantic divs or move styles into a `<style>` block without testing across clients.
- **CTA button**: styled `<a>` inside a table cell with `background-color` (solid fallback) + `background-image` (gradient). Outlook shows the solid purple; everything else gets the gradient.
- **Fallback link**: every transactional template also shows the raw URL under the button.

## Cross-client test checklist

After pasting / deploying, send a test to yourself and check:

- Gmail web
- Apple Mail (iOS)
- Gmail iOS app
- Outlook web — renders differently from everything else; the solid fallback color should be visible even if the gradient isn't

Confirm: gradient visible (or solid fallback), CTA tappable, raw link fallback present, no literal `{{ .ConfirmationURL }}` / `{{DESCRIPTION}}` showing (means substitution didn't run).
