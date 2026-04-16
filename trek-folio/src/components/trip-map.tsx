"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { format, parseISO, startOfDay } from "date-fns";
import { loadGoogleMaps } from "@/lib/google-maps";
import { colorForType } from "@/lib/map-colors";
import { RESERVATION_LABELS, type Reservation } from "@/lib/types";
import { cn } from "@/lib/utils";

interface TripMapProps {
  reservations: Reservation[];
  onPinClick?: (reservationId: string) => void;
}

// A reservation that has coordinates (narrowed shape for map use).
type Pinnable = Reservation & { lat: number; lng: number };

function hasCoords(r: Reservation): r is Pinnable {
  return r.lat != null && r.lng != null;
}

export function TripMap({ reservations, onPinClick }: TripMapProps) {
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const polylineRef = useRef<google.maps.Polyline | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // All reservations with coordinates, sorted by start time for route lines.
  const pinnable = useMemo<Pinnable[]>(
    () =>
      reservations.filter(hasCoords).sort((a, b) => {
        const at = a.start_datetime ?? "";
        const bt = b.start_datetime ?? "";
        return at.localeCompare(bt);
      }),
    [reservations]
  );

  // Unique day keys present on the map, in chronological order.
  const dayKeys = useMemo(() => {
    const set = new Set<string>();
    for (const r of pinnable) {
      const key = r.start_datetime
        ? format(startOfDay(parseISO(r.start_datetime)), "yyyy-MM-dd")
        : "unscheduled";
      set.add(key);
    }
    return Array.from(set).sort();
  }, [pinnable]);

  // Which day keys are currently visible. Default: all.
  const [visibleDays, setVisibleDays] = useState<Set<string>>(
    () => new Set(dayKeys)
  );

  // Keep visibleDays in sync when the set of dayKeys changes (add/remove plans).
  useEffect(() => {
    setVisibleDays(new Set(dayKeys));
  }, [dayKeys]);

  // Initialize the map once.
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

  // Render markers + polyline whenever filtered pins change.
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!ready || !map) return;

    // Clear previous markers + line.
    for (const m of markersRef.current) m.setMap(null);
    markersRef.current = [];
    polylineRef.current?.setMap(null);
    polylineRef.current = null;

    const filtered = pinnable.filter((r) => {
      const key = r.start_datetime
        ? format(startOfDay(parseISO(r.start_datetime)), "yyyy-MM-dd")
        : "unscheduled";
      return visibleDays.has(key);
    });

    if (filtered.length === 0) return;

    const bounds = new google.maps.LatLngBounds();
    for (const r of filtered) {
      const position = { lat: r.lat, lng: r.lng };
      bounds.extend(position);
      const marker = new google.maps.Marker({
        map,
        position,
        title: r.provider_name ?? RESERVATION_LABELS[r.type],
        icon: pinIcon(colorForType(r.type)),
      });
      marker.addListener("click", () => onPinClick?.(r.id));
      markersRef.current.push(marker);
    }

    // Route polyline connecting pins in start_datetime order.
    if (filtered.length > 1) {
      polylineRef.current = new google.maps.Polyline({
        map,
        path: filtered.map((r) => ({ lat: r.lat, lng: r.lng })),
        geodesic: true,
        strokeColor: "#1A1814",
        strokeOpacity: 0.35,
        strokeWeight: 2,
      });
    }

    if (filtered.length === 1) {
      map.setCenter({ lat: filtered[0].lat, lng: filtered[0].lng });
      map.setZoom(13);
    } else {
      map.fitBounds(bounds, 48);
    }
  }, [pinnable, visibleDays, ready, onPinClick]);

  function toggleDay(key: string) {
    setVisibleDays((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  if (loadError) {
    return (
      <div className="tf-card py-12 text-center">
        <p className="micro-label mb-3">Map unavailable</p>
        <p className="text-sm text-tf-muted max-w-md mx-auto">{loadError}</p>
      </div>
    );
  }

  const hasPins = pinnable.length > 0;
  const withoutCoords = reservations.length - pinnable.length;

  return (
    <div className="space-y-4">
      <div className="tf-card overflow-hidden">
        <div
          ref={mapDivRef}
          className="w-full h-[calc(100vh-22rem)] min-h-[420px] bg-tf-cream"
        />
      </div>

      {hasPins && dayKeys.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="micro-label mr-1">Days</span>
          {dayKeys.map((key) => {
            const active = visibleDays.has(key);
            return (
              <button
                key={key}
                onClick={() => toggleDay(key)}
                className={cn(
                  "px-3 h-8 rounded-full border text-[11px] font-medium uppercase tracking-[0.12em] transition-colors",
                  active
                    ? "bg-tf-ink text-white border-tf-ink"
                    : "bg-white text-tf-muted border-tf-border-tertiary hover:text-tf-ink"
                )}
              >
                {key === "unscheduled"
                  ? "Unscheduled"
                  : format(parseISO(key), "MMM d")}
              </button>
            );
          })}
        </div>
      )}

      {!hasPins && (
        <div className="tf-card-cream py-10 text-center">
          <p className="micro-label mb-2">No locations yet</p>
          <p className="text-sm text-tf-muted max-w-md mx-auto">
            Plans with an address will appear on the map. Edit a plan to add its
            address.
          </p>
        </div>
      )}

      {hasPins && withoutCoords > 0 && (
        <p className="text-[11px] text-tf-muted text-center">
          {withoutCoords} {withoutCoords === 1 ? "plan has" : "plans have"} no
          address yet — add one to see it pinned.
        </p>
      )}
    </div>
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

// Muted map styling to match the editorial aesthetic.
const mapStyles: google.maps.MapTypeStyle[] = [
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  {
    featureType: "transit",
    elementType: "labels",
    stylers: [{ visibility: "off" }],
  },
  { featureType: "road", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
];
