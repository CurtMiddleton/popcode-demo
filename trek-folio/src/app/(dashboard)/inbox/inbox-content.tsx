"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import {
  IoMailOutline,
  IoCopyOutline,
  IoCheckmarkOutline,
  IoChevronForwardOutline,
  IoWarningOutline,
} from "react-icons/io5";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import { IconTile } from "@/components/icon-tile";
import { TypePill } from "@/components/type-pill";
import { cn } from "@/lib/utils";
import { RESERVATION_LABELS } from "@/lib/types";
import type { Reservation, Trip } from "@/lib/types";

interface InboxContentProps {
  reservations: Reservation[];
  trips: Trip[];
  forwardingAlias: string | null;
}

export function InboxContent({
  reservations,
  trips,
  forwardingAlias,
}: InboxContentProps) {
  const [copied, setCopied] = useState(false);

  const forwardingEmail = forwardingAlias
    ? `res+${forwardingAlias}@trekfol.io`
    : null;

  function copyEmail() {
    if (!forwardingEmail) return;
    navigator.clipboard.writeText(forwardingEmail);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const unassigned = reservations.filter((r) => r.trip_id === null);
  const assigned = reservations.filter((r) => r.trip_id !== null);

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        eyebrow="Reservations"
        title="Inbox"
        action={
          <Link
            href="/inbox/dev"
            className="text-[11px] font-medium uppercase tracking-[0.12em] text-tf-muted hover:text-tf-ink"
          >
            Test parser →
          </Link>
        }
      />

      {/* Forwarding email banner */}
      <section className="tf-card-cream p-6 mb-8">
        <div className="flex items-center gap-2 mb-2">
          <IoMailOutline className="text-tf-ink" style={{ fontSize: 16 }} />
          <p className="micro-label">Forwarding address</p>
        </div>
        <p className="text-[12px] text-tf-muted font-light mb-4 max-w-xl">
          Forward any booking confirmation email here and we&apos;ll parse it
          with AI, then add the plan to the matching trip automatically.
        </p>
        {forwardingEmail ? (
          <div className="flex items-center gap-2 max-w-md">
            <code className="flex-1 px-4 py-2.5 bg-white rounded-[8px] text-[12px] font-mono border border-tf-cream-border">
              {forwardingEmail}
            </code>
            <Button
              variant="outline"
              size="icon"
              onClick={copyEmail}
              className="h-10 w-10 border-tf-cream-border bg-white"
            >
              {copied ? (
                <IoCheckmarkOutline
                  className="text-tf-activity"
                  style={{ fontSize: 16 }}
                />
              ) : (
                <IoCopyOutline className="text-tf-ink" style={{ fontSize: 14 }} />
              )}
            </Button>
          </div>
        ) : (
          <p className="text-[11px] text-tf-muted">Loading your address…</p>
        )}
      </section>

      {/* Unassigned section — needs user action */}
      {unassigned.length > 0 && (
        <section className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <IoWarningOutline
              className="text-tf-terra"
              style={{ fontSize: 14 }}
            />
            <span className="micro-label" style={{ color: "var(--tf-terra)" }}>
              Needs a trip · {unassigned.length}
            </span>
            <span className="flex-1 h-px bg-tf-border-tertiary" />
          </div>
          <div className="tf-card overflow-hidden">
            {unassigned.map((res, idx) => (
              <UnassignedRow
                key={res.id}
                res={res}
                trips={trips}
                showBorder={idx < unassigned.length - 1}
              />
            ))}
          </div>
        </section>
      )}

      {/* Assigned section */}
      {assigned.length > 0 && (
        <section>
          <div className="flex items-center gap-3 mb-4">
            <span className="micro-label">
              Auto-assigned · {assigned.length}
            </span>
            <span className="flex-1 h-px bg-tf-border-tertiary" />
          </div>
          <div className="tf-card overflow-hidden">
            {assigned.map((res, idx) => (
              <AssignedRow
                key={res.id}
                res={res}
                tripName={trips.find((t) => t.id === res.trip_id)?.name ?? null}
                showBorder={idx < assigned.length - 1}
              />
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {reservations.length === 0 && (
        <section className="tf-card-cream p-16 text-center">
          <p className="micro-label mb-3">No emails yet</p>
          <h2 className="font-display text-5xl text-tf-ink mb-4">
            Forward a confirmation
          </h2>
          <p className="text-sm text-tf-muted max-w-md mx-auto">
            Once you forward your first booking email, it&apos;ll appear here
            parsed and ready to attach to a trip.
          </p>
        </section>
      )}
    </div>
  );
}

function AssignedRow({
  res,
  tripName,
  showBorder,
}: {
  res: Reservation;
  tripName: string | null;
  showBorder: boolean;
}) {
  return (
    <Link
      href={
        res.trip_id
          ? `/trips/${res.trip_id}/reservations/${res.id}`
          : `/inbox`
      }
      className={cn(
        "flex items-center gap-4 px-6 py-4 bg-white hover:bg-tf-cream/50 transition-colors group",
        showBorder && "border-b border-tf-border-tertiary"
      )}
    >
      <IconTile type={res.type} size="sm" />
      <div className="flex-1 min-w-0">
        <p className="font-display-roman text-[16px] text-tf-ink truncate">
          {res.provider_name ?? RESERVATION_LABELS[res.type]}
        </p>
        <p className="text-[12px] font-light text-tf-muted truncate mt-0.5">
          {tripName && <>{tripName} · </>}
          {res.start_datetime
            ? format(parseISO(res.start_datetime), "MMM d, yyyy")
            : "Unscheduled"}
          {res.confirmation_number && (
            <>
              {" · "}
              <span className="font-mono">{res.confirmation_number}</span>
            </>
          )}
        </p>
      </div>
      <TypePill type={res.type} />
      <IoChevronForwardOutline
        className="text-tf-muted opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ fontSize: 14 }}
      />
    </Link>
  );
}

function UnassignedRow({
  res,
  trips,
  showBorder,
}: {
  res: Reservation;
  trips: Trip[];
  showBorder: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [assigning, setAssigning] = useState(false);

  async function assign(tripId: string) {
    setAssigning(true);
    const { error } = await supabase
      .from("reservations")
      .update({ trip_id: tripId })
      .eq("id", res.id);
    setAssigning(false);
    if (error) {
      alert(error.message);
      return;
    }
    router.refresh();
  }

  return (
    <div
      className={cn(
        "flex items-center gap-4 px-6 py-4 bg-white",
        showBorder && "border-b border-tf-border-tertiary"
      )}
    >
      <IconTile type={res.type} size="sm" />
      <div className="flex-1 min-w-0">
        <p className="font-display-roman text-[16px] text-tf-ink truncate">
          {res.provider_name ?? RESERVATION_LABELS[res.type]}
        </p>
        <p className="text-[12px] font-light text-tf-muted truncate mt-0.5">
          {res.start_datetime
            ? format(parseISO(res.start_datetime), "MMM d, yyyy · h:mm a")
            : "Unscheduled"}
          {res.confirmation_number && (
            <>
              {" · "}
              <span className="font-mono">{res.confirmation_number}</span>
            </>
          )}
        </p>
      </div>
      <TypePill type={res.type} />
      {trips.length > 0 ? (
        <Select
          onValueChange={assign}
          disabled={assigning}
        >
          <SelectTrigger className="w-44 h-9 text-[11px]">
            <SelectValue placeholder="Assign to trip…" />
          </SelectTrigger>
          <SelectContent>
            {trips.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.destination ?? t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Link
          href="/trips"
          className="text-[11px] font-medium uppercase tracking-[0.12em] text-tf-muted hover:text-tf-ink"
        >
          Create a trip
        </Link>
      )}
    </div>
  );
}
