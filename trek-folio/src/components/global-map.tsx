"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { loadGoogleMaps } from "@/lib/google-maps";

export interface TripPin {
  tripId: string;
  name: string;
  destination: string | null;
  startDate: string | null;
  endDate: string | null;
  lat: number;
  lng: number;
  planCount: number;
  isUpcoming: boolean;
}

interface GlobalMapProps {
  pins: TripPin[];
}

export function GlobalMap({ pins }: GlobalMapProps) {
  const router = useRouter();
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // Initialize map once.
  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then((google) => {
        if (cancelled || !mapDivRef.current) return;
        mapInstanceRef.current = new google.maps.Map(mapDivRef.current, {
          center: { lat: 20, lng: 0 },
          zoom: 2,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          styles: mapStyles,
        });
        setReady(true);
      })
      .catch((err: Error) => {
        if (!cancelled) setLoadError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Render pins once map is ready and pin list is stable.
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!ready || !map) return;

    for (const m of markersRef.current) m.setMap(null);
    markersRef.current = [];

    if (pins.length === 0) return;

    const bounds = new google.maps.LatLngBounds();
    for (const pin of pins) {
      const position = { lat: pin.lat, lng: pin.lng };
      bounds.extend(position);
      const marker = new google.maps.Marker({
        map,
        position,
        title: buildTooltip(pin),
        icon: tripPinIcon(pin.isUpcoming ? "#1A1814" : "#B5AC97"),
      });
      marker.addListener("click", () => {
        router.push(`/trips/${pin.tripId}`);
      });
      markersRef.current.push(marker);
    }

    if (pins.length === 1) {
      map.setCenter({ lat: pins[0].lat, lng: pins[0].lng });
      map.setZoom(6);
    } else {
      map.fitBounds(bounds, 64);
    }
  }, [pins, ready, router]);

  if (loadError) {
    return (
      <div className="tf-card py-12 text-center">
        <p className="micro-label mb-3">Map unavailable</p>
        <p className="text-sm text-tf-muted max-w-md mx-auto">{loadError}</p>
      </div>
    );
  }

  if (pins.length === 0) {
    return (
      <div className="tf-card-cream h-[calc(100vh-20rem)] flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <p className="micro-label mb-3">Nothing pinned yet</p>
          <h3 className="font-display text-4xl text-tf-ink mb-3">
            Add an address to a plan
          </h3>
          <p className="text-sm text-tf-muted">
            As you add addresses to hotels, restaurants, and activities, trips
            appear here as pins you can click to open.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="tf-card overflow-hidden">
        <div
          ref={mapDivRef}
          className="w-full h-[calc(100vh-22rem)] min-h-[460px] bg-tf-cream"
        />
      </div>
      <p className="text-[12px] text-tf-muted text-center">
        {pins.length} {pins.length === 1 ? "trip" : "trips"} pinned · click a
        pin to open it
      </p>
    </div>
  );
}

function buildTooltip(pin: TripPin): string {
  const title = pin.destination ?? pin.name;
  if (!pin.startDate) return `${title} · ${pin.planCount} plans`;
  try {
    const start = format(parseISO(pin.startDate), "MMM d, yyyy");
    const end = pin.endDate
      ? ` – ${format(parseISO(pin.endDate), "MMM d, yyyy")}`
      : "";
    return `${title} · ${start}${end}`;
  } catch {
    return title;
  }
}

function tripPinIcon(hex: string): google.maps.Symbol {
  return {
    path: "M12 0C5.37 0 0 5.37 0 12c0 9 12 20 12 20s12-11 12-20c0-6.63-5.37-12-12-12z",
    fillColor: hex,
    fillOpacity: 1,
    strokeColor: "#ffffff",
    strokeWeight: 1.5,
    scale: 0.7,
    anchor: new google.maps.Point(12, 32),
    labelOrigin: new google.maps.Point(12, 12),
  };
}

const mapStyles: google.maps.MapTypeStyle[] = [
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  {
    featureType: "transit",
    elementType: "labels",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "road",
    elementType: "labels.icon",
    stylers: [{ visibility: "off" }],
  },
];
