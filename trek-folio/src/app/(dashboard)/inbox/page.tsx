import { createClient } from "@/lib/supabase/server";
import { InboxContent } from "./inbox-content";
import type { Reservation, Trip } from "@/lib/types";

export const metadata = {
  title: "Inbox — Trek Folio",
};

export default async function InboxPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("users")
    .select("forwarding_alias")
    .eq("id", user!.id)
    .single();

  // All email-parsed reservations for this user, newest first
  const { data: reservations } = await supabase
    .from("reservations")
    .select("*")
    .eq("user_id", user!.id)
    .not("raw_email_body", "is", null)
    .order("created_at", { ascending: false })
    .limit(50);

  // Trips the user can assign orphan reservations to
  const { data: trips } = await supabase
    .from("trips")
    .select("*")
    .eq("user_id", user!.id)
    .order("start_date", { ascending: false });

  return (
    <InboxContent
      reservations={(reservations ?? []) as Reservation[]}
      trips={(trips ?? []) as Trip[]}
      forwardingAlias={profile?.forwarding_alias ?? null}
    />
  );
}
