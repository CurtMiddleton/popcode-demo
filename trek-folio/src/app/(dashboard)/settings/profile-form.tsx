"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IoMailOutline, IoCopyOutline, IoCheckmarkOutline } from "react-icons/io5";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { PageHeader } from "@/components/page-header";
import { useToast } from "@/hooks/use-toast";
import type { User } from "@/lib/types";

interface ProfileFormProps {
  profile: User | null;
  userEmail: string;
}

export function ProfileForm({ profile, userEmail }: ProfileFormProps) {
  const [name, setName] = useState(profile?.name ?? "");
  const [homeCity, setHomeCity] = useState(profile?.home_city ?? "");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const router = useRouter();
  const supabase = createClient();
  const { toast } = useToast();

  const forwardingEmail = profile?.forwarding_alias
    ? `res+${profile.forwarding_alias}@trekfol.io`
    : null;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase
      .from("users")
      .update({
        name: name || null,
        home_city: homeCity || null,
      })
      .eq("id", profile!.id);
    setSaving(false);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    toast({ title: "Profile updated" });
    router.refresh();
  }

  function copyForwardingEmail() {
    if (forwardingEmail) {
      navigator.clipboard.writeText(forwardingEmail);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  const initials = (name || userEmail || "U")
    .split(/[\s@]/)
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader eyebrow="Account" title="Settings" />

      {/* Profile card (cream) */}
      <section className="tf-card-cream p-8 mb-6">
        <p className="micro-label mb-5">Profile</p>

        <div className="flex items-center gap-5 mb-8">
          <Avatar className="w-16 h-16 border border-tf-border-secondary">
            <AvatarImage src={profile?.avatar_url ?? undefined} />
            <AvatarFallback className="text-base font-medium bg-white">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-display-roman text-[22px] text-tf-ink">
              {name || "Your name"}
            </p>
            <p className="text-[11px] text-tf-muted font-light">{userEmail}</p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="name" className="micro-label">
              Full name
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Doe"
              className="bg-white border-tf-cream-border"
            />
          </div>
          <div className="space-y-2">
            <Label className="micro-label">Email</Label>
            <Input
              value={userEmail}
              disabled
              className="bg-white/70 border-tf-cream-border"
            />
            <p className="text-[10px] text-tf-muted font-light">
              Managed by your auth provider
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="home-city" className="micro-label">
              Home city
            </Label>
            <Input
              id="home-city"
              value={homeCity}
              onChange={(e) => setHomeCity(e.target.value)}
              placeholder="San Francisco, CA"
              className="bg-white border-tf-cream-border"
            />
          </div>
          <div className="pt-2">
            <Button
              type="submit"
              disabled={saving}
              className="bg-tf-ink hover:bg-tf-ink/90 text-white h-9 px-5 text-xs font-medium tracking-wider uppercase"
            >
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </section>

      {/* Forwarding email card (white) */}
      <section className="tf-card p-8">
        <div className="flex items-center gap-2 mb-3">
          <IoMailOutline className="text-tf-ink" style={{ fontSize: 16 }} />
          <p className="micro-label">Reservation Email</p>
        </div>
        <h3 className="font-display-roman text-[22px] text-tf-ink mb-2">
          Forward bookings to this address
        </h3>
        <p className="text-[12px] text-tf-muted font-light mb-5 max-w-lg">
          Any confirmation email you forward here will be parsed by AI and
          automatically added to the matching trip.
        </p>
        {forwardingEmail ? (
          <div className="flex items-center gap-2">
            <code className="flex-1 px-4 py-3 bg-tf-cream rounded-[10px] text-[13px] font-mono border border-tf-cream-border">
              {forwardingEmail}
            </code>
            <Button
              variant="outline"
              size="icon"
              onClick={copyForwardingEmail}
              className="h-11 w-11 border-tf-border-tertiary"
            >
              {copied ? (
                <IoCheckmarkOutline
                  className="text-tf-activity"
                  style={{ fontSize: 18 }}
                />
              ) : (
                <IoCopyOutline
                  className="text-tf-ink"
                  style={{ fontSize: 16 }}
                />
              )}
            </Button>
          </div>
        ) : (
          <p className="text-[12px] text-tf-muted">
            Your forwarding address will appear here once your profile is
            created.
          </p>
        )}
      </section>
    </div>
  );
}
