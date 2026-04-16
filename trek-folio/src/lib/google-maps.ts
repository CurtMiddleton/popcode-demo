"use client";

import { Loader } from "@googlemaps/js-api-loader";

let loaderPromise: Promise<typeof google> | null = null;

export function loadGoogleMaps(): Promise<typeof google> {
  if (!loaderPromise) {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return Promise.reject(
        new Error(
          "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not set. Add it to .env.local and restart the dev server."
        )
      );
    }
    const loader = new Loader({
      apiKey,
      version: "weekly",
      libraries: ["places", "marker"],
    });
    loaderPromise = loader.load();
  }
  return loaderPromise;
}

export interface GeocodeResult {
  lat: number;
  lng: number;
  placeId: string | null;
  formattedAddress: string;
}

export async function geocodeAddress(
  address: string
): Promise<GeocodeResult | null> {
  if (!address.trim()) return null;
  const google = await loadGoogleMaps();
  const geocoder = new google.maps.Geocoder();

  return new Promise((resolve) => {
    geocoder.geocode({ address }, (results, status) => {
      if (status !== "OK" || !results || results.length === 0) {
        resolve(null);
        return;
      }
      const top = results[0];
      const loc = top.geometry.location;
      resolve({
        lat: loc.lat(),
        lng: loc.lng(),
        placeId: top.place_id ?? null,
        formattedAddress: top.formatted_address,
      });
    });
  });
}
