"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import type { User } from "@/lib/types";
import { Mail, Copy, Check } from "lucide-react";

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
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="space-y-6">
      {/* Profile card */}
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>
            Your personal information and preferences
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSave}>
          <CardContent className="space-y-6">
            {/* Avatar */}
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={profile?.avatar_url ?? undefined} />
                <AvatarFallback className="text-lg">{initials}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{name || "Your name"}</p>
                <p className="text-sm text-muted-foreground">{userEmail}</p>
              </div>
            </div>

            <Separator />

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Doe"
              />
            </div>

            {/* Email (read-only) */}
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={userEmail} disabled />
              <p className="text-xs text-muted-foreground">
                Managed by your auth provider
              </p>
            </div>

            {/* Home city */}
            <div className="space-y-2">
              <Label htmlFor="home-city">Home city</Label>
              <Input
                id="home-city"
                value={homeCity}
                onChange={(e) => setHomeCity(e.target.value)}
                placeholder="San Francisco, CA"
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save changes"}
            </Button>
          </CardFooter>
        </form>
      </Card>

      {/* Email forwarding card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Reservation Email
          </CardTitle>
          <CardDescription>
            Forward booking confirmations to this address to automatically add
            them to your trips
          </CardDescription>
        </CardHeader>
        <CardContent>
          {forwardingEmail ? (
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 bg-muted rounded-md text-sm font-mono">
                {forwardingEmail}
              </code>
              <Button
                variant="outline"
                size="icon"
                onClick={copyForwardingEmail}
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Your forwarding address will appear here once your profile is
              created.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
