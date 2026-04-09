"use client";

import { useEffect, useMemo } from "react";
import {
    CircleMarker,
    MapContainer,
    Polyline,
    Popup,
    TileLayer,
    Tooltip,
    useMap,
} from "react-leaflet";
import type { LatLngBoundsExpression, LatLngExpression, LatLngTuple } from "leaflet";
import "leaflet/dist/leaflet.css";

import type {
    DispatchBoardData,
    DispatchLiveTripItem,
    DispatchLocationPoint,
    DispatchQueueTripItem,
} from "@/lib/admin-dispatch-types";
import { formatLabel } from "@/components/admin-dashboard/primitives";

type DispatchFleetMapProps = {
    board: DispatchBoardData;
    selectedTripId?: string | null;
    selectedDriverId?: string | null;
};

function toLatLng(point: DispatchLocationPoint | null | undefined): LatLngExpression | null {
    if (!point) return null;
    return [point.latitude, point.longitude];
}

function toBoundsLatLng(point: DispatchLocationPoint | null | undefined): LatLngTuple | null {
    if (!point) return null;
    return [point.latitude, point.longitude];
}

function FitVisibleBounds({
    boundsPoints,
}: {
    boundsPoints: LatLngTuple[];
}) {
    const map = useMap();

    useEffect(() => {
        if (boundsPoints.length === 0) return;
        if (boundsPoints.length === 1) {
            map.flyTo(boundsPoints[0], Math.max(map.getZoom(), 12), { duration: 0.8 });
            return;
        }
        map.fitBounds(boundsPoints as LatLngBoundsExpression, { padding: [36, 36], maxZoom: 14 });
    }, [boundsPoints, map]);

    return null;
}

function QueueTripOverlay({ trip, highlighted }: { trip: DispatchQueueTripItem; highlighted: boolean }) {
    const pickup = toLatLng(trip.pickupLocation);
    const destination = toLatLng(trip.destinationLocation);
    if (!pickup) return null;

    const tone =
        trip.slaState === "breached"
            ? "#fb7185"
            : trip.slaState === "warning"
              ? "#f59e0b"
              : "#2dd4bf";

    return (
        <>
            <CircleMarker
                center={pickup}
                radius={highlighted ? 11 : 8}
                pathOptions={{
                    color: tone,
                    fillColor: tone,
                    fillOpacity: highlighted ? 0.95 : 0.78,
                    weight: highlighted ? 3 : 2,
                }}
            >
                <Tooltip direction="top" offset={[0, -8]} opacity={0.95}>
                    {trip.customerName} • {trip.pickup}
                </Tooltip>
                <Popup>
                    <div className="space-y-1 text-right">
                        <p className="font-bold">{trip.customerName}</p>
                        <p className="text-sm">من: {trip.pickup}</p>
                        <p className="text-sm">إلى: {trip.destination}</p>
                        <p className="text-xs text-slate-500">{trip.slaLabel}</p>
                    </div>
                </Popup>
            </CircleMarker>
            {destination ? (
                <Polyline
                    positions={[pickup, destination]}
                    pathOptions={{
                        color: tone,
                        opacity: highlighted ? 0.7 : 0.35,
                        weight: highlighted ? 4 : 2,
                        dashArray: "8 10",
                    }}
                />
            ) : null}
        </>
    );
}

function LiveTripOverlay({ trip, highlighted }: { trip: DispatchLiveTripItem; highlighted: boolean }) {
    const pickup = toLatLng(trip.pickupLocation);
    const destination = toLatLng(trip.destinationLocation);
    const driver = toLatLng(trip.driverLocation);

    const tone =
        trip.slaState === "breached"
            ? "#f97316"
            : trip.status === "trip_started"
              ? "#38bdf8"
              : "#22c55e";

    return (
        <>
            {pickup ? (
                <CircleMarker
                    center={pickup}
                    radius={highlighted ? 10 : 7}
                    pathOptions={{
                        color: "#f8fafc",
                        fillColor: "#111827",
                        fillOpacity: 0.7,
                        weight: highlighted ? 3 : 2,
                    }}
                >
                    <Tooltip direction="top" offset={[0, -8]} opacity={0.95}>
                        نقطة التحرك • {trip.pickup}
                    </Tooltip>
                </CircleMarker>
            ) : null}
            {destination ? (
                <CircleMarker
                    center={destination}
                    radius={highlighted ? 9 : 6}
                    pathOptions={{
                        color: "#a78bfa",
                        fillColor: "#7c3aed",
                        fillOpacity: 0.85,
                        weight: highlighted ? 3 : 2,
                    }}
                >
                    <Tooltip direction="top" offset={[0, -8]} opacity={0.95}>
                        الوجهة • {trip.destination}
                    </Tooltip>
                </CircleMarker>
            ) : null}
            {driver ? (
                <CircleMarker
                    center={driver}
                    radius={highlighted ? 12 : 9}
                    pathOptions={{
                        color: tone,
                        fillColor: tone,
                        fillOpacity: highlighted ? 0.95 : 0.85,
                        weight: highlighted ? 3 : 2,
                    }}
                >
                    <Tooltip direction="top" offset={[0, -8]} opacity={0.95}>
                        {trip.driverName || "كابتن"} • {formatLabel(trip.status)}
                    </Tooltip>
                    <Popup>
                        <div className="space-y-1 text-right">
                            <p className="font-bold">{trip.driverName || "كابتن"}</p>
                            <p className="text-sm">{trip.customerName}</p>
                            <p className="text-sm">{trip.slaLabel}</p>
                        </div>
                    </Popup>
                </CircleMarker>
            ) : null}
            {driver && pickup && trip.status !== "trip_started" ? (
                <Polyline
                    positions={[driver, pickup]}
                    pathOptions={{
                        color: tone,
                        opacity: highlighted ? 0.9 : 0.55,
                        weight: highlighted ? 5 : 3,
                    }}
                />
            ) : null}
            {pickup && destination && trip.status === "trip_started" ? (
                <Polyline
                    positions={[pickup, destination]}
                    pathOptions={{
                        color: tone,
                        opacity: highlighted ? 0.9 : 0.7,
                        weight: highlighted ? 5 : 3,
                    }}
                />
            ) : null}
        </>
    );
}

