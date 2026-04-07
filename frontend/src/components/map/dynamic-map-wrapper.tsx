"use client";

import dynamic from "next/dynamic";

export interface InteractiveMapProps {
  initialCenter?: [number, number];
  onLocationChange?: (lat: number, lng: number) => void;
  zoom?: number;
}

export const InteractiveMap = dynamic<InteractiveMapProps>(
  () => import("@/components/map/interactive-map").then((mod) => mod.InteractiveMap),
  { 
    ssr: false,
    loading: () => (
       <div className="absolute inset-0 bg-surface-container animate-pulse flex items-center justify-center">
         <div className="w-12 h-12 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
       </div>
    )
  }
);
