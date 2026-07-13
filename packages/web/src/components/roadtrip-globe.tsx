import {useEffect, useMemo, useRef, useState} from "react";
import Globe from "react-globe.gl";
import type {GlobeMethods} from "react-globe.gl";
import type {InferResponseType} from "hono/client";
import {rpcClient} from "../lib/rpc.client";

type TourEvent = InferResponseType<typeof rpcClient.tours.events.$get, 200>["events"][number];

export function RoadtripGlobe({events, activeEventId, onSelect}: {events: TourEvent[]; activeEventId?: string; onSelect: (eventId: string) => void}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<GlobeMethods>();
  const [size, setSize] = useState({width: 1200, height: 760});

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(([entry]) => setSize({width: Math.floor(entry.contentRect.width), height: Math.floor(entry.contentRect.height)}));
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const points = useMemo(() => [...events]
    .sort((a, b) => {
      if (!a.date) return b.date ? 1 : 0;
      if (!b.date) return -1;
      return a.date.localeCompare(b.date);
    })
    .map((event) => ({
      ...event,
      lat: event.venue.latitude,
      lng: event.venue.longitude,
      altitude: event.id === activeEventId ? 0.2 : 0.09,
      radius: event.id === activeEventId ? 0.52 : 0.34,
      color: event.id === activeEventId ? "#f4ff78" : "#62e6c5",
      label: escapeLabel([event.venue.name, event.venue.city, formatShortDate(event)].filter(Boolean).join(" · ")),
    })), [activeEventId, events]);

  const routeLegs = useMemo(() => points.slice(1).flatMap((to, index) => {
    const from = points[index];
    if (from.lat === to.lat && from.lng === to.lng) return [];
    const active = from.id === activeEventId || to.id === activeEventId;
    return [{
      startLat: from.lat,
      startLng: from.lng,
      endLat: to.lat,
      endLng: to.lng,
      color: active ? ["#f4ff78", "#62e6c5"] : ["#31594f", "#62e6c5"],
      label: escapeLabel(`${from.venue.city ?? from.venue.name} → ${to.venue.city ?? to.venue.name}`),
    }];
  }), [activeEventId, points]);

  const activePoint = points.find((point) => point.id === activeEventId);
  const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

  useEffect(() => {
    if (!activePoint) return;
    globeRef.current?.pointOfView(
      {lat: activePoint.lat, lng: activePoint.lng, altitude: 1.75},
      prefersReducedMotion ? 0 : 900,
    );
  }, [activePoint, prefersReducedMotion]);

  return (
    <div ref={containerRef} className="globe-canvas">
      <Globe
        ref={globeRef}
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
        bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
        backgroundColor="rgba(0,0,0,0)"
        atmosphereColor="#73d8c0"
        atmosphereAltitude={0.16}
        pointsData={points}
        pointLat="lat"
        pointLng="lng"
        pointAltitude="altitude"
        pointColor="color"
        pointRadius="radius"
        pointLabel="label"
        pointsTransitionDuration={prefersReducedMotion ? 0 : 700}
        onPointClick={(point) => onSelect((point as TourEvent).id)}
        arcsData={routeLegs}
        arcStartLat="startLat"
        arcStartLng="startLng"
        arcEndLat="endLat"
        arcEndLng="endLng"
        arcColor="color"
        arcLabel="label"
        arcStroke={0.12}
        arcAltitudeAutoScale={0.35}
        arcDashLength={0.48}
        arcDashGap={0.16}
        arcDashAnimateTime={prefersReducedMotion ? 0 : 2600}
        arcsTransitionDuration={prefersReducedMotion ? 0 : 900}
        ringsData={activePoint ? [activePoint] : []}
        ringLat="lat"
        ringLng="lng"
        ringColor={() => "#f4ff78"}
        ringMaxRadius={2.8}
        ringPropagationSpeed={1.2}
        ringRepeatPeriod={prefersReducedMotion ? 0 : 1100}
        width={size.width}
        height={size.height}
      />
    </div>
  );
}

function formatShortDate(event: TourEvent) {
  return event.date ? new Intl.DateTimeFormat(undefined, {month: "short", day: "numeric"}).format(new Date(event.date)) : "TBD";
}

function escapeLabel(value: string) {
  return value.replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`);
}
