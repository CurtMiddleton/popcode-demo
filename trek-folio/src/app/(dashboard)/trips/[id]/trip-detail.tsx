"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { Trip, Reservation } from "@/lib/types";
import { RESERVATION_COLORS, RESERVATION_LABELS } from "@/lib/types";
import {
  MapPin,
  Calendar,
  Pencil,
  Trash2,
  ArrowLeft,
  Plane,
  Hotel,
  UtensilsCrossed,
  Wine,
  Compass,
  Car,
} from "lucide-react";
import Link from "next/link";

const typeIcons = {
  flight: Plane,
  hotel: Hotel,
  restaurant: UtensilsCrossed,
  bar: Wine,
  activity: Compass,
  car_rental: Car,
};

interface TripDetailProps {
  trip: Trip;
  reservations: Reservation[];
  userId: string;
}

export function TripDetail({ trip, reservations }: TripDetailProps) {
  const router = useRouter();
  const supabase = createClient();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [name, setName] = useState(trip.name);
  const [destination, setDestination] = useState(trip.destination ?? "");
  const [startDate, setStartDate] = useState(trip.start_date ?? "");
  const [endDate, setEndDate] = useState(trip.end_date ?? "");
  const [saving, setSaving] = useState(false);

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await supabase
      .from("trips")
      .update({
        name,
        destination: destination || null,
        start_date: startDate || null,
        end_date: endDate || null,
      })
      .eq("id", trip.id);
    setSaving(false);
    setEditOpen(false);
    router.refresh();
  }

  async function handleDelete() {
    await supabase.from("trips").delete().eq("id", trip.id);
    router.push("/trips");
    router.refresh();
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Back + header */}
      <div className="mb-6">
        <Link
          href="/trips"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          All trips
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold">{trip.name}</h1>
            <div className="flex items-center gap-4 mt-2 text-muted-foreground">
              {trip.destination && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {trip.destination}
                </span>
              )}
              {trip.start_date && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {format(parseISO(trip.start_date), "MMM d, yyyy")}
                  {trip.end_date &&
                    ` — ${format(parseISO(trip.end_date), "MMM d, yyyy")}`}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Pencil className="h-4 w-4 mr-1" />
                  Edit
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={handleUpdate}>
                  <DialogHeader>
                    <DialogTitle>Edit trip</DialogTitle>
                    <DialogDescription>
                      Update your trip details.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Trip name</Label>
                      <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Destination</Label>
                      <Input
                        value={destination}
                        onChange={(e) => setDestination(e.target.value)}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Start date</Label>
                        <Input
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>End date</Label>
                        <Input
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={saving}>
                      {saving ? "Saving..." : "Save changes"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
            <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete trip</DialogTitle>
                  <DialogDescription>
                    Are you sure you want to delete &ldquo;{trip.name}&rdquo;?
                    This will also delete all reservations and photos. This
                    action cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setDeleteOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button variant="destructive" onClick={handleDelete}>
                    Delete trip
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="itinerary" className="mt-6">
        <TabsList>
          <TabsTrigger value="itinerary">Itinerary</TabsTrigger>
          <TabsTrigger value="map">Map</TabsTrigger>
          <TabsTrigger value="photos">Photos</TabsTrigger>
          <TabsTrigger value="reservations">Reservations</TabsTrigger>
          <TabsTrigger value="share">Share</TabsTrigger>
        </TabsList>

        <TabsContent value="itinerary" className="mt-6">
          {reservations.length === 0 ? (
            <div className="text-center py-16">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
              <h3 className="font-semibold mb-1">No reservations yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Add reservations to build your itinerary.
              </p>
              <Button variant="outline" size="sm">
                Add a reservation
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {reservations.map((res) => {
                const Icon = typeIcons[res.type] ?? Compass;
                const color = RESERVATION_COLORS[res.type];
                return (
                  <Card key={res.id}>
                    <CardContent className="flex items-center gap-4 p-4">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: color + "20" }}
                      >
                        <Icon
                          className="h-5 w-5"
                          style={{ color }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {res.provider_name ?? RESERVATION_LABELS[res.type]}
                        </p>
                        <p className="text-sm text-muted-foreground truncate">
                          {res.address}
                          {res.confirmation_number &&
                            ` · #${res.confirmation_number}`}
                        </p>
                      </div>
                      <div className="text-right text-sm text-muted-foreground">
                        {res.start_datetime && (
                          <p>
                            {format(
                              parseISO(res.start_datetime),
                              "MMM d, h:mm a"
                            )}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="map" className="mt-6">
          <div className="rounded-lg border bg-muted/50 h-96 flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <MapPin className="h-12 w-12 mx-auto mb-2 opacity-30" />
              <p className="font-medium">Map view</p>
              <p className="text-sm">Coming in Phase 5</p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="photos" className="mt-6">
          <div className="rounded-lg border bg-muted/50 h-96 flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-2 opacity-30" />
              <p className="font-medium">Photo gallery</p>
              <p className="text-sm">Coming in Phase 6</p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="reservations" className="mt-6">
          <div className="text-center py-16">
            <p className="text-muted-foreground">
              Reservation management coming in Phase 3
            </p>
          </div>
        </TabsContent>

        <TabsContent value="share" className="mt-6">
          <div className="text-center py-16">
            <p className="text-muted-foreground">
              Sharing & collaboration coming in Phase 7
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
