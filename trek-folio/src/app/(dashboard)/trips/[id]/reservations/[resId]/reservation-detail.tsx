"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import {
  IoArrowBackOutline,
  IoPencilOutline,
  IoTrashOutline,
  IoLocationOutline,
  IoCalendarOutline,
  IoCallOutline,
  IoGlobeOutline,
  IoCashOutline,
  IoAirplaneOutline,
} from "react-icons/io5";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { IconTile } from "@/components/icon-tile";
import { TypePill } from "@/components/type-pill";
import { ReservationFormDialog } from "@/components/reservation-form-dialog";
import { deleteReservation } from "@/lib/reservations";
import {
  RESERVATION_LABELS,
  type Reservation,
  type Flight,
  type Hotel,
} from "@/lib/types";

interface ReservationDetailProps {
  reservation: Reservation;
  flight: Flight | null;
  hotel: Hotel | null;
  trip: { id: string; name: string; destination: string | null };
  userId: string;
}

export function ReservationDetail({
  reservation,
  flight,
  hotel,
  trip,
  userId,
}: ReservationDetailProps) {
  const router = useRouter();
  const supabase = createClient();
  const [editOpen, setEditOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm("Delete this reservation? This cannot be undone.")) return;
    setDeleting(true);
    try {
      await deleteReservation(supabase, reservation.id);
      router.push(`/trips/${trip.id}`);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
      setDeleting(false);
    }
  }

  const displayName = reservation.provider_name ?? RESERVATION_LABELS[reservation.type];

  return (
    <div className="max-w-4xl mx-auto">
      {/* Back to trip */}
      <Link
        href={`/trips/${trip.id}`}
        className="inline-flex items-center gap-1.5 text-[11px] font-medium text-tf-muted hover:text-tf-ink mb-6 uppercase tracking-[0.12em]"
      >
        <IoArrowBackOutline style={{ fontSize: 13 }} />
        {trip.destination || trip.name}
      </Link>

      {/* Editorial header */}
      <header className="mb-10">
        <div className="pb-6 editorial-rule">
          <div className="flex items-start gap-5 mb-3">
            <IconTile type={reservation.type} size="lg" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <TypePill type={reservation.type} />
                {reservation.confirmation_number && (
                  <span className="micro-label">
                    #{reservation.confirmation_number}
                  </span>
                )}
              </div>
              <h1 className="font-display text-[44px] md:text-[56px] text-tf-ink leading-[0.95] break-words">
                {displayName}
              </h1>
            </div>
            <div className="flex items-center gap-2 shrink-0 pt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditOpen(true)}
                className="h-9 border-tf-border-tertiary text-tf-ink"
              >
                <IoPencilOutline className="mr-1.5" style={{ fontSize: 13 }} />
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDelete}
                disabled={deleting}
                className="h-9 border-tf-border-tertiary text-tf-muted hover:text-destructive"
              >
                <IoTrashOutline style={{ fontSize: 13 }} />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Type-specific details */}
      {reservation.type === "flight" && flight && (
        <FlightDetails flight={flight} />
      )}

      {reservation.type === "hotel" && hotel && (
        <HotelDetails hotel={hotel} />
      )}

      {/* Common details */}
      <section className="tf-card p-8 mb-6">
        <p className="micro-label mb-5">Details</p>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
          {reservation.start_datetime && (
            <DetailRow
              label={reservation.type === "hotel" ? "Check-in" : "Start"}
              icon={<IoCalendarOutline style={{ fontSize: 14 }} />}
              value={format(
                parseISO(reservation.start_datetime),
                "EEEE, MMM d, yyyy · h:mm a"
              )}
            />
          )}
          {reservation.end_datetime && (
            <DetailRow
              label={reservation.type === "hotel" ? "Check-out" : "End"}
              icon={<IoCalendarOutline style={{ fontSize: 14 }} />}
              value={format(
                parseISO(reservation.end_datetime),
                "EEEE, MMM d, yyyy · h:mm a"
              )}
            />
          )}
          {reservation.address && (
            <DetailRow
              label="Address"
              icon={<IoLocationOutline style={{ fontSize: 14 }} />}
              value={reservation.address}
              span={2}
            />
          )}
          {reservation.price != null && (
            <DetailRow
              label="Price"
              icon={<IoCashOutline style={{ fontSize: 14 }} />}
              value={`${reservation.currency ?? "USD"} ${reservation.price.toFixed(2)}`}
            />
          )}
        </dl>

        {reservation.notes && (
          <>
            <div className="h-px bg-tf-border-tertiary my-6" />
            <p className="micro-label mb-3">Notes</p>
            <p className="text-sm text-tf-ink whitespace-pre-wrap leading-relaxed">
              {reservation.notes}
            </p>
          </>
        )}
      </section>

      {/* Edit dialog */}
      <ReservationFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        tripId={trip.id}
        userId={userId}
        existing={{ ...reservation, flight, hotel }}
      />
    </div>
  );
}

