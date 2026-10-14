# Popcode for Exhibitions — cold outreach to galleries

Three-email sequence for gallery owners/directors. Written 2026-10-13.
Plain text, one link, no images. Send from a second warmed-up domain (see the
2026-10-13 session notes in `docs/STATUS.md`), 30–50 a day per inbox, stop the
sequence when someone replies.

**Copy rules (the user's):** say "point your phone at"; never "in an
afternoon" or "shows that open on Friday" — we build and test the tour in time
for the opening.

## The list

Google Sheet "Popcode gallery outreach list" (owner: the user's Drive):
https://docs.google.com/spreadsheets/d/1qguOaOI37s7V1wjm0M9zWdsp13LMjbRJNeue4pTfOl0/edit

142 venues, researched 2026-10-13 from each venue's own website: Chelsea 33, rest
of Manhattan 34, Brooklyn & Long Island City 16, Westchester & Hudson Valley 26,
Connecticut 33. 121 have a published email ("Ready"); 21 are "Find email"
(contact form only). No emails were guessed. The Status column is a dropdown
(Find email / Ready / In sequence / Replied / Demo booked / Pilot signed / Not
interested / Opted out). "Your hook line" fills {{hook}}. Show dates were current
on 2026-10-13: check before each send.

## Merge fields

| Field | What goes in it | Example |
|---|---|---|
| `{{first_name}}` | The sheet's **Greeting name** column: the contact's first name, or "<Gallery> team" when none is published | Dana |
| `{{gallery}}` | Gallery name | Marsh Street Gallery |
| `{{show}}` | Current or next show title | *Low Tide* |
| `{{artist}}` | The show's artist (or "the artists") | Ellen Park |
| `{{short_link}}` | The sheet's **Short link** column (one per area, so visits and demo bookings show which area they came from) | popcode.app/exhibitions/4 |
| `{{nearby}}` | Westchester and Connecticut only (the user lives in New Rochelle and offers to drop by): "here" (New Rochelle), "next door" (Pelham), "in Westchester," (rest of Westchester), "just across the river" (Rockland), "just over the state line" (Connecticut). For Manhattan/Brooklyn, drop the sentence's first clause: "I'd be glad to show you how it works in your space, or try a demo show first:" | in Westchester, |
| `{{hook}}` | ONE specific line about the show — what a visitor would want to hear about. Write it by hand; this line is what makes the email get read. | the big harbour paintings were made from a rowboat |

The link in every email is the area's short link, `https://{{short_link}}`.
It forwards to /exhibitions tagged utm_source=email, utm_campaign=gallery-outreach,
utm_content=<area> (vercel.json), so visits, sign-ups ("Campaign: email") and
Calendly bookings show which area they came from. Email 2 adds `#try`.

---

## Email 1 — Day 1

**Subject:** an audio tour for {{show}}

Hi {{first_name}},

I saw that {{gallery}} is showing {{show}}. I'd love to hear the story behind
it. For example, that {{hook}}.

That's what Popcode does. I built it so that pointing a phone at a printed photo
instantly plays its video or audio, and customers already use it for photo
albums and nonprofit annual reports. Now I've adapted it for galleries: visitors
tap a small card at your entrance, point their phone at any work, and hear {{artist}} (or you) talk about it in their
own headphones. There's no app and no QR code beside the work. After each stop
they can inquire about the piece or join your list, and you can see which works
people listened to all the way through.

Bring your own recordings or notes, or we'll write and record the stops for
you, and we test the tour in the room before the opening.

I live {{nearby}} in New Rochelle, so I'd be glad to stop by, introduce myself
and show you how it works in your space. Or try a demo show first:
https://{{short_link}}

Best regards,

Curt Middleton
Founder, Popcode · popcode.app
709 Main St, New Rochelle, NY 10801

If this isn't for you, reply "no thanks" and I won't write again.

---

## Email 2 — Day 4

**Subject:** Re: an audio tour for {{show}}

Hi {{first_name}},

A quick follow-up with the details:

- We build your tour: up to 30 works, each with its own audio stop and
  transcript, ready for the opening.
- Your entrance card comes with a locked NFC tag, a QR code and a short address.
- You get a dashboard of scans, listens and inquiries per work.
- Pilot price for the first galleries this season: $1,500 for one show
  (regularly $2,500), in exchange for sharing your results and feedback.
- No audio yet? We write the scripts and record a natural AI voice, from $400
  per 10 stops.

You can try it yourself: download three paintings from our demo show and point
your phone at them.
https://{{short_link}}#try

Would a short call next week work? I can show you a tour for one of your own
works.

Best regards,

Curt Middleton
Founder, Popcode · popcode.app
709 Main St, New Rochelle, NY 10801

If this isn't for you, reply "no thanks" and I won't write again.

---

## Email 3 — Day 10

**Subject:** close the loop?

Hi {{first_name}},

I don't want to fill your inbox. Should I close the loop on this, or is there a
better person at {{gallery}} to talk to about the next show?

Best regards,

Curt Middleton
Founder, Popcode · popcode.app
709 Main St, New Rochelle, NY 10801

If this isn't for you, reply "no thanks" and I won't write again.

---

## Before sending — check these

1. **Pricing (set 2026-10-13):** pilot $1,500 per show (regular $2,500),
   Gallery year $3,900 (regular $6,500), Museum year $7,500 (regular $12,000),
   scripts + AI voice from $400 per 10 stops. Keep these in step with the
   cards on /exhibitions.
2. **"Up to 30 works": tested 2026-10-13.** A 30-painting Popcode scanned
   perfectly on the user's iPhone. Beyond 30 is still untested, and the create
   wizard's batch upload caps a Popcode at 30 images.
3. **Signature + opt-out on every email (done 2026-10-13):** US cold email
   (CAN-SPAM) needs the postal address and a way to opt out in each message,
   not just the first. Honour "no thanks" replies promptly.
4. **The demo works:** the hero phone plays sound, and the Try it yourself
   PDF opens the real tour at popcode.app/wrenalder.
5. **Only US galleries for now.** UK, EU and Canadian rules on cold email are
   stricter.
