# Popcode — Supabase branded email templates

These HTML files are the design source for the Supabase Auth emails users receive (Confirm signup, Reset password, Magic link, Change email, Invite). Supabase does **not** import template files — the dashboard is the source of truth at runtime. This folder is version-controlled so we can edit the design, diff changes, and re-paste when needed (same pattern as the RLS policies and RPC SQL, which also live server-side).

## Files

| Template | Supabase dashboard name | Variables used |
|---|---|---|
| `confirm-signup.html` | Confirm signup | `{{ .ConfirmationURL }}` |
| `reset-password.html` | Reset Password | `{{ .ConfirmationURL }}` |
| `magic-link.html` | Magic Link | `{{ .ConfirmationURL }}` |
| `change-email.html` | Change Email Address | `{{ .ConfirmationURL }}`, `{{ .Email }}`, `{{ .NewEmail }}` |
| `invite.html` | Invite user | `{{ .ConfirmationURL }}` |

## How to apply a template in Supabase

1. Open **Supabase Dashboard → Authentication → Email Templates**.
2. Pick the template from the tab list (Confirm signup, Invite user, Magic Link, Change Email Address, Reset Password).
3. Open the matching file in this folder, copy the **entire** HTML body, and paste it into the dashboard's **Message body** (HTML source) field.
4. Set the **Subject** (suggestions below).
5. Click **Save**.
6. Repeat for each template.

### Suggested subjects

| Template | Subject |
|---|---|
| Confirm signup | `Confirm your Popcode account` |
| Reset password | `Reset your Popcode password` |
| Magic link | `Your Popcode sign-in link` |
| Change email | `Confirm your new Popcode email` |
| Invite user | `You're invited to Popcode` |

## Design notes

- **Brand gradient**: `linear-gradient(135deg, #7657FC 0%, #589AF9 100%)` — matches `site-header` on auth.html and the primary `.submit-btn` across the app.
- **Body background**: `#f2f0eb` — matches the site's warm off-white.
- **Card**: white, `border-radius: 20px`, soft shadow — matches `.card` on auth.html.
- **Font stack**: `'Helvetica Neue', Helvetica, Arial, sans-serif`. Email clients don't reliably render custom web fonts, so we don't try to load FilsonPro. The bold weight + letter-spacing on the wordmark keeps it close to the site look.
- **Wordmark**: the "Popcode" header is live text, not an image. This guarantees it renders even when the client blocks images (Gmail default on desktop, many corporate clients always). No hotlinked logo to break.
- **Layout**: table-based with inline styles only — required for Outlook and most enterprise email clients. Don't refactor into semantic divs or move styles into a `<style>` block without testing across clients.
- **CTA button**: rendered as a styled `<a>` inside a table cell with `background-color` (solid fallback) + `background-image` (gradient). Outlook will show the solid purple; everything else gets the gradient.
- **Fallback link**: every template also shows the raw URL under the button, for clients that strip links from styled buttons or users who want to copy/paste.

## Template variables reference

Supabase exposes these in Auth email templates (Go text/template syntax):

- `{{ .ConfirmationURL }}` — the full action URL (confirm / reset / magic link). **Use this, not `{{ .Token }}`.**
- `{{ .Token }}` — 6-digit code (only if you want to show a code instead of a link).
- `{{ .TokenHash }}` — longer token hash (for custom verification flows).
- `{{ .SiteURL }}` — configured Site URL from Auth settings.
- `{{ .Email }}` — recipient's current email address.
- `{{ .NewEmail }}` — only populated on the Change Email Address template.
- `{{ .RedirectTo }}` — optional redirect target.

## Testing before going live

1. In Supabase Dashboard → Authentication → URL Configuration, make sure the **Site URL** is `https://popcode.app` (or whatever we want users redirected to after confirming).
2. Paste one template (e.g. Confirm signup) and click Save.
3. Create a throwaway account on `auth.html` with a real inbox you control.
4. Check the received email in:
   - Gmail web
   - Apple Mail (iOS)
   - Gmail iOS app
   - Outlook web (if you can — Outlook renders differently from everything else)
5. Confirm: gradient visible, CTA tappable, raw link fallback present, no broken variables (e.g. literal `{{ .ConfirmationURL }}` showing means the template body wasn't saved as HTML).

## When to re-edit

If a design token changes on the site (brand gradient, card radius, etc.), update the corresponding values in **every** template file in this folder, then re-paste each into the dashboard. A search-and-replace across the folder is the fastest path — the tokens are literal hex values, not CSS variables (email clients don't support CSS vars).
