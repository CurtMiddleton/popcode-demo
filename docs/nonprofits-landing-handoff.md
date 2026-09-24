# Handoff: Popcode for Nonprofits landing page

**Owner:** Curt Middleton · **Repo:** github.com/CurtMiddleton/popcode-demo · **Route:** `popcode.app/nonprofits`
**Goal:** A single page that explains the nonprofit offer and books intro calls. Live by the week of Oct 5, 2026.

---

## 1. Context

Popcode is browser-based AR: a printed photo plays video or audio when someone points their phone at it. No app, no QR code, no account for the viewer. The printed piece carries a short address (e.g. `popcode.app/{handle}`); the viewer opens it, then scans the photo.

**Popcode for Nonprofits** is a services-plus-platform offer: we design a printed fundraising piece (first target: Giving Tuesday / year-end appeals), set its photos to play, and give the org a branded story page with action buttons and an impact dashboard. The first pilot is Green Empowerment (pro bono, Giving Tuesday 2026). Its results will become the case study on this page.

This page is one of the **siloed landing pages** under a single codebase and brand (like `/albums`, `/art-shows`, `/cards`). It is not a separate site.

---

## 2. Non-negotiables

- **Brand:** use the design system, fonts, colors, and components that already exist in the repo. Do not invent a new look. If the repo's tokens conflict with anything in this doc, the repo wins.
- **No QR codes anywhere.** Not in imagery, icons, illustrations, or copy (other than saying "no QR code"). Anti-QR is a brand pillar.
- **Language rules:** "point your phone at" is for marketing copy (this page). "Scan" is the verb in printed instructions and on the player button. The dashboard may say "scans."
- **Honest mechanics:** always show that donors first go to a short address, then point their phone. Never imply it's instant or automatic.
- **No invented stats or testimonials.** Use clearly marked placeholders until the pilot produces real numbers.
- **Don't say "CTA"** on the page. Name the actions (donate, volunteer, sign up, share).

---

## 3. Page structure and copy

Copy below is approved. Keep it verbatim unless it breaks the layout; flag any changes.

### Hero
- **Headline:** Make your mission play.
- **Subhead:** Popcode turns the photos in your printed appeals, programs, and thank-you cards into video. Donors point their phone at the photo, and the people you serve tell the story themselves. No app. No QR code.
- **Primary button:** Book a 15-minute demo → `[BOOKING_URL]`
- **Media:** demo video beside the copy (`[DEMO_VIDEO]`, ~45 seconds, a phone scanning a printed appeal card). Muted autoplay loop with captions, plus a play-with-sound control. Use a poster image placeholder until the video exists.

### How it works (three steps)
1. Your donor goes to a short address printed on the piece, like *yourorg.org/story*.
2. They point their phone at the photo.
3. The story plays, followed by the next step you choose: donate, volunteer, sign up, or share.

### What you get
- **A piece designed for Giving Tuesday.** A year-end appeal designed by a team with 20 years of nonprofit work, built to be scanned as well as read.
- **Your own story page.** Your logo, your colors, and an intro in your words. Donors feel they're visiting you, not a tech platform.
- **Buttons that turn feeling into action.** Donate, volunteer, subscribe, or share, one tap away at the moment a donor is most moved.
- **Your own web address.** Print *yourorg.org/story* on the piece so your name leads.
- **An impact dashboard.** See how many donors watched, which stories they chose, and how many tapped donate. *For the first time, you'll know whether your print worked.*

Show a dashboard image in or beside this section. Source design (sample data, clearly labeled): https://claude.ai/artifact/WwCZF7p7BSrjZrfHNRaJPi. Export a screenshot, restyle it to the repo's brand if needed, and keep a visible "Sample data" label.

### Why it works
- A photo shows the work; a voice makes donors feel it.
- It brings the field to the donor's kitchen table.
- Print finally becomes measurable.
- One video serves your appeal, your gala, your thank-you cards, and your social posts.

### Where to use it
Giving Tuesday and year-end appeals · gala programs and table cards · annual reports · donor thank-you cards · event signage.

### Proof (placeholder)
Reserve a section for the Green Empowerment case study: the printed piece, a short clip, and results. Until then, hide it behind a flag (`SHOW_CASE_STUDY=false`) rather than showing placeholder text publicly.

### Pricing
- **Year-End Kit** from $2,500
- **Gala & Donor Kit** from $4,500
- One line under both: "Printing and postage quoted separately."

### FAQ (accordion, real `<button>` elements)
- **Do donors need an app?** No. It works in the phone's web browser.
- **Will our older donors manage it?** They type a short address and point their phone. The card walks them through it.
- **We don't have video.** A phone video is fine. We'll send you a simple script.
- **How long will it keep working?** Through at least the end of 2027.
- **Can it use our own web address?** Yes. Your web person adds a simple redirect, like yourorg.org/story.
- **Do you collect donor data?** No. Counts are anonymous.
- **How fast can you deliver?** About four weeks from receiving your video.

### Final call to action
- **Line:** Your donors already open your mail. Let them hear who it helps.
- **Button:** Book a demo → `[BOOKING_URL]`

### Footer
Popcode Inc. · link back to popcode.app · privacy note.

---

## 4. Technical requirements

- Static page in the existing app/router; no new framework. Deployed on Vercel with the rest of the site.
- Mobile first: most visitors will arrive from an email on their phone. Test at 390px wide.
- Performance: lazy-load the video, compress the poster image, Lighthouse performance ≥ 90 on mobile.
- Accessibility: semantic headings, captions on video, 4.5:1 text contrast, 44px minimum tap targets, keyboard-usable FAQ.
- SEO / sharing: title "Popcode for Nonprofits — Make your mission play", meta description from the hero subhead, Open Graph image (poster frame or dashboard).
- **Tracking:** keep incoming UTM parameters (our outreach emails will use `utm_source=email&utm_campaign=nonprofit-outreach`) and pass them through to the booking link. Log a "book_demo_click" event using whatever analytics the site already has.
- Config values in one place: `BOOKING_URL`, `DEMO_VIDEO`, `SHOW_CASE_STUDY`.

---

## 5. Out of scope here (separate tasks, for context)

These are app features the page describes. Build them as separate tasks, not in this PR:

1. **Story page intro:** org logo, colors, and a short intro before or after the video.
2. **Custom action buttons** on the story page (label + URL, several per page), with automatic UTM tags on outbound links (`utm_source=popcode&utm_medium=print&utm_campaign={campaign}`).
3. **Event logging:** scan, video progress (25/50/75/100%), button tap, and entry address (custom domain redirect vs popcode.app). No personal data.
4. **Impact dashboard** matching the sample design above.
5. Custom domains need no build for now: orgs add a redirect from their domain to `popcode.app/{handle}?via=org`. A redirect usually doesn't carry a referrer, so the `via=org` parameter is how the dashboard knows which address donors used (see the dashboard handoff).

Priority for the Giving Tuesday pilot: 1 and 2 first, then 3; the full dashboard can follow.

---

## 6. Done when

- `popcode.app/nonprofits` is live on Vercel and linked nowhere else yet (outreach emails only).
- All copy above is on the page, in the repo's brand, with no QR imagery.
- Booking button works on mobile and desktop and carries UTMs through.
- Placeholders (`[BOOKING_URL]`, `[DEMO_VIDEO]`, case study) are listed in the PR description so Curt can fill them.
- Lighthouse mobile: performance ≥ 90, accessibility ≥ 95.
