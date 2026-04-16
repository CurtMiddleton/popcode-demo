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

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Settings</h1>
      <p className="text-muted-foreground mb-8">
        Manage your account and profile
      </p>
      <ProfileForm
        profile={profile}
        userEmail={user!.email ?? ""}
      />
    </div>
  );
}
