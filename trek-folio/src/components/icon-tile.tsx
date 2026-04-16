import { cn } from "@/lib/utils";
import {
  RESERVATION_COLOR_CLASSES,
  RESERVATION_ICONS,
} from "@/lib/reservation-icons";
import type { ReservationType } from "@/lib/types";

interface IconTileProps {
  type: ReservationType;
  size?: "sm" | "lg";
  className?: string;
}

/**
 * Tint-background icon tile for reservation types.
 * sm = 32px × 32px (itinerary rows)
 * lg = 44px × 44px (detail view)
 */
export function IconTile({ type, size = "sm", className }: IconTileProps) {
  const Icon = RESERVATION_ICONS[type];
  const colors = RESERVATION_COLOR_CLASSES[type];

  return (
    <div
      className={cn(
        "flex items-center justify-center shrink-0",
        colors.tile,
        size === "sm" ? "w-8 h-8 rounded-[7px]" : "w-11 h-11 rounded-[10px]",
        className
      )}
    >
      <Icon
        className={colors.icon}
        style={{ fontSize: size === "sm" ? 16 : 24 }}
      />
    </div>
  );
}
