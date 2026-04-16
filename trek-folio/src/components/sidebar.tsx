"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  IoBriefcaseOutline,
  IoMailOutline,
  IoMapOutline,
  IoImagesOutline,
  IoSettingsOutline,
  IoLogOutOutline,
  IoMenuOutline,
  IoCloseOutline,
} from "react-icons/io5";
import type { IconType } from "react-icons";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";

interface NavItem {
  href: string;
  label: string;
  icon: IconType;
}

const navItems: NavItem[] = [
  { href: "/trips", label: "Trips", icon: IoBriefcaseOutline },
  { href: "/inbox", label: "Inbox", icon: IoMailOutline },
  { href: "/map", label: "Map", icon: IoMapOutline },
  { href: "/photos", label: "Photos", icon: IoImagesOutline },
  { href: "/settings", label: "Settings", icon: IoSettingsOutline },
];

interface SidebarProps {
  userEmail?: string;
  userName?: string | null;
  avatarUrl?: string | null;
}

export function Sidebar({ userEmail, userName, avatarUrl }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const initials = (userName || userEmail || "U")
    .split(/[\s@]/)
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <>
      {/* Mobile menu button (only visible on small screens) */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-40 md:hidden w-10 h-10 flex items-center justify-center rounded-md border border-tf-border-tertiary bg-white shadow-sm"
        aria-label="Open menu"
      >
        <IoMenuOutline className="text-tf-ink" style={{ fontSize: 20 }} />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar — 52px icon-only on desktop, slide-in drawer on mobile */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col items-center justify-between bg-white",
          "w-[52px] border-r border-tf-border-tertiary",
          "transition-transform duration-200",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        {/* Top: vertical TF logomark + mobile close */}
        <div className="flex flex-col items-center w-full pt-5">
          <Link
            href="/trips"
            className="font-display text-[13px] text-tf-ink tracking-tight hover:opacity-70 transition-opacity"
            style={{
              writingMode: "vertical-rl",
              textOrientation: "mixed",
              letterSpacing: "0.08em",
            }}
          >
            TREK FOLIO
          </Link>
          <button
            onClick={() => setMobileOpen(false)}
            className="md:hidden mt-4 w-7 h-7 flex items-center justify-center rounded-md hover:bg-tf-cream"
            aria-label="Close menu"
          >
            <IoCloseOutline style={{ fontSize: 18 }} />
          </button>
        </div>

        {/* Middle: nav icons */}
        <nav className="flex flex-col items-center gap-5 py-6">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.label}
                title={item.label}
                className={cn(
                  "w-9 h-9 flex items-center justify-center rounded-md transition-colors",
                  "hover:bg-tf-cream",
                  isActive && "bg-tf-cream"
                )}
              >
                <Icon
                  className={cn(
                    "transition-colors",
                    isActive ? "text-tf-ink" : "text-tf-muted"
                  )}
                  style={{ fontSize: 18 }}
                />
              </Link>
            );
          })}
        </nav>

        {/* Bottom: sign-out + avatar */}
        <div className="flex flex-col items-center gap-3 pb-5 w-full">
          <button
            onClick={handleSignOut}
            className="w-9 h-9 flex items-center justify-center rounded-md hover:bg-tf-cream transition-colors"
            aria-label="Sign out"
            title="Sign out"
          >
            <IoLogOutOutline
              className="text-tf-muted"
              style={{ fontSize: 18 }}
            />
          </button>
          <Link href="/settings" aria-label="Account">
            <Avatar className="w-[26px] h-[26px] border border-tf-border-secondary">
              <AvatarImage src={avatarUrl ?? undefined} />
              <AvatarFallback className="text-[9px] font-medium bg-white text-tf-ink">
                {initials}
              </AvatarFallback>
            </Avatar>
          </Link>
        </div>
      </aside>
    </>
  );
}
