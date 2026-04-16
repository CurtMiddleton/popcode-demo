import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { GlobalMap } from "@/components/global-map";
import type { Reservation, Trip } from "@/lib/types";

export const metadata = {
  title: "Map — Trek Folio",
};

export default async function MapPage() {
  const supabase = createClient();

  const { data: trips } = await supabase
    .from("trips")
    .select("*")
    .order("start_date", { ascending: true });

  const { data: reservations } = await supabase
    .from("reservations")
    .select("*")
    .not("lat", "is", null)
    .not("lng", "is", null);

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        eyebrow="Geographic View"
        title="Map"
        description="See every plan and saved place across all your trips."
      />
      <GlobalMap
        trips={(trips ?? []) as Trip[]}
        reservations={(reservations ?? []) as Reservation[]}
      />
    </div>
  );
}
