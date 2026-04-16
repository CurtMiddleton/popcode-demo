"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createReservation,
  updateReservation,
  type ReservationInput,
} from "@/lib/reservations";
import {
  RESERVATION_LABELS,
  type ReservationType,
  type Reservation,
  type Flight,
  type Hotel,
} from "@/lib/types";

const TYPES: ReservationType[] = [
  "flight",
  "hotel",
  "restaurant",
  "bar",
  "activity",
  "car_rental",
];

interface ReservationFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId: string;
  userId: string;
  /** Pass existing reservation to edit, omit to create */
  existing?: Reservation & {
    flight?: Flight | null;
    hotel?: Hotel | null;
  };
}

// Convert ISO timestamp → value usable by <input type="datetime-local">
function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function fromLocalInput(v: string): string | null {
  if (!v) return null;
  // datetime-local is local wall-clock; convert to ISO preserving intent
  return new Date(v).toISOString();
}

export function ReservationFormDialog({
  open,
  onOpenChange,
  tripId,
  userId,
  existing,
}: ReservationFormDialogProps) {
  const router = useRouter();
  const supabase = createClient();
  const isEdit = !!existing;

  const [type, setType] = useState<ReservationType>(existing?.type ?? "flight");
  const [providerName, setProviderName] = useState(
    existing?.provider_name ?? ""
  );
  const [confirmationNumber, setConfirmationNumber] = useState(
    existing?.confirmation_number ?? ""
  );
  const [startDt, setStartDt] = useState(
    toLocalInput(existing?.start_datetime)
  );
  const [endDt, setEndDt] = useState(toLocalInput(existing?.end_datetime));
  const [address, setAddress] = useState(existing?.address ?? "");
  const [price, setPrice] = useState(
    existing?.price != null ? String(existing.price) : ""
  );
  const [currency, setCurrency] = useState(existing?.currency ?? "USD");
  const [notes, setNotes] = useState(existing?.notes ?? "");

  // Flight fields
  const [airline, setAirline] = useState(existing?.flight?.airline ?? "");
  const [flightNumber, setFlightNumber] = useState(
    existing?.flight?.flight_number ?? ""
  );
  const [origin, setOrigin] = useState(
    existing?.flight?.origin_airport ?? ""
  );
  const [dest, setDest] = useState(existing?.flight?.dest_airport ?? "");
  const [depart, setDepart] = useState(
    toLocalInput(existing?.flight?.departure_time)
  );
  const [arrive, setArrive] = useState(
    toLocalInput(existing?.flight?.arrival_time)
  );
  const [terminal, setTerminal] = useState(existing?.flight?.terminal ?? "");
  const [gate, setGate] = useState(existing?.flight?.gate ?? "");
  const [seat, setSeat] = useState(existing?.flight?.seat ?? "");
  const [bookingClass, setBookingClass] = useState(
    existing?.flight?.booking_class ?? ""
  );

  // Hotel fields
  const [hotelName, setHotelName] = useState(
    existing?.hotel?.hotel_name ?? ""
  );
  const [hotelAddress, setHotelAddress] = useState(
    existing?.hotel?.address ?? ""
  );
  const [checkIn, setCheckIn] = useState(toLocalInput(existing?.hotel?.check_in));
  const [checkOut, setCheckOut] = useState(
    toLocalInput(existing?.hotel?.check_out)
  );
  const [roomType, setRoomType] = useState(existing?.hotel?.room_type ?? "");
  const [hotelPhone, setHotelPhone] = useState(existing?.hotel?.phone ?? "");
  const [hotelWebsite, setHotelWebsite] = useState(
    existing?.hotel?.website ?? ""
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when dialog closes (only for create, not edit)
  useEffect(() => {
    if (!open && !existing) {
      setType("flight");
      setProviderName("");
      setConfirmationNumber("");
      setStartDt("");
      setEndDt("");
      setAddress("");
      setPrice("");
      setCurrency("USD");
      setNotes("");
      setAirline("");
      setFlightNumber("");
      setOrigin("");
      setDest("");
      setDepart("");
      setArrive("");
      setTerminal("");
      setGate("");
      setSeat("");
      setBookingClass("");
      setHotelName("");
      setHotelAddress("");
      setCheckIn("");
      setCheckOut("");
      setRoomType("");
      setHotelPhone("");
      setHotelWebsite("");
      setError(null);
    }
  }, [open, existing]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const input: ReservationInput = {
      trip_id: tripId,
      user_id: userId,
      type,
      provider_name: providerName || null,
      confirmation_number: confirmationNumber || null,
      start_datetime:
        type === "flight" ? fromLocalInput(depart) : fromLocalInput(startDt),
      end_datetime:
        type === "flight" ? fromLocalInput(arrive) : fromLocalInput(endDt),
      address: address || null,
      price: price ? parseFloat(price) : null,
      currency: currency || null,
      notes: notes || null,
      flight:
        type === "flight"
          ? {
              airline: airline || null,
              flight_number: flightNumber || null,
              origin_airport: origin || null,
              dest_airport: dest || null,
              departure_time: fromLocalInput(depart),
              arrival_time: fromLocalInput(arrive),
              terminal: terminal || null,
              gate: gate || null,
              seat: seat || null,
              booking_class: bookingClass || null,
            }
          : undefined,
      hotel:
        type === "hotel"
          ? {
              hotel_name: hotelName || providerName || null,
              address: hotelAddress || address || null,
              check_in: fromLocalInput(checkIn) ?? fromLocalInput(startDt),
              check_out: fromLocalInput(checkOut) ?? fromLocalInput(endDt),
              room_type: roomType || null,
              phone: hotelPhone || null,
              website: hotelWebsite || null,
            }
          : undefined,
    };

    try {
      if (isEdit && existing) {
        await updateReservation(supabase, existing.id, input);
      } else {
        await createReservation(supabase, input);
      }
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="font-display text-3xl font-normal tracking-tight">
              {isEdit ? "Edit reservation" : "Add reservation"}
            </DialogTitle>
            <DialogDescription>
              {isEdit
                ? "Update this reservation's details."
                : "Add a new reservation to your trip."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-6">
            {/* Type */}
            <div className="space-y-2">
              <Label className="micro-label">Type</Label>
              <Select
                value={type}
                onValueChange={(v) => setType(v as ReservationType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {RESERVATION_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Common: provider name */}
            <div className="space-y-2">
              <Label className="micro-label">
                {type === "flight"
                  ? "Airline"
                  : type === "hotel"
                  ? "Hotel name"
                  : type === "car_rental"
                  ? "Car rental company"
                  : "Provider name"}
              </Label>
              <Input
                value={providerName}
                onChange={(e) => setProviderName(e.target.value)}
                placeholder={
                  type === "flight"
                    ? "e.g. Delta"
                    : type === "hotel"
                    ? "e.g. Marriott Chicago"
                    : type === "restaurant"
                    ? "e.g. Lucali"
                    : ""
                }
              />
            </div>

            {/* Common: confirmation number */}
            <div className="space-y-2">
              <Label className="micro-label">Confirmation number</Label>
              <Input
                value={confirmationNumber}
                onChange={(e) => setConfirmationNumber(e.target.value)}
                className="font-mono text-xs"
              />
            </div>

            {/* ============= FLIGHT-SPECIFIC ============= */}
            {type === "flight" && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="micro-label">Flight number</Label>
                    <Input
                      value={flightNumber}
                      onChange={(e) => setFlightNumber(e.target.value)}
                      placeholder="DL 42"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="micro-label">Booking class</Label>
                    <Input
                      value={bookingClass}
                      onChange={(e) => setBookingClass(e.target.value)}
                      placeholder="Economy"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="micro-label">Origin airport</Label>
                    <Input
                      value={origin}
                      onChange={(e) => setOrigin(e.target.value.toUpperCase())}
                      placeholder="JFK"
                      maxLength={4}
                      className="font-mono uppercase"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="micro-label">Destination airport</Label>
                    <Input
                      value={dest}
                      onChange={(e) => setDest(e.target.value.toUpperCase())}
                      placeholder="CDG"
                      maxLength={4}
                      className="font-mono uppercase"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="micro-label">Departure</Label>
                    <Input
                      type="datetime-local"
                      value={depart}
                      onChange={(e) => setDepart(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="micro-label">Arrival</Label>
                    <Input
                      type="datetime-local"
                      value={arrive}
                      onChange={(e) => setArrive(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="micro-label">Terminal</Label>
                    <Input
                      value={terminal}
                      onChange={(e) => setTerminal(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="micro-label">Gate</Label>
                    <Input
                      value={gate}
                      onChange={(e) => setGate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="micro-label">Seat</Label>
                    <Input
                      value={seat}
                      onChange={(e) => setSeat(e.target.value)}
                      placeholder="12A"
                    />
                  </div>
                </div>
              </>
            )}

            {/* ============= HOTEL-SPECIFIC ============= */}
            {type === "hotel" && (
              <>
                <div className="space-y-2">
                  <Label className="micro-label">Address</Label>
                  <Input
                    value={hotelAddress}
                    onChange={(e) => setHotelAddress(e.target.value)}
                    placeholder="540 N Michigan Ave, Chicago, IL"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="micro-label">Check-in</Label>
                    <Input
                      type="datetime-local"
                      value={checkIn}
                      onChange={(e) => setCheckIn(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="micro-label">Check-out</Label>
                    <Input
                      type="datetime-local"
                      value={checkOut}
                      onChange={(e) => setCheckOut(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="micro-label">Room type</Label>
                  <Input
                    value={roomType}
                    onChange={(e) => setRoomType(e.target.value)}
                    placeholder="King Suite"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="micro-label">Phone</Label>
                    <Input
                      value={hotelPhone}
                      onChange={(e) => setHotelPhone(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="micro-label">Website</Label>
                    <Input
                      value={hotelWebsite}
                      onChange={(e) => setHotelWebsite(e.target.value)}
                      placeholder="marriott.com"
                    />
                  </div>
                </div>
              </>
            )}

            {/* ============= GENERIC (not flight/hotel) ============= */}
            {type !== "flight" && type !== "hotel" && (
              <>
                <div className="space-y-2">
                  <Label className="micro-label">Address</Label>
                  <Input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="123 Main St"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="micro-label">Start</Label>
                    <Input
                      type="datetime-local"
                      value={startDt}
                      onChange={(e) => setStartDt(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="micro-label">End</Label>
                    <Input
                      type="datetime-local"
                      value={endDt}
                      onChange={(e) => setEndDt(e.target.value)}
                    />
                  </div>
                </div>
              </>
            )}

            {/* Common: price + currency */}
            <div className="grid grid-cols-[1fr_120px] gap-4">
              <div className="space-y-2">
                <Label className="micro-label">Price</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label className="micro-label">Currency</Label>
                <Input
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                  maxLength={3}
                  className="font-mono uppercase"
                />
              </div>
            </div>

            {/* Common: notes */}
            <div className="space-y-2">
              <Label className="micro-label">Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Dress code, dining companions, special occasion…"
                rows={3}
              />
            </div>

            {error && (
              <p className="text-xs text-destructive">{error}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-tf-border-tertiary"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="bg-tf-ink hover:bg-tf-ink/90 text-white"
            >
              {saving
                ? "Saving…"
                : isEdit
                ? "Save changes"
                : "Add reservation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
