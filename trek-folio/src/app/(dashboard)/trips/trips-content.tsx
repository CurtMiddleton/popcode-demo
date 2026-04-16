"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format, isPast, parseISO } from "date-fns";
import { IoAddOutline, IoLocationOutline } from "react-icons/io5";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/page-header";
import { cn } from "@/lib/utils";
import type { Trip } from "@/lib/types";

interface TripsContentProps {
  initialTrips: Trip[];
  userId: string;
}

export function TripsContent({ initialTrips, userId }: TripsContentProps) {
  const [trips, setTrips] = useState<Trip[]>(initialTrips);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [destination, setDestination] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [creating, setCreating] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const upcomingTrips = trips.filter(
    (t) => !t.end_date || !isPast(parseISO(t.end_date))
  );
  const pastTrips = trips.filter(
    (t) => t.end_date && isPast(parseISO(t.end_date))
  );

  async function handleCreateTrip(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);

    const { data, error } = await supabase
      .from("trips")
      .insert({
        user_id: userId,
        name,
        destination: destination || null,
        start_date: startDate || null,
        end_date: endDate || null,
      })
      .select()
      .single();

    if (error) {
      alert(error.message);
      setCreating(false);
      return;
    }

    setTrips([data, ...trips]);
    setDialogOpen(false);
    setName("");
    setDestination("");
    setStartDate("");
    setEndDate("");
    setCreating(false);
    router.push(`/trips/${data.id}`);
  }

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        eyebrow="Your Travels"
        title="My Trips"
        action={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-tf-ink hover:bg-tf-ink/90 text-white h-9 px-4 text-xs font-medium tracking-wider uppercase">
                <IoAddOutline className="mr-1.5" style={{ fontSize: 14 }} />
                New Trip
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleCreateTrip}>
                <DialogHeader>
                  <DialogTitle className="font-display text-3xl font-normal tracking-tight">
                    Create a new trip
                  </DialogTitle>
                  <DialogDescription>
                    Add a trip to start organizing your travel plans.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="trip-name" className="micro-label">
                      Trip name
                    </Label>
                    <Input
                      id="trip-name"
                      placeholder="Summer in Italy"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="trip-dest" className="micro-label">
                      Destination
                    </Label>
                    <Input
                      id="trip-dest"
                      placeholder="Rome, Italy"
                      value={destination}
                      onChange={(e) => setDestination(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="trip-start" className="micro-label">
                        Start date
                      </Label>
                      <Input
                        id="trip-start"
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="trip-end" className="micro-label">
                        End date
                      </Label>
                      <Input
                        id="trip-end"
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    type="submit"
                    disabled={creating}
                    className="bg-tf-ink hover:bg-tf-ink/90 text-white"
                  >
                    {creating ? "Creating..." : "Create trip"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {/* Empty state */}
      {trips.length === 0 && (
        <div className="text-center py-24 tf-card-cream mx-auto max-w-2xl">
          <p className="micro-label mb-4">No trips yet</p>
          <h2 className="font-display text-5xl text-tf-ink mb-4">
            Where to first?
          </h2>
          <p className="text-sm text-tf-muted mb-8 max-w-sm mx-auto">
            Create your first trip to start organizing your travel plans,
            reservations, and memories.
          </p>
          <Button
            onClick={() => setDialogOpen(true)}
            className="bg-tf-ink hover:bg-tf-ink/90 text-white h-9 px-5 text-xs font-medium tracking-wider uppercase"
          >
            <IoAddOutline className="mr-1.5" style={{ fontSize: 14 }} />
            Create your first trip
          </Button>
        </div>
      )}

      {/* Upcoming */}
      {upcomingTrips.length > 0 && (
        <section className="mb-16">
          <div className="flex items-center gap-3 mb-6">
            <span className="micro-label">Upcoming · {upcomingTrips.length}</span>
            <span className="flex-1 h-px bg-tf-border-tertiary" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {upcomingTrips.map((trip) => (
              <TripCard key={trip.id} trip={trip} variant="active" />
            ))}
          </div>
        </section>
      )}

      {/* Past */}
      {pastTrips.length > 0 && (
        <section>
          <div className="flex items-center gap-3 mb-6">
            <span className="micro-label">Past · {pastTrips.length}</span>
            <span className="flex-1 h-px bg-tf-border-tertiary" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {pastTrips.map((trip) => (
              <TripCard key={trip.id} trip={trip} variant="past" />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function TripCard({
  trip,
  variant,
}: {
  trip: Trip;
  variant: "active" | "past";
}) {
  const router = useRouter();
  const displayName = trip.destination || trip.name;

  const dateRange =
    trip.start_date && trip.end_date
      ? `${format(parseISO(trip.start_date), "MMM d")} — ${format(
          parseISO(trip.end_date),
          "MMM d, yyyy"
        )}`
      : trip.start_date
      ? format(parseISO(trip.start_date), "MMM d, yyyy")
      : "Dates not set";

  return (
    <button
      onClick={() => router.push(`/trips/${trip.id}`)}
      className={cn(
        "text-left w-full transition-colors group",
        "px-7 py-6",
        variant === "active"
          ? "tf-card-cream hover:bg-[#F5F1E8]"
          : "tf-card hover:bg-tf-cream/40 opacity-80 hover:opacity-100"
      )}
    >
      <p className="micro-label mb-3">
        {variant === "active" ? "Upcoming" : "Archive"} · {trip.name}
      </p>
      <h3
        className={cn(
          "font-display text-tf-ink leading-[0.95] mb-4 break-words",
          variant === "active"
            ? "text-[56px] md:text-[64px] tracking-[-0.03em]"
            : "text-[36px] md:text-[40px] tracking-[-0.015em]"
        )}
      >
        {displayName}
      </h3>
      <div className="flex items-center justify-between text-[11px] font-light text-tf-muted">
        <span className="flex items-center gap-1.5">
          <IoLocationOutline style={{ fontSize: 12 }} />
          {trip.destination || "—"}
        </span>
        <span>{dateRange}</span>
      </div>
    </button>
  );
}
