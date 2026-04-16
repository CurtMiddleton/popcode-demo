"use client";

import { useState } from "react";
import Link from "next/link";
import { IoArrowBackOutline, IoCheckmarkOutline } from "react-icons/io5";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/page-header";

const SAMPLE_EMAIL = `Delta Air Lines
Confirmation Number: HK4PLQ

Dear Jane Doe,

Your Delta reservation has been confirmed.

FLIGHT DL 42
Saturday, April 25, 2026
Depart: New York / JFK · 8:15 PM · Terminal 4
Arrive: Paris / CDG · Sunday, April 26 · 9:45 AM

Seat: 12A (Main Cabin)
Class: Economy

Total: $642.30 USD

Thank you for flying Delta.`;

export function DevParseTester() {
  const [subject, setSubject] = useState("Your Delta confirmation — HK4PLQ");
  const [body, setBody] = useState(SAMPLE_EMAIL);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleParse(save: boolean) {
    setLoading(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/dev/parse-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body, save }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Unknown error");
        setResult(null);
      } else {
        setResult(json);
        if (save && json.reservation_id) {
          setSaved(true);
          // Fire-and-forget confirmation email
          fetch("/api/email/reservation-added", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reservation_id: json.reservation_id }),
          }).catch(() => {});
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto">
      <Link
        href="/inbox"
        className="inline-flex items-center gap-1.5 text-[11px] font-medium text-tf-muted hover:text-tf-ink mb-6 uppercase tracking-[0.12em]"
      >
        <IoArrowBackOutline style={{ fontSize: 13 }} />
        Inbox
      </Link>

      <PageHeader
        eyebrow="Developer tool"
        title="Parse an email"
        description="Paste a confirmation email body below and watch GPT-4o extract the reservation. Use 'Parse & save' to store the result as a real reservation."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input column */}
        <section className="tf-card p-6 space-y-4">
          <p className="micro-label">Input</p>
          <div className="space-y-2">
            <Label htmlFor="subject" className="micro-label">
              Subject
            </Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="body" className="micro-label">
              Email body
            </Label>
            <Textarea
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={18}
              className="font-mono text-[11px]"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button
              onClick={() => handleParse(false)}
              disabled={loading || !body}
              variant="outline"
              className="flex-1 border-tf-border-secondary h-10 text-[11px] tracking-[0.12em] uppercase"
            >
              {loading ? "Parsing…" : "Parse (preview)"}
            </Button>
            <Button
              onClick={() => handleParse(true)}
              disabled={loading || !body}
              className="flex-1 bg-tf-ink hover:bg-tf-ink/90 text-white h-10 text-[11px] tracking-[0.16em] uppercase"
            >
              {loading ? "Saving…" : "Parse & save"}
            </Button>
          </div>
        </section>

        {/* Output column */}
        <section className="tf-card-cream p-6">
          <p className="micro-label mb-4">Output</p>

          {error && (
            <div className="bg-destructive/5 border border-destructive/20 rounded-md p-4 mb-4">
              <p className="text-[11px] font-medium text-destructive mb-1 uppercase tracking-wider">
                Error
              </p>
              <p className="text-xs text-destructive font-mono">{error}</p>
            </div>
          )}

          {saved && (
            <div className="flex items-center gap-2 bg-tf-activity-tint border border-tf-activity-border rounded-md p-3 mb-4">
              <IoCheckmarkOutline
                className="text-tf-activity"
                style={{ fontSize: 16 }}
              />
              <p className="text-[12px] text-tf-activity">
                Reservation saved. Check{" "}
                <Link href="/inbox" className="underline font-medium">
                  your inbox
                </Link>
                .
              </p>
            </div>
          )}

          {result ? (
            <pre className="bg-white rounded-md p-4 text-[11px] font-mono overflow-auto max-h-[600px] border border-tf-cream-border whitespace-pre-wrap break-all">
              {JSON.stringify(result, null, 2)}
            </pre>
          ) : !error && !loading ? (
            <p className="text-[12px] text-tf-muted font-light">
              Click <span className="font-medium">Parse</span> to see what
              GPT-4o extracts from the email above.
            </p>
          ) : null}
        </section>
      </div>
    </div>
  );
}
