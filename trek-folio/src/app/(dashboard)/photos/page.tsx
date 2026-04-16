import { PageHeader } from "@/components/page-header";

export const metadata = {
  title: "Photos — Trek Folio",
};

export default function PhotosPage() {
  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        eyebrow="Gallery"
        title="Photos"
        description="All your trip photos in one place."
      />
      <div className="tf-card-cream p-16 text-center">
        <p className="micro-label mb-3">Coming in Phase 6</p>
        <h2 className="font-display text-5xl text-tf-ink mb-3">
          No photos yet
        </h2>
        <p className="text-sm text-tf-muted max-w-md mx-auto">
          Upload photos to your trips and they&apos;ll appear here.
        </p>
      </div>
    </div>
  );
}
