import { createClient } from "@/lib/supabase/server";
import { TripsContent } from "./trips-content";

export const metadata = {
  title: "My Trips — Trek Folio",
};

export default async function TripsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: trips } = await supabase
    .from("trips")
    .select("*")
    .eq("user_id", user!.id)
    .order("start_date", { ascending: false });

  return <TripsContent initialTrips={trips ?? []} userId={user!.id} />;
}
