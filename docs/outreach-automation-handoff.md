# Handoff: automating gallery / exhibitions outreach email

Written 2026-11-10 by the nonprofits session. It's for the session working on **Popcode for Exhibitions**
gallery outreach (`docs/exhibitions-outreach-emails.md`, gallery sheet
`docs.google.com/spreadsheets/d/1qguOaOI37s7V1wjm0M9zWdsp13LMjbRJNeue4pTfOl0`).

## What already exists (built 2026-11-09 for the nonprofit Giving Tuesday push)

- **`scripts/outreach-sender.gs`**: a Google Apps Script bound to a tracker sheet. It is installed on the
  *Popcode Nonprofit Tracker* (`1VEkjc_WbdHxHL4qw-MJGnIpjMOkk7XH6f_TbO68jajk`) and running there as
  **curt@popcodeapp.com**. Read the header comment for setup.
- Every 5 minutes it:
  - **sends one email** from the sheet's **"Send list"** tab, only on weekdays from 9:30 to 16:00 ET, with a daily cap
    (50) and a **"Send on"** date per row. Emails are plain text with a signature that includes the postal address.
    It fills in Sent / Sent at / Thread / Status.
  - **watches Gmail** for replies, bounces and auto-replies. It sets Status to Replied / Bounced / Auto-reply and
    emails an **alert** for real replies to `Alerts to` (curt@theworkshop.works).
  - sends **digests** at 8:20, 11:50 and 16:40 ET on weekdays.
  - can send **one same-thread follow-up** after N days, but only to people with no reply. This is OFF by default.
    Turning it on needs Apps Script → Services → **Gmail API**.
- Settings live on a **"Sender settings"** tab:
  - Status RUN/PAUSE
  - cap, sending hours, signature
  - Follow-ups ON/OFF, wait in days, follow-up text
  - Alerts to, Reply alerts, Digest times
  - **Email template**
- **Send list columns:** A `#`, B `Send on` (text like "Wed 11/11", or a date), C Org, D To, E Subject, F Email
  (the full body), G Sent (tick box), H Notes. The script writes I–L itself: Sent at, Thread, Follow-up sent,
  Status. You don't have to write the body in F for each row. Instead, fill in **M–P** (first name, opener,
  example, link number) and put this formula in F:
  `=ARRAYFORMULA(IF(Mx:My="","",SUBSTITUTE(…'Sender settings'!$B$14…)))`.
  F then fills itself in from the template. See rows 78–127 on the nonprofit Send list for a working example.

## Recommended approach for galleries

1. In the gallery sheet, add a **"Send list"** tab with the same A–H columns, plus M–P if you use the template.
   **Give the tab at least 18 columns.** setup() fails on an 8-column grid: "range outside the dimensions".
2. Signed in as **curt@popcodeapp.com**: Extensions → Apps Script, paste `scripts/outreach-sender.gs`, Save,
   run `setup`, then Allow. The unverified-app warning is expected: click **Advanced → Go to … (unsafe)**. That
   link and the consent screen open in a **separate window** that's easy to lose. If the run just spins, look
   for that window, or Stop and Run again. Make sure the chosen account is curt@popcodeapp.com.
3. **Before installing, edit the gallery copy of the script.** Two installs watching the same inbox will
   double-alert otherwise.
   - Change `WATCH[0]` to the **gallery subjects** (from `docs/exhibitions-outreach-emails.md`).
   - **Remove the `form` and `site` WATCH entries.** The nonprofit install already alerts on those.
   - Either set **Digest times** to blank on the gallery sheet, or offset them, e.g. "8:25, 16:45".
4. Set the gallery sheet's time zone to Eastern (File → Settings). The nonprofit tracker is on Pacific, so its
   "Sent at" column reads 3 hours early. That's only a display problem.

## Things that will bite you

- **Never send outreach through the Gmail MCP connector.** It rewrites every link (plain URL, bare domain or
  `<a href>`) into `google.com/url?q=…&ust=…`, in sent mail *and* drafts. Recipients land on Google's
  "Redirect Notice" page. 13 nonprofit emails went out like that on 11/9. Send from the Apps Script, or from
  Apple Mail.
- **Deliverability is shared.** Both sheets send from curt@popcodeapp.com. The nonprofit sheet sends up to
  50/day through Thursday 11/12. Set the gallery cap so the **combined total stays at about 50–70/day**, e.g.
  gallery cap 20. Or start galleries after 11/12, or move galleries to the separate cold domain from "Track B"
  (STATUS.md 2026-10-15).
- **The gallery sequence has 3 emails** (Email 2 on day 4, Email 3 on day 10). The script supports only **one**
  follow-up. Either use it for Email 2 and send Email 3 by hand, or extend `sendOneFollowUp_` with a second
  stage (a new column plus a second text setting).
- Reply detection uses the WATCH subject queries. If the gallery emails use several subject lines, list them
  all with `OR`.
- **Scheduled Claude tasks created from a session can't use the Gmail or Sheets connectors** (this org's
  setting). That's why alerts and digests live in the Apps Script. An AI-written summary would need a routine
  created in claude.ai Routines, with the connectors switched on.
- Sheet writes through the Sheets connector were sometimes blocked by the auto-mode classifier unless the user
  had explicitly asked for that write.

## Useful references

- Gallery short links: `popcode.app/exhibitions/1`–`/5` (chelsea, manhattan, brooklyn, westchester,
  connecticut) → `/exhibitions` with `utm_source=email&utm_campaign=gallery-outreach`. The site's lead alerts
  ("Outreach link opened: …") already work. `RESEND_API_KEY` is set in Vercel.
- Nonprofit equivalent, for comparison: `/givingtuesday/1`–`8`, and the Get started form at `/givingtuesday#start`.
- STATUS.md entries **2026-11-09** (automation, lessons) and **2026-10-15** (gallery round 1, Track B advice).
- The gallery outreach state after 10/15 isn't known to this session. Check the gallery sheet and Sent mail
  before loading a Send list, so nobody gets emailed twice.
