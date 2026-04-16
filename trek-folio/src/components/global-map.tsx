"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { IoSearchOutline, IoCloseOutline } from "react-icons/io5";
import { MarkerClusterer, type Renderer } from "@googlemaps/markerclusterer";
import { loadGoogleMaps } from "@/lib/google-maps";
import { cn } from "@/lib/utils";

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
  const markersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const clustererRef = useRef<MarkerClusterer | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState("");
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Upcoming first (ascending by date), then past (most-recent first).
  const sortedPins = useMemo(() => {
    const upcoming = pins
      .filter((p) => p.isUpcoming)
      .sort((a, b) => (a.startDate ?? "").localeCompare(b.startDate ?? ""));
    const past = pins
      .filter((p) => !p.isUpcoming)
      .sort((a, b) => (b.endDate ?? "").localeCompare(a.endDate ?? ""));
    return [...upcoming, ...past];
  }, [pins]);

  const filteredPins = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sortedPins;
    return sortedPins.filter((p) => {
      const hay = `${p.destination ?? ""} ${p.name}`.toLowerCase();
      return hay.includes(q);
    });
  }, [sortedPins, query]);

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

  // Re-render markers when the filtered list changes.
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!ready || !map) return;

    clustererRef.current?.clearMarkers();
    for (const m of markersRef.current.values()) m.setMap(null);
    markersRef.current.clear();

    if (filteredPins.length === 0) return;

    const bounds = new google.maps.LatLngBounds();
    const markers: google.maps.Marker[] = [];
    for (const pin of filteredPins) {
      const position = { lat: pin.lat, lng: pin.lng };
      bounds.extend(position);
      const marker = new google.maps.Marker({
        position,
        title: buildTooltip(pin),
        icon: tripPinIcon(pin.isUpcoming ? "#1A1814" : "#B5AC97"),
      });
      marker.addListener("click", () => {
        router.push(`/trips/${pin.tripId}`);
      });
      markersRef.current.set(pin.tripId, marker);
      markers.push(marker);
    }

    clustererRef.current = new MarkerClusterer({
      map,
      markers,
      renderer: clusterRenderer,
    });

    if (filteredPins.length === 1) {
      map.setCenter({ lat: filteredPins[0].lat, lng: filteredPins[0].lng });
      map.setZoom(6);
    } else {
      map.fitBounds(bounds, 64);
    }
  }, [filteredPins, ready, router]);

  // Highlight the hovered pin by swapping its icon temporarily.
  useEffect(() => {
    for (const [id, marker] of markersRef.current.entries()) {
      const pin = filteredPins.find((p) => p.tripId === id);
      if (!pin) continue;
      const base = pin.isUpcoming ? "#1A1814" : "#B5AC97";
      const active = id === hoveredId;
      marker.setIcon(
        active ? tripPinIcon("#D4723A", 1.1) : tripPinIcon(base)
      );
      marker.setZIndex(active ? 999 : undefined);
    }
  }, [hoveredId, filteredPins]);

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
    <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-4">
      <aside className="tf-card p-4 flex flex-col gap-3 md:max-h-[calc(100vh-14rem)] md:min-h-[460px]">
        <div className="relative">
          <IoSearchOutline
            className="absolute left-3 top-1/2 -translate-y-1/2 text-tf-muted"
            style={{ fontSize: 14 }}
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search trips"
            className="w-full h-9 pl-9 pr-8 text-[13px] rounded-md border border-tf-border-tertiary bg-white focus:outline-none focus:ring-1 focus:ring-tf-ink/30"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-tf-muted hover:text-tf-ink"
              aria-label="Clear search"
            >
              <IoCloseOutline style={{ fontSize: 14 }} />
            </button>
          )}
        </div>

        <div className="flex items-center justify-between">
          <span className="micro-label">
            {filteredPins.length}{" "}
            {filteredPins.length === 1 ? "trip" : "trips"}
          </span>
          <span className="micro-label text-tf-muted/70">
            Upcoming · Past
          </span>
        </div>

        <ul className="flex-1 min-h-0 overflow-y-auto -mx-1 px-1">
          {filteredPins.length === 0 ? (
            <li className="text-[13px] text-tf-muted py-8 text-center">
              No matches
            </li>
          ) : (
            filteredPins.map((pin) => (
              <TripCard
                key={pin.tripId}
                pin={pin}
                hovered={hoveredId === pin.tripId}
                onHover={setHoveredId}
                onOpen={() => router.push(`/trips/${pin.tripId}`)}
              />
            ))
          )}
        </ul>
      </aside>

      <div className="tf-card overflow-hidden">
        <div
          ref={mapDivRef}
          className="w-full h-[calc(100vh-14rem)] min-h-[460px] bg-tf-cream"
        />
      </div>
    </div>
  );
}

