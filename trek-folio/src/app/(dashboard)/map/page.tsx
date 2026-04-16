import { Map } from "lucide-react";

export const metadata = {
  title: "Map — Trek Folio",
};

export default function MapPage() {
  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Map</h1>
      <p className="text-muted-foreground mb-8">
        See all your reservations and saved places on a map
      </p>
      <div className="rounded-lg border bg-muted/50 h-[calc(100vh-16rem)] flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <Map className="h-16 w-16 mx-auto mb-3 opacity-30" />
          <p className="font-medium text-lg">Interactive map</p>
          <p className="text-sm">Coming in Phase 5</p>
        </div>
      </div>
    </div>
  );
}
