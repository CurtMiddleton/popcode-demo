import type { SupabaseClient } from "@supabase/supabase-js";
import { parseISO, startOfDay, differenceInCalendarDays } from "date-fns";
import type { Photo, Trip } from "./types";

const BUCKET = "trip-photos";
export const MAX_PHOTOS_PER_TRIP = 100;

const HEIC_EXT_RE = /\.hei[cf]$/i;

function isHeic(file: File): boolean {
  return (
    file.type === "image/heic" ||
    file.type === "image/heif" ||
    HEIC_EXT_RE.test(file.name)
  );
}

async function convertHeicToJpeg(file: File): Promise<File> {
  const heic2any = (await import("heic2any")).default;
  const converted = await heic2any({
    blob: file,
    toType: "image/jpeg",
    quality: 0.85,
  });
  const blob = Array.isArray(converted) ? converted[0] : converted;
  const newName = file.name.replace(HEIC_EXT_RE, ".jpg");
  return new File([blob], newName, { type: "image/jpeg" });
}

async function readExifTakenAt(file: File): Promise<string | null> {
  try {
    const exifr = (await import("exifr")).default;
    const exif = await exifr.parse(file, ["DateTimeOriginal", "CreateDate"]);
    const raw = exif?.DateTimeOriginal ?? exif?.CreateDate;
    if (!raw) return null;
    const d = raw instanceof Date ? raw : new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  } catch {
    return null;
  }
}

function computeDayIndex(takenAt: string | null, trip: Trip): number | null {
  if (!takenAt || !trip.start_date) return null;
  const taken = startOfDay(new Date(takenAt));
  const start = startOfDay(parseISO(trip.start_date));
  const idx = differenceInCalendarDays(taken, start);
  if (idx < 0) return null;
  if (trip.end_date) {
    const end = startOfDay(parseISO(trip.end_date));
    const tripLen = differenceInCalendarDays(end, start);
    if (idx > tripLen) return null;
  }
  return idx;
}

export interface UploadOptions {
  onProgress?: (fraction: number) => void;
}

export async function uploadPhoto(
  supabase: SupabaseClient,
  file: File,
  trip: Trip,
  userId: string,
  _opts: UploadOptions = {}
): Promise<Photo> {
  // Enforce per-trip cap.
  const { count } = await supabase
    .from("photos")
    .select("id", { count: "exact", head: true })
    .eq("trip_id", trip.id);
  if ((count ?? 0) >= MAX_PHOTOS_PER_TRIP) {
    throw new Error(`This trip already has the max of ${MAX_PHOTOS_PER_TRIP} photos.`);
  }

  // HEIC → JPEG.
  const prepared = isHeic(file) ? await convertHeicToJpeg(file) : file;

  // EXIF-derived taken_at (from the original HEIC preferred, falls back to the
  // converted JPEG if the original parse failed).
  const takenAt =
    (await readExifTakenAt(file)) ?? (await readExifTakenAt(prepared));

  const dayIndex = computeDayIndex(takenAt, trip);

  const photoId = crypto.randomUUID();
  const ext = (prepared.name.split(".").pop() ?? "jpg").toLowerCase();
  const path = `${userId}/${trip.id}/${photoId}.${ext}`;

  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, prepared, {
      cacheControl: "3600",
      contentType: prepared.type || "image/jpeg",
      upsert: false,
    });
  if (uploadErr) throw uploadErr;

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(path);

  const { data: row, error: insertErr } = await supabase
    .from("photos")
    .insert({
      id: photoId,
      trip_id: trip.id,
      user_id: userId,
      storage_url: publicUrl,
      taken_at: takenAt,
      day_index: dayIndex,
    })
    .select()
    .single();
  if (insertErr) {
    // Best-effort cleanup if the DB insert failed after the upload landed.
    await supabase.storage.from(BUCKET).remove([path]).catch(() => {});
    throw insertErr;
  }
  return row as Photo;
}

export async function updatePhoto(
  supabase: SupabaseClient,
  id: string,
  patch: Partial<Pick<Photo, "caption" | "day_index">>
): Promise<void> {
  const { error } = await supabase.from("photos").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deletePhoto(
  supabase: SupabaseClient,
  photo: Photo
): Promise<void> {
  // Extract storage path from the public URL so we can remove the underlying
  // object. The public URL is of the form `.../storage/v1/object/public/trip-photos/<path>`.
  const marker = `/${BUCKET}/`;
  const idx = photo.storage_url.indexOf(marker);
  if (idx >= 0) {
    const path = photo.storage_url.slice(idx + marker.length);
    await supabase.storage.from(BUCKET).remove([path]).catch(() => {});
  }
  const { error } = await supabase.from("photos").delete().eq("id", photo.id);
  if (error) throw error;
}
