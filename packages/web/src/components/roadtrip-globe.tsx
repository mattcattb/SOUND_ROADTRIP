import {useEffect, useMemo, useRef, useState} from "react";
import Globe from "react-globe.gl";
import type {GlobeMethods} from "react-globe.gl";
import type {InferResponseType} from "hono/client";
import {CalendarDays, MapPin} from "lucide-react";
import {rpcClient} from "../lib/rpc.client";

type TourEvent = InferResponseType<typeof rpcClient.tours.events.$get, 200>["events"][number];

export function RoadtripGlobe({events, activeEventId, focusRequest, onSelect}: {events: TourEvent[]; activeEventId?: string; focusRequest?: number; onSelect: (eventId: string) => void}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<GlobeMethods>();
  const [size, setSize] = useState({width: 1200, height: 760});
  const [hoveredEventId, setHoveredEventId] = useState<string>();
  const [hoverPosition, setHoverPosition] = useState<{x: number; y: number}>();

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
  const hoveredPoint = points.find((point) => point.id === hoveredEventId);
  const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

  const updateHoverPosition = (point: (typeof points)[number]) => {
    const screen = globeRef.current?.getScreenCoords(point.lat, point.lng, point.altitude);
    if (!screen) return;
    setHoverPosition({
      x: Math.min(Math.max(screen.x, 125), size.width - 125),
      y: Math.min(Math.max(screen.y, 145), size.height - 24),
    });
  };

  useEffect(() => {
    if (!activePoint) return;
    globeRef.current?.pointOfView(
      {lat: activePoint.lat, lng: activePoint.lng, altitude: 1.75},
      prefersReducedMotion ? 0 : 900,
    );
  }, [activePoint, focusRequest, prefersReducedMotion]);

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
        pointsTransitionDuration={prefersReducedMotion ? 0 : 700}
        onPointClick={(point) => onSelect((point as TourEvent).id)}
        onPointHover={(point) => {
          if (!point) {
            setHoveredEventId(undefined);
            setHoverPosition(undefined);
            return;
          }
          const hovered = point as (typeof points)[number];
          setHoveredEventId(hovered.id);
          updateHoverPosition(hovered);
        }}
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
        onZoom={() => {
          if (hoveredPoint) updateHoverPosition(hoveredPoint);
        }}
        width={size.width}
        height={size.height}
      />
      {hoveredPoint && hoverPosition ? (
        <article
          className="globe-hover-card"
          style={{left: hoverPosition.x, top: hoverPosition.y}}
          aria-hidden="true"
        >
          <p className="eyebrow">TOUR STOP</p>
          <strong>{hoveredPoint.name}</strong>
          <span><MapPin className="h-3.5 w-3.5" /> {[hoveredPoint.venue.name, hoveredPoint.venue.city].filter(Boolean).join(", ")}</span>
          <span><CalendarDays className="h-3.5 w-3.5" /> {formatShortDate(hoveredPoint)}</span>
        </article>
      ) : null}
    </div>
  );
}

function formatShortDate(event: TourEvent) {
  return event.date ? new Intl.DateTimeFormat(undefined, {month: "short", day: "numeric"}).format(new Date(event.date)) : "TBD";
}

function escapeLabel(value: string) {
  return value.replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`);
}
