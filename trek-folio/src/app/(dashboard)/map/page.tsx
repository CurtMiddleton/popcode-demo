import { PageHeader } from "@/components/page-header";

export const metadata = {
  title: "Map — Trek Folio",
};

export default function MapPage() {
  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        eyebrow="Geographic View"
        title="Map"
        description="See every reservation and saved place across all your trips."
      />
      <div className="tf-card-cream h-[calc(100vh-20rem)] flex items-center justify-center">
        <div className="text-center">
          <p className="micro-label mb-3">Coming in Phase 5</p>
          <h3 className="font-display text-5xl text-tf-ink">
            Interactive map
          </h3>
        </div>
      </div>
    </div>
  );
}
