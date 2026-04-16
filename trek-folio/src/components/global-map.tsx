"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { loadGoogleMaps } from "@/lib/google-maps";
import { colorForType } from "@/lib/map-colors";
import { RESERVATION_LABELS, type Reservation, type Trip } from "@/lib/types";
import { cn } from "@/lib/utils";

interface GlobalMapProps {
  trips: Trip[];
  reservations: Reservation[];
}

type Pinnable = Reservation & { lat: number; lng: number; trip_id: string };

function hasCoordsAndTrip(r: Reservation): r is Pinnable {
  return r.lat != null && r.lng != null && r.trip_id != null;
}

export function GlobalMap({ trips, reservations }: GlobalMapProps) {
  const router = useRouter();
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [activeTripId, setActiveTripId] = useState<string | "all">("all");

  const tripById = useMemo(() => {
    const m = new Map<string, Trip>();
    for (const t of trips) m.set(t.id, t);
    return m;
  }, [trips]);

  const pinnable = useMemo<Pinnable[]>(
    () => reservations.filter(hasCoordsAndTrip),
    [reservations]
  );

  const tripsWithPins = useMemo(() => {
    const set = new Set<string>();
    for (const r of pinnable) set.add(r.trip_id);
    return trips.filter((t) => set.has(t.id));
  }, [pinnable, trips]);

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

  // Re-render markers whenever filter changes.
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!ready || !map) return;

    for (const m of markersRef.current) m.setMap(null);
    markersRef.current = [];

    const filtered =
      activeTripId === "all"
        ? pinnable
        : pinnable.filter((r) => r.trip_id === activeTripId);

    if (filtered.length === 0) return;

    const bounds = new google.maps.LatLngBounds();
    for (const r of filtered) {
      const position = { lat: r.lat, lng: r.lng };
      bounds.extend(position);
      const trip = tripById.get(r.trip_id);
      const marker = new google.maps.Marker({
        map,
        position,
        title: `${r.provider_name ?? RESERVATION_LABELS[r.type]}${
          trip ? ` — ${trip.destination ?? trip.name}` : ""
        }`,
        icon: pinIcon(colorForType(r.type)),
      });
      marker.addListener("click", () => {
        router.push(`/trips/${r.trip_id}`);
      });
      markersRef.current.push(marker);
    }

    if (filtered.length === 1) {
      map.setCenter({ lat: filtered[0].lat, lng: filtered[0].lng });
      map.setZoom(11);
    } else {
      map.fitBounds(bounds, 64);
    }
  }, [pinnable, activeTripId, ready, router, tripById]);

  if (loadError) {
    return (
      <div className="tf-card py-12 text-center">
        <p className="micro-label mb-3">Map unavailable</p>
        <p className="text-sm text-tf-muted max-w-md mx-auto">{loadError}</p>
      </div>
    );
  }

  if (pinnable.length === 0) {
    return (
      <div className="tf-card-cream h-[calc(100vh-20rem)] flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <p className="micro-label mb-3">Nothing pinned yet</p>
          <h3 className="font-display text-4xl text-tf-ink mb-3">
            Add an address to a plan
          </h3>
          <p className="text-sm text-tf-muted">
            As you add addresses to hotels, restaurants and activities, they
            appear here — colored by type and grouped by trip.
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

      {tripsWithPins.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="micro-label mr-1">Trips</span>
          <FilterPill
            active={activeTripId === "all"}
            onClick={() => setActiveTripId("all")}
            label="All"
          />
          {tripsWithPins.map((t) => (
            <FilterPill
              key={t.id}
              active={activeTripId === t.id}
              onClick={() => setActiveTripId(t.id)}
              label={t.destination ?? t.name}
            />
          ))}
        </div>
      )}

      <p className="text-[11px] text-tf-muted text-center">
        Click a pin to open its trip. Pin color matches the plan type.
      </p>
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3 h-8 rounded-full border text-[11px] font-medium uppercase tracking-[0.12em] transition-colors max-w-[180px] truncate",
        active
          ? "bg-tf-ink text-white border-tf-ink"
          : "bg-white text-tf-muted border-tf-border-tertiary hover:text-tf-ink"
      )}
      title={label}
    >
      {label}
    </button>
  );
}

function pinIcon(hex: string): google.maps.Symbol {
  return {
    path: "M12 0C5.37 0 0 5.37 0 12c0 9 12 20 12 20s12-11 12-20c0-6.63-5.37-12-12-12z",
    fillColor: hex,
    fillOpacity: 1,
    strokeColor: "#ffffff",
    strokeWeight: 2,
    scale: 1.2,
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
