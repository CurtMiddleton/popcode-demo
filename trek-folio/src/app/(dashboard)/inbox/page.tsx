import { PageHeader } from "@/components/page-header";

export const metadata = {
  title: "Inbox — Trek Folio",
};

export default function InboxPage() {
  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader eyebrow="Reservations" title="Inbox" />
      <div className="tf-card-cream p-16 text-center">
        <p className="micro-label mb-3">Empty</p>
        <h2 className="font-display text-5xl text-tf-ink mb-4">
          No emails yet
        </h2>
        <p className="text-sm text-tf-muted max-w-md mx-auto">
          Forward your booking confirmation emails to your Trek Folio
          address. Check your Settings page for your forwarding email.
        </p>
      </div>
    </div>
  );
}