function DetailRow({
  label,
  icon,
  value,
  span,
}: {
  label: string;
  icon?: React.ReactNode;
  value: string;
  span?: number;
}) {
  return (
    <div className={span === 2 ? "md:col-span-2" : undefined}>
      <dt className="micro-label mb-1 flex items-center gap-1.5">
        {icon}
        {label}
      </dt>
      <dd className="text-[14px] text-tf-ink">{value}</dd>
    </div>
  );
}

function FlightDetails({ flight }: { flight: Flight }) {
  return (
    <section className="tf-card-cream p-8 mb-6">
      <div className="flex items-center gap-2 mb-6">
        <IoAirplaneOutline className="text-tf-flight" style={{ fontSize: 16 }} />
        <p className="micro-label">Flight details</p>
      </div>

      {/* Big airport-to-airport display */}
      {(flight.origin_airport || flight.dest_airport) && (
        <div className="flex items-baseline gap-6 mb-6">
          <div>
            <p className="font-display text-[44px] text-tf-ink leading-none font-mono">
              {flight.origin_airport ?? "—"}
            </p>
            {flight.departure_time && (
              <p className="micro-label mt-2">
                Depart {format(parseISO(flight.departure_time), "MMM d · h:mm a")}
              </p>
            )}
          </div>
          <div className="flex-1 pt-3 border-t-[1.5px] border-dashed border-tf-border-secondary relative">
            <IoAirplaneOutline
              className="absolute right-0 top-0 -translate-y-1/2 text-tf-flight bg-tf-cream px-1"
              style={{ fontSize: 20 }}
            />
          </div>
          <div className="text-right">
            <p className="font-display text-[44px] text-tf-ink leading-none font-mono">
              {flight.dest_airport ?? "—"}
            </p>
            {flight.arrival_time && (
              <p className="micro-label mt-2">
                Arrive {format(parseISO(flight.arrival_time), "MMM d · h:mm a")}
              </p>
            )}
          </div>
        </div>
      )}

      <dl className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4 pt-6 border-t border-tf-cream-border">
        {flight.flight_number && (
          <DetailRow label="Flight" value={flight.flight_number} />
        )}
        {flight.booking_class && (
          <DetailRow label="Class" value={flight.booking_class} />
        )}
        {flight.terminal && (
          <DetailRow label="Terminal" value={flight.terminal} />
        )}
        {flight.gate && <DetailRow label="Gate" value={flight.gate} />}
        {flight.seat && <DetailRow label="Seat" value={flight.seat} />}
      </dl>
    </section>
  );
}

function HotelDetails({ hotel }: { hotel: Hotel }) {
  return (
    <section className="tf-card-cream p-8 mb-6">
      <p className="micro-label mb-5">Hotel details</p>
      <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
        {hotel.hotel_name && (
          <DetailRow label="Hotel" value={hotel.hotel_name} span={2} />
        )}
        {hotel.address && (
          <DetailRow
            label="Address"
            icon={<IoLocationOutline style={{ fontSize: 14 }} />}
            value={hotel.address}
            span={2}
          />
        )}
        {hotel.check_in && (
          <DetailRow
            label="Check-in"
            icon={<IoCalendarOutline style={{ fontSize: 14 }} />}
            value={format(parseISO(hotel.check_in), "MMM d, yyyy · h:mm a")}
          />
        )}
        {hotel.check_out && (
          <DetailRow
            label="Check-out"
            icon={<IoCalendarOutline style={{ fontSize: 14 }} />}
            value={format(parseISO(hotel.check_out), "MMM d, yyyy · h:mm a")}
          />
        )}
        {hotel.room_type && <DetailRow label="Room" value={hotel.room_type} />}
        {hotel.phone && (
          <DetailRow
            label="Phone"
            icon={<IoCallOutline style={{ fontSize: 14 }} />}
            value={hotel.phone}
          />
        )}
        {hotel.website && (
          <DetailRow
            label="Website"
            icon={<IoGlobeOutline style={{ fontSize: 14 }} />}
            value={hotel.website}
          />
        )}
      </dl>
    </section>
  );
}
