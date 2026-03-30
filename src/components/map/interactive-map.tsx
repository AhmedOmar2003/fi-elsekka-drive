"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";

// Fix Leaflet icons issue in Next.js/Webpack
import L from "leaflet";
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

interface InteractiveMapProps {
  initialCenter?: [number, number]; // [lat, lng]
  onLocationChange?: (lat: number, lng: number) => void;
  zoom?: number;
}

// A helper component to listen to map movements
function MapMovementListener({
  onLocationChange,
}: {
  onLocationChange?: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    moveend: (e) => {
      const center = e.target.getCenter();
      if (onLocationChange) {
        onLocationChange(center.lat, center.lng);
      }
    },
  });
  return null;
}

function MapCenterSync({ center }: { center: [number, number] }) {
  const map = useMap();

  useEffect(() => {
    const currentCenter = map.getCenter();
    const hasMeaningfulDifference =
      Math.abs(currentCenter.lat - center[0]) > 0.0001 ||
      Math.abs(currentCenter.lng - center[1]) > 0.0001;

    if (hasMeaningfulDifference) {
      map.flyTo(center, map.getZoom(), {
        animate: true,
        duration: 0.8,
      });
    }
  }, [center, map]);

  return null;
}

export function InteractiveMap({
  initialCenter = [30.0444, 31.2357], // Default to Cairo
  onLocationChange,
  zoom = 15,
}: InteractiveMapProps) {
  // Use Cartesian tiles to match dark mode: CartoDB Dark Matter
  // or Stamen Toner Lite if we want a generic look.
  // For standard OpenStreetMap: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
  // For Dark Mode App matching: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"

  return (
    <div className="relative w-full h-full bg-[#111614] z-0">
      <MapContainer
        center={initialCenter}
        zoom={zoom}
        zoomControl={false}
        className="w-full h-full"
        // remove strict bounds so it can pan anywhere
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          maxZoom={19}
        />
        <MapCenterSync center={initialCenter} />
        <MapMovementListener onLocationChange={onLocationChange} />
      </MapContainer>
    </div>
  );
}
