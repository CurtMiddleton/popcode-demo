// Force dynamic rendering for auth pages (no SSG prerendering)
// because they use Supabase client which needs runtime env vars
export const dynamic = "force-dynamic";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