function TripCard({
  pin,
  hovered,
  onHover,
  onOpen,
}: {
  pin: TripPin;
  hovered: boolean;
  onHover: (id: string | null) => void;
  onOpen: () => void;
}) {
  const title = pin.destination ?? pin.name;
  const dates = formatDateRange(pin.startDate, pin.endDate);
  return (
    <li>
      <button
        onMouseEnter={() => onHover(pin.tripId)}
        onMouseLeave={() => onHover(null)}
        onFocus={() => onHover(pin.tripId)}
        onBlur={() => onHover(null)}
        onClick={onOpen}
        className={cn(
          "w-full text-left px-3 py-2.5 rounded-md transition-colors border border-transparent",
          hovered
            ? "bg-tf-cream border-tf-border-tertiary"
            : "hover:bg-tf-cream/60"
        )}
      >
        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              "inline-block w-2 h-2 rounded-full shrink-0",
              pin.isUpcoming ? "bg-tf-ink" : "bg-[#B5AC97]"
            )}
          />
          <span className="font-display-roman text-[15px] text-tf-ink truncate flex-1">
            {title}
          </span>
          <span className="text-[11px] text-tf-muted shrink-0">
            {pin.planCount}
          </span>
        </div>
        {dates && (
          <p className="text-[12px] font-light text-tf-ink/60 mt-0.5 ml-[18px]">
            {dates}
          </p>
        )}
      </button>
    </li>
  );
}

function formatDateRange(
  start: string | null,
  end: string | null
): string | null {
  if (!start && !end) return null;
  try {
    const s = start ? format(parseISO(start), "MMM d, yyyy") : null;
    const e = end ? format(parseISO(end), "MMM d, yyyy") : null;
    if (s && e) return `${s} – ${e}`;
    return s ?? e;
  } catch {
    return null;
  }
}

function buildTooltip(pin: TripPin): string {
  const title = pin.destination ?? pin.name;
  const dates = formatDateRange(pin.startDate, pin.endDate);
  const count = `${pin.planCount} plan${pin.planCount === 1 ? "" : "s"}`;
  return dates ? `${title} · ${dates} · ${count}` : `${title} · ${count}`;
}

function tripPinIcon(hex: string, scale = 0.7): google.maps.Symbol {
  return {
    path: "M12 0C5.37 0 0 5.37 0 12c0 9 12 20 12 20s12-11 12-20c0-6.63-5.37-12-12-12z",
    fillColor: hex,
    fillOpacity: 1,
    strokeColor: "#ffffff",
    strokeWeight: 1.5,
    scale,
    anchor: new google.maps.Point(12, 32),
    labelOrigin: new google.maps.Point(12, 12),
  };
}

// Match the editorial aesthetic: dark circle with the count centered.
const clusterRenderer: Renderer = {
  render: ({ count, position }) =>
    new google.maps.Marker({
      position,
      label: {
        text: String(count),
        color: "#ffffff",
        fontSize: "12px",
        fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
        fontWeight: "500",
      },
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        fillColor: "#1A1814",
        fillOpacity: 0.92,
        strokeColor: "#ffffff",
        strokeWeight: 2,
        scale: 14,
      },
      // Ensure clusters render above individual pins.
      zIndex: 1000,
    }),
};

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
