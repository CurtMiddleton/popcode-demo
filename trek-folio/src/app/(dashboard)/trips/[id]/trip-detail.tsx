"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format, parseISO, startOfDay } from "date-fns";
import {
  IoArrowBackOutline,
  IoPencilOutline,
  IoTrashOutline,
  IoLocationOutline,
  IoCalendarOutline,
  IoAddOutline,
  IoChevronForwardOutline,
} from "react-icons/io5";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { IconTile } from "@/components/icon-tile";
import { TypePill } from "@/components/type-pill";
import { ReservationFormDialog } from "@/components/reservation-form-dialog";
import { PlanPickerDialog } from "@/components/plan-picker-dialog";
import { deleteReservation } from "@/lib/reservations";
import { cn } from "@/lib/utils";
import {
  RESERVATION_LABELS,
  RESERVATION_COLOR_KEY,
  type ReservationType,
} from "@/lib/types";
import type { Trip, Reservation } from "@/lib/types";

interface TripDetailProps {
  trip: Trip;
  reservations: Reservation[];
  userId: string;
}

export function TripDetail({ trip, reservations, userId }: TripDetailProps) {
  const router = useRouter();
  const supabase = createClient();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [resFormOpen, setResFormOpen] = useState(false);
  const [pickedType, setPickedType] = useState<ReservationType | null>(null);

  function openAddPlan() {
    setPickerOpen(true);
  }

  function handleTypePicked(type: ReservationType) {
    setPickedType(type);
    setResFormOpen(true);
  }
  const [name, setName] = useState(trip.name);
  const [destination, setDestination] = useState(trip.destination ?? "");
  const [startDate, setStartDate] = useState(trip.start_date ?? "");
  const [endDate, setEndDate] = useState(trip.end_date ?? "");
  const [saving, setSaving] = useState(false);

  // Group reservations by day (scheduled vs unscheduled)
  const reservationsByDay = useMemo(() => {
    const groups = new Map<string, Reservation[]>();
    for (const res of reservations) {
      const key = res.start_datetime
        ? format(startOfDay(parseISO(res.start_datetime)), "yyyy-MM-dd")
        : "unscheduled";
      const list = groups.get(key) ?? [];
      list.push(res);
      groups.set(key, list);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [reservations]);

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

  const displayName = trip.destination || trip.name;

  return (
    <div className="max-w-5xl mx-auto">
      {/* Back link */}
      <Link
        href="/trips"
        className="inline-flex items-center gap-1.5 text-[11px] font-medium text-tf-muted hover:text-tf-ink mb-6 uppercase tracking-[0.12em]"
      >
        <IoArrowBackOutline style={{ fontSize: 13 }} />
        All trips
      </Link>

      {/* Editorial header */}
      <header className="mb-10">
        <div className="pb-6 editorial-rule">
          <p className="micro-label mb-3">{trip.name}</p>
          <div className="flex items-start justify-between gap-6">
            <h1 className="font-display text-[56px] md:text-[72px] text-tf-ink leading-[0.92] break-words">
              {displayName}
            </h1>
            <div className="flex items-center gap-2 shrink-0 pt-3">
              <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 border-tf-border-tertiary text-tf-ink"
                  >
                    <IoPencilOutline className="mr-1.5" style={{ fontSize: 13 }} />
                    Edit
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <form onSubmit={handleUpdate}>
                    <DialogHeader>
                      <DialogTitle className="font-display text-3xl font-normal tracking-tight">
                        Edit trip
                      </DialogTitle>
                      <DialogDescription>
                        Update your trip details.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label className="micro-label">Trip name</Label>
                        <Input
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="micro-label">Destination</Label>
                        <Input
                          value={destination}
                          onChange={(e) => setDestination(e.target.value)}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="micro-label">Start date</Label>
                          <Input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="micro-label">End date</Label>
                          <Input
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
                        disabled={saving}
                        className="bg-tf-ink hover:bg-tf-ink/90 text-white"
                      >
                        {saving ? "Saving..." : "Save changes"}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
              <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 border-tf-border-tertiary text-tf-muted"
                  >
                    <IoTrashOutline style={{ fontSize: 13 }} />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="font-display text-3xl font-normal tracking-tight">
                      Delete trip
                    </DialogTitle>
                    <DialogDescription>
                      Are you sure you want to delete &ldquo;{trip.name}&rdquo;?
                      This will also delete all reservations and photos. This
                      cannot be undone.
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
        {/* Meta row below the rule */}
        <div className="flex items-center gap-6 mt-5 text-[11px] font-light text-tf-muted">
          {trip.destination && (
            <span className="flex items-center gap-1.5">
              <IoLocationOutline style={{ fontSize: 12 }} />
              {trip.destination}
            </span>
          )}
          {trip.start_date && (
            <span className="flex items-center gap-1.5">
              <IoCalendarOutline style={{ fontSize: 12 }} />
              {format(parseISO(trip.start_date), "MMM d, yyyy")}
              {trip.end_date &&
                ` — ${format(parseISO(trip.end_date), "MMM d, yyyy")}`}
            </span>
          )}
          <span className="flex items-center gap-1.5">
            {reservations.length}{" "}
            {reservations.length === 1 ? "plan" : "plans"}
          </span>
        </div>
      </header>

      {/* Tabs */}
      <Tabs defaultValue="itinerary">
        <TabsList className="bg-tf-cream border border-tf-cream-border h-10 rounded-[10px] p-1">
          <TabsTrigger
            value="itinerary"
            className="text-[11px] font-medium uppercase tracking-[0.12em] data-[state=active]:bg-white"
          >
            Itinerary
          </TabsTrigger>
          <TabsTrigger
            value="map"
            className="text-[11px] font-medium uppercase tracking-[0.12em] data-[state=active]:bg-white"
          >
            Map
          </TabsTrigger>
          <TabsTrigger
            value="photos"
            className="text-[11px] font-medium uppercase tracking-[0.12em] data-[state=active]:bg-white"
          >
            Photos
          </TabsTrigger>
          <TabsTrigger
            value="reservations"
            className="text-[11px] font-medium uppercase tracking-[0.12em] data-[state=active]:bg-white"
          >
            Plans
          </TabsTrigger>
          <TabsTrigger
            value="share"
            className="text-[11px] font-medium uppercase tracking-[0.12em] data-[state=active]:bg-white"
          >
            Share
          </TabsTrigger>
        </TabsList>

        <TabsContent value="itinerary" className="mt-8">
          {reservations.length === 0 ? (
            <EmptyItinerary onAdd={openAddPlan} />
          ) : (
            <>
              <div className="flex justify-end mb-4">
                <Button
                  size="sm"
                  onClick={openAddPlan}
                  className="bg-tf-ink hover:bg-tf-ink/90 text-white h-9 text-[11px] font-medium tracking-[0.12em] uppercase"
                >
                  <IoAddOutline className="mr-1.5" style={{ fontSize: 14 }} />
                  Add a Plan
                </Button>
              </div>
              <ItineraryDays
                groups={reservationsByDay}
                tripId={trip.id}
              />
            </>
          )}
        </TabsContent>

        <TabsContent value="map" className="mt-8">
          <Placeholder title="Map view" subtitle="Coming in Phase 5" />
        </TabsContent>

        <TabsContent value="photos" className="mt-8">
          <Placeholder title="Photo gallery" subtitle="Coming in Phase 6" />
        </TabsContent>

        <TabsContent value="reservations" className="mt-8">
          <ReservationsList
            reservations={reservations}
            tripId={trip.id}
            onAdd={openAddPlan}
          />
        </TabsContent>

        <TabsContent value="share" className="mt-8">
          <Placeholder
            title="Sharing & collaboration"
            subtitle="Coming in Phase 7"
          />
        </TabsContent>
      </Tabs>

      {/* Plan picker — opens first when Add a Plan is clicked */}
      <PlanPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onPick={handleTypePicked}
      />

      {/* Reservation form dialog — opens with the picked type pre-selected */}
      <ReservationFormDialog
        open={resFormOpen}
        onOpenChange={(o) => {
          setResFormOpen(o);
          if (!o) setPickedType(null);
        }}
        tripId={trip.id}
        userId={userId}
        initialType={pickedType ?? undefined}
      />
    </div>
  );
}

function EmptyItinerary({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="tf-card-cream py-16 text-center">
      <p className="micro-label mb-3">Empty itinerary</p>
      <h3 className="font-display text-4xl text-tf-ink mb-3">
        No plans yet
      </h3>
      <p className="text-sm text-tf-muted mb-6 max-w-md mx-auto">
        Forward confirmation emails to your Trek Folio address, or add a
        plan by hand.
      </p>
      <Button
        size="sm"
        onClick={onAdd}
        className="bg-tf-ink hover:bg-tf-ink/90 text-white h-9 text-[11px] font-medium tracking-[0.12em] uppercase"
      >
        <IoAddOutline className="mr-1.5" style={{ fontSize: 14 }} />
        Add a Plan
      </Button>
    </div>
  );
}

function ItineraryDays({
  groups,
  tripId,
}: {
  groups: [string, Reservation[]][];
  tripId: string;
}) {
  return (
    <div className="tf-card overflow-hidden">
      {groups.map(([dayKey, items], idx) => (
        <div
          key={dayKey}
          className={cn(idx > 0 && "border-t border-tf-border-tertiary")}
        >
          {/* Day header — THE one place italic serif appears */}
          <div className="flex items-baseline justify-between px-6 py-4 border-b border-tf-border-tertiary">
            <div className="flex items-baseline gap-3">
              <h3 className="font-display-italic text-[26px] text-tf-ink">
                {dayKey === "unscheduled"
                  ? "Unscheduled"
                  : format(parseISO(dayKey), "EEEE, MMMM d")}
              </h3>
              {dayKey !== "unscheduled" && (
                <span className="micro-label">
                  {format(parseISO(dayKey), "yyyy")}
                </span>
              )}
            </div>
            <span className="micro-label">
              {items.length} {items.length === 1 ? "item" : "items"}
            </span>
          </div>

          {/* Reservation rows */}
          {items.map((res, rowIdx) => (
            <ReservationRow
              key={res.id}
              res={res}
              tripId={tripId}
              showBorder={rowIdx < items.length - 1}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function ReservationRow({
  res,
  tripId,
  showBorder,
}: {
  res: Reservation;
  tripId: string;
  showBorder: boolean;
}) {
  const typeColorVar = `var(--tf-${RESERVATION_COLOR_KEY[res.type]})`;
  return (
    <Link
      href={`/trips/${tripId}/reservations/${res.id}`}
      className={cn(
        "flex items-center gap-4 px-6 py-4 bg-white hover:bg-tf-cream/50 transition-colors group",
        showBorder && "border-b border-tf-border-tertiary"
      )}
    >
      <IconTile type={res.type} size="sm" />
      <div className="flex-1 min-w-0">
        {res.start_datetime && (
          <p
            className="micro-label mb-0.5"
            style={{ color: typeColorVar }}
          >
            {format(parseISO(res.start_datetime), "h:mm a")}
          </p>
        )}
        <p className="font-display-roman text-[16px] text-tf-ink truncate">
          {res.provider_name ?? RESERVATION_LABELS[res.type]}
        </p>
        {(res.address || res.confirmation_number) && (
          <p className="text-[10px] font-light text-tf-muted truncate mt-0.5">
            {res.address}
            {res.confirmation_number && (
              <>
                {res.address && " · "}
                <span className="font-mono">{res.confirmation_number}</span>
              </>
            )}
          </p>
        )}
      </div>
      <TypePill type={res.type} />
      <IoChevronForwardOutline
        className="text-tf-muted opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ fontSize: 14 }}
      />
    </Link>
  );
}

function ReservationsList({
  reservations,
  tripId,
  onAdd,
}: {
  reservations: Reservation[];
  tripId: string;
  onAdd: () => void;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(id: string) {
    if (!confirm("Delete this plan?")) return;
    setDeletingId(id);
    try {
      await deleteReservation(supabase, id);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setDeletingId(null);
    }
  }

  if (reservations.length === 0) {
    return (
      <div className="tf-card-cream py-16 text-center">
        <p className="micro-label mb-3">No plans</p>
        <h3 className="font-display text-4xl text-tf-ink mb-6">
          Add your first plan
        </h3>
        <Button
          size="sm"
          onClick={onAdd}
          className="bg-tf-ink hover:bg-tf-ink/90 text-white h-9 text-[11px] font-medium tracking-[0.12em] uppercase"
        >
          <IoAddOutline className="mr-1.5" style={{ fontSize: 14 }} />
          Add a Plan
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <span className="micro-label">
          All plans · {reservations.length}
        </span>
        <Button
          size="sm"
          onClick={onAdd}
          className="bg-tf-ink hover:bg-tf-ink/90 text-white h-9 text-[11px] font-medium tracking-[0.12em] uppercase"
        >
          <IoAddOutline className="mr-1.5" style={{ fontSize: 14 }} />
          Add a Plan
        </Button>
      </div>

      <div className="tf-card overflow-hidden">
        {reservations.map((res, idx) => (
          <div
            key={res.id}
            className={cn(
              "flex items-center gap-4 px-6 py-4 bg-white group",
              idx < reservations.length - 1 &&
                "border-b border-tf-border-tertiary"
            )}
          >
            <IconTile type={res.type} size="sm" />
            <Link
              href={`/trips/${tripId}/reservations/${res.id}`}
              className="flex-1 min-w-0 hover:opacity-70 transition-opacity"
            >
              <p className="font-display-roman text-[16px] text-tf-ink truncate">
                {res.provider_name ?? RESERVATION_LABELS[res.type]}
              </p>
              <p className="text-[10px] font-light text-tf-muted truncate mt-0.5">
                {res.start_datetime
                  ? format(parseISO(res.start_datetime), "MMM d, yyyy · h:mm a")
                  : "Unscheduled"}
                {res.confirmation_number && (
                  <>
                    {" · "}
                    <span className="font-mono">
                      {res.confirmation_number}
                    </span>
                  </>
                )}
              </p>
            </Link>
            <TypePill type={res.type} />
            <button
              onClick={() => handleDelete(res.id)}
              disabled={deletingId === res.id}
              className="w-8 h-8 flex items-center justify-center rounded-md text-tf-muted hover:text-destructive hover:bg-destructive/5 transition-colors disabled:opacity-50"
              aria-label="Delete reservation"
            >
              <IoTrashOutline style={{ fontSize: 14 }} />
            </button>
          </div>
        ))}
      </div>
    </>
  );
}

function Placeholder({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div className="tf-card py-20 text-center">
      <p className="micro-label mb-3">{subtitle}</p>
      <h3 className="font-display text-4xl text-tf-ink">{title}</h3>
    </div>
  );
}
