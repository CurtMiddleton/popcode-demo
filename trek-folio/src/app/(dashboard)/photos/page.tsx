import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { GlobalPhotoGrid } from "@/components/global-photo-grid";
import type { Photo, Trip } from "@/lib/types";

export const metadata = {
  title: "Photos — Trek Folio",
};

export default async function PhotosPage() {
  const supabase = createClient();

  const { data: trips } = await supabase
    .from("trips")
    .select("*")
    .order("start_date", { ascending: false });

  const { data: photos } = await supabase
    .from("photos")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        eyebrow="Gallery"
        title="Photos"
        description="All your trip photos in one place."
      />
      <GlobalPhotoGrid
        trips={(trips ?? []) as Trip[]}
        photos={(photos ?? []) as Photo[]}
      />
    </div>
  );
}
