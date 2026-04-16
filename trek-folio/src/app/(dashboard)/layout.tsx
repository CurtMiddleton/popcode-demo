import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/sidebar";
import { Toaster } from "@/components/ui/toaster";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("name, avatar_url")
    .eq("id", user.id)
    .single();

  return (
    <div className="min-h-screen bg-white">
      <Sidebar
        userEmail={user.email ?? ""}
        userName={profile?.name ?? null}
        avatarUrl={profile?.avatar_url ?? null}
      />
      <main className="md:pl-[52px]">
        <div className="px-7 py-9 md:px-9 pt-20 md:pt-9">{children}</div>
      </main>
      <Toaster />
    </div>
  );
}
