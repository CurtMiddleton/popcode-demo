# /exhibitions "Try it yourself": the *At Work* demo tour

A printable PDF of three works from the fictional Wren & Alder show *At Work*.
A visitor prints it or opens it on a computer screen, opens the demo Popcode on
their phone, points the phone at a painting and hears its stop. Same pattern as
the Common Tide postcard on `/nonprofits`.

All three works are at the Art Institute of Chicago (open access, CC0).
Facts below are from the AIC's own catalogue entries (fetched 2026-10-13).

| # | Work | AIC id |
|---|---|---|
| 1 | John Singer Sargent, *The Fountain, Villa Torlonia, Frascati, Italy*, 1907 | 69780 |
| 2 | Edgar Degas, *Yellow Dancers (In the Wings)*, 1874–76 | 18951 |
| 3 | Édouard Manet, *Woman Reading*, 1880–82 | 14591 |

Each stop is about 70 words, roughly 28 seconds, to match the Sargent recording
(ElevenLabs voice "Tala", `public/assets/exhibitions-sargent-stop.mp3`). The
transcript goes in each page's **Transcript** box when the Popcode is made, word
for word as recorded.

---

## 1. Sargent: *The Fountain, Villa Torlonia* (recorded)

The Fountain, Villa Torlonia. John Singer Sargent painted it in 1907, in the garden of a villa outside Rome.

The two figures are his friends, the painters Jane and Wilfrid de Glehn. Jane sits on the stone balustrade at her easel; Wilfrid leans back and watches.

Look at her white smock. Almost none of it is pure white: it's cream, pale blue and green, picking up the sky and the garden around her.

## 2. Degas: *Yellow Dancers (In the Wings)*

Yellow Dancers, in the Wings. Edgar Degas painted it in Paris in the mid-1870s, and finished it just in time for the second Impressionist exhibition.

He puts us backstage at the Paris Opéra, standing in the wings, where the Opéra's wealthy subscribers liked to wander and watch.

Look at the dancers. They aren't performing for us. They're waiting, adjusting a strap, stretching an arm, about to step out into the light.

*ElevenLabs:* Degas is "deh-GAH"; Opéra is "OH-pair-ah". Break tags between paragraphs, as for the Sargent.

**Recorded 2026-10-13:** `public/assets/exh-try-degas-stop.mp3` (26.9 s). The voice kept saying the final "s" of Degas whatever the spelling, so the hiss (3.01–3.11 s, before "painted") was silenced with 6 ms fades. The user approved it.

## 3. Manet: *Woman Reading*

Woman Reading. Édouard Manet painted it around 1880, only a few years before his death.

She seems to be at a Paris café on a cool day: gloves on, a glass of beer at her elbow, a magazine on its wooden holder.

But it's a stage set. Manet built the café in his own studio, and the flowers behind her are one of his own paintings. Look how quickly and loosely the brush moves.

*ElevenLabs:* Édouard Manet is "ay-DWAR man-AY".

---

## Making the demo Popcode (in the app, signed in as the admin account)

1. Create a Popcode named "At Work — Wren & Alder". Three pages, each an
   **audio** page:
   - Image: the same image files used in the PDF (`public/assets/exh-try-*.jpg`,
     once added). The PDF must show exactly these images or scanning won't match.
   - Audio: the stop's MP3.
   - Transcript: the stop's text above.
2. Cover: eyebrow "Wren & Alder", title "At Work", subtitle "Artists and Their
   Subjects", like the hero phone.
3. After the Video buttons (optional): "Plan a visit", "Become a member",
   "Inquire about this work".
4. Send Claude the slug. It goes into the try-it section's scan button, and the
   entrance placard's QR code and address.
