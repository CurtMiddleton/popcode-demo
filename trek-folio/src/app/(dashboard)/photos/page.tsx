import { Camera } from "lucide-react";

export const metadata = {
  title: "Photos — Trek Folio",
};

export default function PhotosPage() {
  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Photos</h1>
      <p className="text-muted-foreground mb-8">
        All your trip photos in one place
      </p>
      <div className="text-center py-20">
        <Camera className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
        <h2 className="text-xl font-semibold mb-2">No photos yet</h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          Upload photos to your trips and they&apos;ll appear here.
        </p>
      </div>
    </div>
  );
}
