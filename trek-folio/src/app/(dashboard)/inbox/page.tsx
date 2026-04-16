import { Inbox } from "lucide-react";

export const metadata = {
  title: "Inbox — Trek Folio",
};

export default function InboxPage() {
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Inbox</h1>
      <p className="text-muted-foreground mb-8">
        Forwarded reservation emails appear here
      </p>
      <div className="text-center py-20">
        <Inbox className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
        <h2 className="text-xl font-semibold mb-2">No emails yet</h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          Forward your booking confirmation emails to your Trek Folio address.
          Check your Settings page for your forwarding email.
        </p>
      </div>
    </div>
  );
}
