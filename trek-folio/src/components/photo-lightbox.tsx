"use client";

import { useEffect, useRef, useState } from "react";
import { format, parseISO, addDays } from "date-fns";
import {
  IoChevronBackOutline,
  IoChevronForwardOutline,
  IoCloseOutline,
  IoTrashOutline,
} from "react-icons/io5";
import type { Photo, Trip } from "@/lib/types";
import { cn } from "@/lib/utils";

interface PhotoLightboxProps {
  photos: Photo[];
  index: number;
  trip: Trip;
  onClose: () => void;
  onIndexChange: (i: number) => void;
  onUpdate: (id: string, patch: Partial<Pick<Photo, "caption" | "day_index">>) => Promise<void>;
  onDelete: (photo: Photo) => Promise<void>;
}

const SWIPE_THRESHOLD = 60;

export function PhotoLightbox({
  photos,
  index,
  trip,
  onClose,
  onIndexChange,
  onUpdate,
  onDelete,
}: PhotoLightboxProps) {
  const photo = photos[index];
  const [caption, setCaption] = useState(photo?.caption ?? "");
  const [savingCaption, setSavingCaption] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const touchStartX = useRef<number | null>(null);

  // Reset caption state whenever the active photo changes.
  useEffect(() => {
    setCaption(photo?.caption ?? "");
  }, [photo?.id, photo?.caption]);

  // Keyboard nav.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowLeft" && index > 0) {
        onIndexChange(index - 1);
      } else if (e.key === "ArrowRight" && index < photos.length - 1) {
        onIndexChange(index + 1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, photos.length, onClose, onIndexChange]);

  // Lock body scroll while open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  if (!photo) return null;

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }
  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (dx > SWIPE_THRESHOLD && index > 0) onIndexChange(index - 1);
    else if (dx < -SWIPE_THRESHOLD && index < photos.length - 1)
      onIndexChange(index + 1);
  }

  async function saveCaption() {
    if ((photo.caption ?? "") === caption) return;
    setSavingCaption(true);
    try {
      await onUpdate(photo.id, { caption: caption || null });
    } finally {
      setSavingCaption(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this photo? This can't be undone.")) return;
    setDeleting(true);
    try {
      await onDelete(photo);
    } finally {
      setDeleting(false);
    }
  }

  const dayLabel = formatDayLabel(photo.day_index, trip);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/92 flex flex-col"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 text-white/80">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/50">
            {index + 1} / {photos.length}
          </p>
          <p className="text-[13px] mt-0.5 truncate">
            {dayLabel}
            {photo.taken_at && (
              <span className="text-white/50 ml-2">
                · {format(parseISO(photo.taken_at), "MMM d, h:mm a")}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="w-9 h-9 flex items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-50"
            aria-label="Delete photo"
          >
            <IoTrashOutline style={{ fontSize: 18 }} />
          </button>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <IoCloseOutline style={{ fontSize: 22 }} />
          </button>
        </div>
      </div>

      {/* Image area */}
      <div
        className="flex-1 min-h-0 flex items-center justify-center relative select-none"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        {index > 0 && (
          <button
            onClick={() => onIndexChange(index - 1)}
            className="hidden md:flex absolute left-4 w-11 h-11 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white"
            aria-label="Previous"
          >
            <IoChevronBackOutline style={{ fontSize: 22 }} />
          </button>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={photo.id}
          src={photo.storage_url}
          alt={photo.caption ?? ""}
          className="max-h-full max-w-full object-contain px-4 pointer-events-none"
        />
        {index < photos.length - 1 && (
          <button
            onClick={() => onIndexChange(index + 1)}
            className="hidden md:flex absolute right-4 w-11 h-11 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white"
            aria-label="Next"
          >
            <IoChevronForwardOutline style={{ fontSize: 22 }} />
          </button>
        )}
      </div>

      {/* Bottom bar: caption + day picker */}
      <div className="px-5 py-4 bg-black/60 border-t border-white/10 flex flex-col md:flex-row md:items-center gap-3">
        <input
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          onBlur={saveCaption}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            }
          }}
          placeholder="Add a caption"
          className="flex-1 bg-white/5 border border-white/10 rounded-md px-3 h-10 text-[14px] text-white placeholder:text-white/40 focus:outline-none focus:border-white/30"
        />
        {savingCaption && (
          <span className="text-[11px] text-white/50">Saving…</span>
        )}
        <DayPicker
          value={photo.day_index}
          trip={trip}
          onChange={(v) => onUpdate(photo.id, { day_index: v })}
        />
      </div>
    </div>
  );
}

function DayPicker({
  value,
  trip,
  onChange,
}: {
  value: number | null;
  trip: Trip;
  onChange: (v: number | null) => void;
}) {
  const options = buildDayOptions(trip);
  return (
    <select
      value={value ?? ""}
      onChange={(e) => {
        const raw = e.target.value;
        onChange(raw === "" ? null : Number(raw));
      }}
      className={cn(
        "h-10 rounded-md px-3 text-[13px] bg-white/5 text-white border border-white/10",
        "focus:outline-none focus:border-white/30"
      )}
    >
      <option value="">Unsorted</option>
      {options.map((opt) => (
        <option key={opt.index} value={opt.index}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

function buildDayOptions(trip: Trip): { index: number; label: string }[] {
  if (!trip.start_date || !trip.end_date) {
    // Fallback: offer a small range so the user can still tag something.
    return Array.from({ length: 10 }, (_, i) => ({
      index: i,
      label: `Day ${i + 1}`,
    }));
  }
  const start = parseISO(trip.start_date);
  const end = parseISO(trip.end_date);
  const days = Math.max(
    0,
    Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  );
  return Array.from({ length: days + 1 }, (_, i) => ({
    index: i,
    label: `Day ${i + 1} · ${format(addDays(start, i), "MMM d")}`,
  }));
}

export function formatDayLabel(
  dayIndex: number | null,
  trip: Trip
): string {
  if (dayIndex == null) return "Unsorted";
  if (!trip.start_date) return `Day ${dayIndex + 1}`;
  try {
    const date = addDays(parseISO(trip.start_date), dayIndex);
    return `Day ${dayIndex + 1} · ${format(date, "EEE, MMM d")}`;
  } catch {
    return `Day ${dayIndex + 1}`;
  }
}
