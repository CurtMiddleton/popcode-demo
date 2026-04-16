"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { IoChevronForwardOutline } from "react-icons/io5";
import { createClient } from "@/lib/supabase/client";
import { deletePhoto, updatePhoto } from "@/lib/photos";
import type { Photo, Trip } from "@/lib/types";
import { PhotoLightbox } from "./photo-lightbox";

interface GlobalPhotoGridProps {
  trips: Trip[];
  photos: Photo[];
}

interface TripGroup {
  trip: Trip;
  photos: Photo[];
}

export function GlobalPhotoGrid({ trips, photos: initialPhotos }: GlobalPhotoGridProps) {
  const supabase = createClient();
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos);
  const [lightbox, setLightbox] = useState<{
    trip: Trip;
    tripPhotos: Photo[];
    index: number;
  } | null>(null);

  const groups: TripGroup[] = useMemo(() => {
    const byTrip = new Map<string, Photo[]>();
    for (const p of photos) {
      const list = byTrip.get(p.trip_id) ?? [];
      list.push(p);
      byTrip.set(p.trip_id, list);
    }
    const out: TripGroup[] = [];
    for (const trip of trips) {
      const list = byTrip.get(trip.id);
      if (!list || list.length === 0) continue;
      list.sort((a, b) => b.created_at.localeCompare(a.created_at));
      out.push({ trip, photos: list });
    }
    return out;
  }, [trips, photos]);

  async function handleUpdate(
    id: string,
    patch: Partial<Pick<Photo, "caption" | "day_index">>
  ) {
    await updatePhoto(supabase, id, patch);
    setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    if (lightbox) {
      setLightbox({
        ...lightbox,
        tripPhotos: lightbox.tripPhotos.map((p) =>
          p.id === id ? { ...p, ...patch } : p
        ),
      });
    }
  }

  async function handleDelete(photo: Photo) {
    await deletePhoto(supabase, photo);
    setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
    if (lightbox) {
      const nextList = lightbox.tripPhotos.filter((p) => p.id !== photo.id);
      if (nextList.length === 0) {
        setLightbox(null);
      } else {
        setLightbox({
          ...lightbox,
          tripPhotos: nextList,
          index: Math.min(lightbox.index, nextList.length - 1),
        });
      }
    }
  }

  if (groups.length === 0) {
    return (
      <div className="tf-card-cream p-16 text-center">
        <p className="micro-label mb-3">No photos yet</p>
        <h2 className="font-display text-4xl text-tf-ink mb-3">
          Upload from a trip
        </h2>
        <p className="text-sm text-tf-muted max-w-md mx-auto">
          Open a trip and use its Photos tab to add memories. They&apos;ll
          appear here grouped by trip.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-14">
      {groups.map(({ trip, photos: list }) => (
        <section key={trip.id}>
          <div className="flex items-baseline justify-between pb-3 mb-4 editorial-rule">
            <div className="min-w-0">
              <p className="micro-label mb-1">{trip.name}</p>
              <h2 className="font-display text-[28px] text-tf-ink truncate">
                {trip.destination ?? trip.name}
              </h2>
            </div>
            <Link
              href={`/trips/${trip.id}`}
              className="text-[11px] font-medium uppercase tracking-[0.12em] text-tf-muted hover:text-tf-ink inline-flex items-center gap-1"
            >
              Open trip
              <IoChevronForwardOutline style={{ fontSize: 12 }} />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {list.map((photo, i) => (
              <button
                key={photo.id}
                onClick={() =>
                  setLightbox({ trip, tripPhotos: list, index: i })
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

      {lightbox && (
        <PhotoLightbox
          photos={lightbox.tripPhotos}
          index={lightbox.index}
          trip={lightbox.trip}
          onClose={() => setLightbox(null)}
          onIndexChange={(i) => setLightbox({ ...lightbox, index: i })}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
