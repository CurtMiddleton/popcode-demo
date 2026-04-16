import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "./profile-form";

export const metadata = {
  title: "Settings — Trek Folio",
};

export default async function SettingsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", user!.id)
    .single();

  return <ProfileForm profile={profile} userEmail={user!.email ?? ""} />;
}
