import { cn } from "@/lib/utils";
import { RESERVATION_COLOR_CLASSES } from "@/lib/reservation-icons";
import { RESERVATION_LABELS } from "@/lib/types";
import type { ReservationType } from "@/lib/types";

interface TypePillProps {
  type: ReservationType;
  className?: string;
}

/**
 * Solid-color pill — 9px DM Sans, white text, full pill radius.
 * Used in itinerary rows and reservation detail.
 */
export function TypePill({ type, className }: TypePillProps) {
  const colors = RESERVATION_COLOR_CLASSES[type];

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-pill px-3 py-1 text-[9px] font-medium text-white uppercase",
        colors.pill,
        className
      )}
      style={{ letterSpacing: "0.04em" }}
    >
      {RESERVATION_LABELS[type]}
    </span>
  );
}
