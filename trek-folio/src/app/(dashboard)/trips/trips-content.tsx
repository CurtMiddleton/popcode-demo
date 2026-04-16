"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format, isPast, parseISO } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { Trip } from "@/lib/types";
import { Plus, MapPin, Calendar, Plane } from "lucide-react";

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

  function TripCard({ trip }: { trip: Trip }) {
    return (
      <Card
        className="cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => router.push(`/trips/${trip.id}`)}
      >
        {trip.cover_image_url ? (
          <div
            className="h-40 rounded-t-lg bg-cover bg-center"
            style={{ backgroundImage: `url(${trip.cover_image_url})` }}
          />
        ) : (
          <div className="h-40 rounded-t-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
            <Plane className="h-12 w-12 text-primary/40" />
          </div>
        )}
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">{trip.name}</CardTitle>
          {trip.destination && (
            <CardDescription className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {trip.destination}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {trip.start_date && (
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {format(parseISO(trip.start_date), "MMM d, yyyy")}
              {trip.end_date &&
                ` — ${format(parseISO(trip.end_date), "MMM d, yyyy")}`}
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">My Trips</h1>
          <p className="text-muted-foreground mt-1">
            Plan and manage all your travels
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Trip
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleCreateTrip}>
              <DialogHeader>
                <DialogTitle>Create a new trip</DialogTitle>
                <DialogDescription>
                  Add a trip to start organizing your travel plans.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="trip-name">Trip name</Label>
                  <Input
                    id="trip-name"
                    placeholder="Summer in Italy"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="trip-dest">Destination</Label>
                  <Input
                    id="trip-dest"
                    placeholder="Rome, Italy"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="trip-start">Start date</Label>
                    <Input
                      id="trip-start"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="trip-end">End date</Label>
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
                <Button type="submit" disabled={creating}>
                  {creating ? "Creating..." : "Create trip"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* No trips state */}
      {trips.length === 0 && (
        <div className="text-center py-20">
          <Plane className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
          <h2 className="text-xl font-semibold mb-2">No trips yet</h2>
          <p className="text-muted-foreground mb-6">
            Create your first trip to start organizing your travel.
          </p>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create your first trip
          </Button>
        </div>
      )}

      {/* Upcoming trips */}
      {upcomingTrips.length > 0 && (
        <section className="mb-12">
          <h2 className="text-xl font-semibold mb-4">Upcoming</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {upcomingTrips.map((trip) => (
              <TripCard key={trip.id} trip={trip} />
            ))}
          </div>
        </section>
      )}

      {/* Past trips */}
      {pastTrips.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-4">Past trips</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {pastTrips.map((trip) => (
              <TripCard key={trip.id} trip={trip} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
