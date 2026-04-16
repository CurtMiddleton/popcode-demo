"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { IoAddOutline, IoImagesOutline } from "react-icons/io5";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import {
  MAX_PHOTOS_PER_TRIP,
  deletePhoto,
  updatePhoto,
  uploadPhoto,
} from "@/lib/photos";
import type { Photo, Trip } from "@/lib/types";
import { PhotoLightbox, formatDayLabel } from "./photo-lightbox";

interface PhotoGalleryProps {
  trip: Trip;
  userId: string;
  initialPhotos: Photo[];
}

export function PhotoGallery({ trip, userId, initialPhotos }: PhotoGalleryProps) {
  const router = useRouter();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [totalToUpload, setTotalToUpload] = useState(0);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Group photos into days (including an "unsorted" bucket).
  const grouped = useMemo(() => {
    const groups = new Map<number | "unsorted", Photo[]>();
    for (const p of photos) {
      const key = p.day_index ?? "unsorted";
      const list = groups.get(key) ?? [];
      list.push(p);
      groups.set(key, list);
    }
    // Sort each group by taken_at ascending.
    for (const list of groups.values()) {
      list.sort((a, b) => (a.taken_at ?? "").localeCompare(b.taken_at ?? ""));
    }
    // Return entries with dayed groups first (ascending), then unsorted.
    const dayed = Array.from(groups.entries()).filter(
      ([k]) => k !== "unsorted"
    ) as [number, Photo[]][];
    dayed.sort(([a], [b]) => a - b);
    const unsorted = groups.get("unsorted");
    const out: [number | "unsorted", Photo[]][] = [...dayed];
    if (unsorted) out.push(["unsorted", unsorted]);
    return out;
  }, [photos]);

  // Flat list matching the visual order above — used for lightbox navigation.
  const orderedPhotos = useMemo(
    () => grouped.flatMap(([, list]) => list),
    [grouped]
  );

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploadErr(null);

    const capacity = MAX_PHOTOS_PER_TRIP - photos.length;
    const selected = Array.from(files);
    if (selected.length > capacity) {
      setUploadErr(
        `Only ${capacity} slot${capacity === 1 ? "" : "s"} left — ${
          selected.length - capacity
        } file(s) skipped.`
      );
    }
    const toUpload = selected.slice(0, Math.max(0, capacity));
    if (toUpload.length === 0) return;

    setTotalToUpload(toUpload.length);
    setUploadingCount(0);
    const uploaded: Photo[] = [];
    for (const file of toUpload) {
      try {
        const photo = await uploadPhoto(supabase, file, trip, userId);
        uploaded.push(photo);
      } catch (err) {
        console.error("Upload failed", err);
        setUploadErr(err instanceof Error ? err.message : String(err));
      }
      setUploadingCount((n) => n + 1);
    }
    if (uploaded.length) {
      setPhotos((prev) => [...prev, ...uploaded]);
      router.refresh();
    }
    setTotalToUpload(0);
    setUploadingCount(0);
  }

  async function handleUpdate(
    id: string,
    patch: Partial<Pick<Photo, "caption" | "day_index">>
  ) {
    await updatePhoto(supabase, id, patch);
    setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  async function handleDelete(photo: Photo) {
    await deletePhoto(supabase, photo);
    setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
    // Close lightbox if the deleted photo was last or move to the neighboring one.
    if (lightboxIndex !== null) {
      const nextCount = photos.length - 1;
      if (nextCount === 0) setLightboxIndex(null);
      else if (lightboxIndex >= nextCount) setLightboxIndex(nextCount - 1);
    }
  }

  const uploading = totalToUpload > 0;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <span className="micro-label">
          {photos.length} / {MAX_PHOTOS_PER_TRIP} photos
        </span>
        <div className="flex items-center gap-3">
          {uploading && (
            <span className="text-[12px] text-tf-muted">
              Uploading {uploadingCount} / {totalToUpload}…
            </span>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.heic,.heif"
            multiple
            className="hidden"
            onChange={(e) => {
              handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <Button
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || photos.length >= MAX_PHOTOS_PER_TRIP}
            className="bg-tf-ink hover:bg-tf-ink/90 text-white h-9 text-[11px] font-medium tracking-[0.12em] uppercase"
          >
            <IoAddOutline className="mr-1.5" style={{ fontSize: 14 }} />
            Add Photos
          </Button>
        </div>
      </div>

      {uploadErr && (
        <div className="tf-card-cream px-4 py-3 text-[13px] text-destructive">
          {uploadErr}
        </div>
      )}

      {photos.length === 0 && !uploading ? (
        <EmptyState
          onAdd={() => fileInputRef.current?.click()}
          disabled={photos.length >= MAX_PHOTOS_PER_TRIP}
        />
      ) : (
        <div className="space-y-10">
          {grouped.map(([key, list]) => (
            <section key={String(key)}>
              <div className="flex items-baseline justify-between pb-3 mb-4 editorial-rule">
                <h3 className="font-display-italic text-[26px] text-tf-ink">
                  {key === "unsorted"
                    ? "Unsorted"
                    : formatDayLabel(key, trip)}
                </h3>
                <span className="micro-label">
                  {list.length} {list.length === 1 ? "photo" : "photos"}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {list.map((photo) => (
                  <button
                    key={photo.id}
                    onClick={() =>
                      setLightboxIndex(
                        orderedPhotos.findIndex((p) => p.id === photo.id)
                      )
                    }
                    className="group relative aspect-square overflow-hidden rounded-md bg-tf-cream border border-tf-border-tertiary hover:border-tf-ink transition-colors"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.storage_url}
                      alt={photo.caption ?? ""}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                    />
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {lightboxIndex !== null && orderedPhotos[lightboxIndex] && (
        <PhotoLightbox
          photos={orderedPhotos}
          index={lightboxIndex}
          trip={trip}
          onClose={() => setLightboxIndex(null)}
          onIndexChange={setLightboxIndex}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}

function EmptyState({
  onAdd,
  disabled,
}: {
  onAdd: () => void;
  disabled: boolean;
}) {
  return (
    <div className="tf-card-cream py-16 text-center">
      <IoImagesOutline
        className="mx-auto mb-3 text-tf-muted"
        style={{ fontSize: 32 }}
      />
      <p className="micro-label mb-3">No photos yet</p>
      <h3 className="font-display text-4xl text-tf-ink mb-3">
        Upload memories from this trip
      </h3>
      <p className="text-sm text-tf-muted mb-6 max-w-md mx-auto">
        Drag photos in from your camera roll. HEICs are converted to JPEG
        automatically. Photos with embedded dates are auto-tagged to the right
        day.
      </p>
      <Button
        size="sm"
        onClick={onAdd}
        disabled={disabled}
        className="bg-tf-ink hover:bg-tf-ink/90 text-white h-9 text-[11px] font-medium tracking-[0.12em] uppercase"
      >
        <IoAddOutline className="mr-1.5" style={{ fontSize: 14 }} />
        Add Photos
      </Button>
    </div>
  );
}
