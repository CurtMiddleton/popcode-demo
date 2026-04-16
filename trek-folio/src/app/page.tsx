import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
import { Button } from "@/components/ui/button";
import { Plane, Map, Camera, Inbox } from "lucide-react";

export default async function LandingPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/trips");
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      {/* Hero */}
      <div className="max-w-6xl mx-auto px-6 pt-20 pb-16">
        <nav className="flex items-center justify-between mb-20">
          <div className="flex items-center gap-2">
            <Plane className="h-7 w-7 text-primary" />
            <span className="text-xl font-bold">Trek Folio</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost">Sign in</Button>
            </Link>
            <Link href="/signup">
              <Button>Get started</Button>
            </Link>
          </div>
        </nav>

        <div className="text-center max-w-3xl mx-auto">
          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight mb-6">
            Your entire trip,{" "}
            <span className="text-primary">one place</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
            Itineraries, reservations, photos, and maps — everything you need
            for every trip, organized beautifully.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link href="/signup">
              <Button size="lg" className="text-base px-8">
                Start free
              </Button>
            </Link>
          </div>
        </div>

        {/* Features grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-24">
          {[
            {
              icon: Plane,
              title: "Reservations",
              desc: "Forward confirmation emails — flights, hotels, restaurants parsed automatically.",
            },
            {
              icon: Map,
              title: "Interactive Maps",
              desc: "See all your pins on a map, color-coded by type. Search and save places.",
            },
            {
              icon: Camera,
              title: "Photo Gallery",
              desc: "Upload and tag photos to specific days or reservations. Share with anyone.",
            },
            {
              icon: Inbox,
              title: "Email Inbox",
              desc: "Forward any booking confirmation and we'll parse it with AI instantly.",
            },
          ].map((feature) => (
            <div
              key={feature.title}
              className="p-6 rounded-xl border bg-card hover:shadow-md transition-shadow"
            >
              <feature.icon className="h-10 w-10 text-primary mb-4" />
              <h3 className="font-semibold mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t mt-20">
        <div className="max-w-6xl mx-auto px-6 py-8 flex items-center justify-between text-sm text-muted-foreground">
          <span>Trek Folio</span>
          <span>trekfol.io</span>
        </div>
      </footer>
    </div>
  );
}