export function DispatchFleetMap({
    board,
    selectedTripId,
    selectedDriverId,
}: DispatchFleetMapProps) {
    const boundsPoints = useMemo(() => {
        const selectedQueueTrip = board.queueTrips.find((trip) => trip.id === selectedTripId);
        const selectedLiveTrip = board.liveTrips.find((trip) => trip.id === selectedTripId);
        const selectedDriver = board.assignableDrivers.find((driver) => driver.id === selectedDriverId);

        const focusedPoints = [
            selectedQueueTrip?.pickupLocation,
            selectedQueueTrip?.destinationLocation,
            selectedLiveTrip?.pickupLocation,
            selectedLiveTrip?.destinationLocation,
            selectedLiveTrip?.driverLocation,
            selectedDriver?.location,
        ]
            .map(toBoundsLatLng)
            .filter((point): point is LatLngTuple => point !== null);

        if (focusedPoints.length > 0) return focusedPoints;

        return [
            ...board.queueTrips.flatMap((trip) => [trip.pickupLocation, trip.destinationLocation]),
            ...board.liveTrips.flatMap((trip) => [trip.pickupLocation, trip.destinationLocation, trip.driverLocation]),
            ...board.availableDrivers.map((driver) => driver.location),
        ]
            .map(toBoundsLatLng)
            .filter((point): point is LatLngTuple => point !== null);
    }, [board, selectedDriverId, selectedTripId]);

    return (
        <div className="relative overflow-hidden rounded-[28px] border border-white/10">
            <div className="absolute inset-x-4 top-4 z-[500] flex flex-wrap gap-2">
                <span className="rounded-full border border-white/10 bg-black/55 px-3 py-1 text-xs text-white/75">الطابور: تركواز / برتقالي حسب SLA</span>
                <span className="rounded-full border border-white/10 bg-black/55 px-3 py-1 text-xs text-white/75">الرحلات الحية: أخضر / أزرق</span>
                <span className="rounded-full border border-white/10 bg-black/55 px-3 py-1 text-xs text-white/75">الوجهة: بنفسجي</span>
            </div>

            <MapContainer center={[30.0444, 31.2357]} zoom={11} zoomControl={false} className="h-[38rem] w-full bg-[#111614]">
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                    maxZoom={19}
                />
                <FitVisibleBounds boundsPoints={boundsPoints} />

                {board.queueTrips.map((trip) => (
                    <QueueTripOverlay key={trip.id} trip={trip} highlighted={selectedTripId === trip.id} />
                ))}
                {board.liveTrips.map((trip) => (
                    <LiveTripOverlay key={trip.id} trip={trip} highlighted={selectedTripId === trip.id || selectedDriverId === trip.driverId} />
                ))}

                {board.availableDrivers
                    .filter((driver) => driver.location && !board.liveTrips.some((trip) => trip.driverId === driver.id))
                    .map((driver) => (
                        <CircleMarker
                            key={driver.id}
                            center={toLatLng(driver.location)!}
                            radius={selectedDriverId === driver.id ? 10 : 7}
                            pathOptions={{
                                color: "#f8fafc",
                                fillColor: "#14b8a6",
                                fillOpacity: selectedDriverId === driver.id ? 0.95 : 0.75,
                                weight: selectedDriverId === driver.id ? 3 : 2,
                            }}
                        >
                            <Tooltip direction="top" offset={[0, -8]} opacity={0.95}>
                                {driver.fullName} • {driver.locationLabel || driver.city}
                            </Tooltip>
                            <Popup>
                                <div className="space-y-1 text-right">
                                    <p className="font-bold">{driver.fullName}</p>
                                    <p className="text-sm">{driver.vehicleLabel || "مفيش مركبة أساسية"}</p>
                                    <p className="text-xs text-slate-500">{driver.locationLabel || driver.city}</p>
                                </div>
                            </Popup>
                        </CircleMarker>
                    ))}
            </MapContainer>
        </div>
    );
}
