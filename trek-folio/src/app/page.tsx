import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  IoAirplaneOutline,
  IoMapOutline,
  IoImagesOutline,
  IoMailOutline,
} from "react-icons/io5";
import type { IconType } from "react-icons";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/trips");
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Top nav */}
      <nav className="max-w-6xl mx-auto px-6 md:px-9 py-6 flex items-center justify-between">
        <Link
          href="/"
          className="font-display text-[18px] text-tf-ink tracking-[0.08em]"
        >
          TREK FOLIO
        </Link>
        <div className="flex items-center gap-4">
          <Link
            href="/login"
            className="text-[11px] font-medium uppercase tracking-[0.12em] text-tf-muted hover:text-tf-ink"
          >
            Sign in
          </Link>
          <Link href="/signup">
            <Button className="bg-tf-ink hover:bg-tf-ink/90 text-white h-9 px-5 text-[11px] font-medium tracking-[0.12em] uppercase">
              Get started
            </Button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 md:px-9 pt-16 pb-20">
        <p className="micro-label mb-6">A travel hub for the curious</p>
        <h1 className="font-display text-[72px] md:text-[120px] text-tf-ink leading-[0.92] tracking-[-0.03em] mb-8 max-w-4xl">
          Your entire trip,
          <br />
          one place.
        </h1>
        <div className="pb-6 editorial-rule max-w-3xl">
          <p className="text-lg md:text-xl text-tf-muted font-light max-w-2xl leading-relaxed">
            Itineraries, reservations, photos, and maps. Everything you need
            for every trip, organized with the care of a travel magazine.
          </p>
        </div>
        <div className="flex items-center gap-4 mt-8">
          <Link href="/signup">
            <Button className="bg-tf-ink hover:bg-tf-ink/90 text-white h-11 px-8 text-[11px] font-medium tracking-[0.16em] uppercase">
              Start free
            </Button>
          </Link>
          <Link
            href="/login"
            className="text-[11px] font-medium uppercase tracking-[0.16em] text-tf-ink hover:opacity-60"
          >
            Sign in →
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 md:px-9 pb-24">
        <div className="flex items-center gap-3 mb-10">
          <span className="micro-label">What you get</span>
          <span className="flex-1 h-px bg-tf-border-tertiary" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {([
            {
              icon: IoMailOutline,
              eyebrow: "Ingest",
              title: "Reservations",
              desc: "Forward confirmation emails. Flights, hotels, restaurants parse automatically with AI.",
            },
            {
              icon: IoMapOutline,
              eyebrow: "Navigate",
              title: "Interactive maps",
              desc: "Every pin color-coded by type. Search Google Places and save them to a trip.",
            },
            {
              icon: IoImagesOutline,
              eyebrow: "Remember",
              title: "Photo gallery",
              desc: "Upload and tag photos to specific days or reservations. Share a link with anyone.",
            },
            {
              icon: IoAirplaneOutline,
              eyebrow: "Plan",
              title: "Day-by-day",
              desc: "A clean timeline of every reservation across the trip. Print or export as PDF.",
            },
          ] as Array<{ icon: IconType; eyebrow: string; title: string; desc: string }>).map(
            (feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="tf-card-cream p-6 hover:shadow-sm transition-shadow"
                >
                  <Icon className="text-tf-ink mb-6" style={{ fontSize: 26 }} />
                  <p className="micro-label mb-2">{feature.eyebrow}</p>
                  <h3 className="font-display-roman text-[22px] text-tf-ink mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-[12px] font-light text-tf-muted leading-relaxed">
                    {feature.desc}
                  </p>
                </div>
              );
            }
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-tf-border-tertiary">
        <div className="max-w-6xl mx-auto px-6 md:px-9 py-8 flex items-center justify-between">
          <span className="micro-label">Trek Folio · 2026</span>
          <span className="micro-label">trekfol.io</span>
        </div>
      </footer>
    </div>
  );
}
