"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  RESERVATION_LABELS,
  RESERVATION_SUBTITLES,
  type ReservationType,
} from "@/lib/types";
import {
  RESERVATION_ICONS,
  RESERVATION_COLOR_CLASSES,
} from "@/lib/reservation-icons";

// Order types in the picker by family (transport, lodging, food, fun, util)
const PICKER_ORDER: ReservationType[] = [
  // Transport
  "flight",
  "rail",
  "cruise",
  "ferry",
  "transportation",
  "car_rental",
  "parking",
  // Lodging
  "hotel",
  // Food & drink
  "restaurant",
  "bar",
  // Activities & entertainment
  "activity",
  "tour",
  "concert",
  "theater",
  // Utility
  "meeting",
  "directions",
  "note",
];

interface PlanPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called when the user picks a plan type. Picker closes automatically. */
  onPick: (type: ReservationType) => void;
}

/**
 * Tile-grid picker. Click a plan type to choose it; the parent typically
 * opens a type-specific reservation form in response.
 */
export function PlanPickerDialog({
  open,
  onOpenChange,
  onPick,
}: PlanPickerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-3xl font-normal tracking-tight">
            Add a plan
          </DialogTitle>
          <DialogDescription>
            What kind of thing are you adding to this trip?
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 py-4">
          {PICKER_ORDER.map((type) => (
            <PlanTile
              key={type}
              type={type}
              onClick={() => {
                onOpenChange(false);
                // Defer onPick until after the close animation kicks in so
                // the form dialog doesn't fight the picker's close
                setTimeout(() => onPick(type), 50);
              }}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PlanTile({
  type,
  onClick,
}: {
  type: ReservationType;
  onClick: () => void;
}) {
  const Icon = RESERVATION_ICONS[type];
  const colors = RESERVATION_COLOR_CLASSES[type];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex flex-col items-start text-left p-4 rounded-[10px]",
        "border border-tf-border-tertiary bg-white",
        "hover:border-tf-border-secondary hover:shadow-sm transition-all"
      )}
    >
      <div
        className={cn(
          "w-10 h-10 rounded-[8px] flex items-center justify-center mb-3",
          colors.tile
        )}
      >
        <Icon className={colors.icon} style={{ fontSize: 20 }} />
      </div>
      <p className="font-display-roman text-[15px] text-tf-ink leading-tight">
        {RESERVATION_LABELS[type]}
      </p>
      <p className="text-[10px] font-light text-tf-muted mt-1 leading-tight">
        {RESERVATION_SUBTITLES[type]}
      </p>
    </button>
  );
}
