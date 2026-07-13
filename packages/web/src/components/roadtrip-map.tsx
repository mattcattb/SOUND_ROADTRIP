import {useEffect, useMemo, useRef, useState} from "react";
import Map, {
  Layer,
  Marker,
  NavigationControl,
  Popup,
  Source,
  type MapRef,
} from "react-map-gl/maplibre";
import type {LineLayerSpecification, SymbolLayerSpecification} from "maplibre-gl";
import type {InferResponseType} from "hono/client";
import {CalendarDays, MapPin} from "lucide-react";
import "maplibre-gl/dist/maplibre-gl.css";
import {rpcClient} from "../lib/rpc.client";

type TourEvent = InferResponseType<typeof rpcClient.tours.events.$get, 200>["events"][number];

const routeLayer: LineLayerSpecification = {
  id: "tour-route",
  type: "line",
  source: "tour-route",
  layout: {"line-cap": "round", "line-join": "round"},
  paint: {
    "line-color": "#375f50",
    "line-width": 4,
    "line-opacity": 0.85,
    "line-dasharray": [1.2, 1.4],
  },
};

const routeArrowLayer: SymbolLayerSpecification = {
  id: "tour-route-arrows",
  type: "symbol",
  source: "tour-route",
  layout: {
    "symbol-placement": "line",
    "symbol-spacing": 90,
    "text-field": "▶",
    "text-size": 11,
    "text-rotation-alignment": "map",
    "text-keep-upright": false,
    "text-allow-overlap": true,
  },
  paint: {
    "text-color": "#28483d",
    "text-halo-color": "#f4ecdc",
    "text-halo-width": 1.5,
  },
};

export function RoadtripMap({events, activeEventId, focusRequest = 0, onSelect}: {events: TourEvent[]; activeEventId?: string; focusRequest?: number; onSelect: (eventId: string) => void}) {
  const mapRef = useRef<MapRef>(null);
  const [hoveredEventId, setHoveredEventId] = useState<string>();
  const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  const points = useMemo(() => [...events]
    .sort((a, b) => {
      if (!a.date) return b.date ? 1 : 0;
      if (!b.date) return -1;
      return a.date.localeCompare(b.date);
    })
    .map((event, index) => ({...event, stopNumber: index + 1})), [events]);
  const activePoint = points.find((point) => point.id === activeEventId);
  const hoveredPoint = points.find((point) => point.id === hoveredEventId);
  const routeData = useMemo(() => ({
    type: "Feature" as const,
    properties: {},
    geometry: {
      type: "LineString" as const,
      coordinates: points.map((point) => [point.venue.longitude, point.venue.latitude]),
    },
  }), [points]);

  useEffect(() => {
    if (!points.length) return;
    const duration = prefersReducedMotion ? 0 : 900;
    if (activePoint && focusRequest > 0) {
      mapRef.current?.flyTo({
        center: [activePoint.venue.longitude, activePoint.venue.latitude],
        zoom: 5,
        duration,
      });
      return;
    }

    const longitudes = points.map((point) => point.venue.longitude);
    const latitudes = points.map((point) => point.venue.latitude);
    mapRef.current?.fitBounds([
      [Math.min(...longitudes), Math.min(...latitudes)],
      [Math.max(...longitudes), Math.max(...latitudes)],
    ], {padding: 80, maxZoom: 5, duration});
  }, [activePoint, focusRequest, points, prefersReducedMotion]);

  return (
    <div className="roadtrip-map">
      <Map
        ref={mapRef}
        initialViewState={{longitude: -20, latitude: 25, zoom: 1.2}}
        mapStyle={import.meta.env.VITE_MAP_STYLE_URL ?? "https://tiles.openfreemap.org/styles/positron"}
        minZoom={1}
        maxZoom={12}
        attributionControl={{compact: true}}
        reuseMaps
      >
        <NavigationControl position="bottom-left" showCompass={false} />
        {points.length > 1 ? (
          <Source id="tour-route" type="geojson" data={routeData}>
            <Layer {...routeLayer} />
            <Layer {...routeArrowLayer} />
          </Source>
        ) : null}
        {points.map((point) => (
          <Marker
            key={point.id}
            longitude={point.venue.longitude}
            latitude={point.venue.latitude}
            anchor="center"
          >
            <button
              type="button"
              className={point.id === activeEventId ? "map-stop active" : "map-stop"}
              aria-label={`Stop ${point.stopNumber}: ${point.venue.city ?? point.venue.name}`}
              onClick={() => onSelect(point.id)}
              onMouseEnter={() => setHoveredEventId(point.id)}
              onMouseLeave={() => setHoveredEventId(undefined)}
              onFocus={() => setHoveredEventId(point.id)}
              onBlur={() => setHoveredEventId(undefined)}
            >
              <span>{point.stopNumber}</span>
            </button>
          </Marker>
        ))}
        {hoveredPoint ? (
          <Popup
            longitude={hoveredPoint.venue.longitude}
            latitude={hoveredPoint.venue.latitude}
            anchor="bottom"
            offset={22}
            closeButton={false}
            closeOnClick={false}
            className="map-stop-popup"
          >
            <article>
              <p className="eyebrow">STOP {String(hoveredPoint.stopNumber).padStart(2, "0")}</p>
              <strong>{hoveredPoint.name}</strong>
              <span><MapPin className="h-3.5 w-3.5" /> {[hoveredPoint.venue.name, hoveredPoint.venue.city].filter(Boolean).join(", ")}</span>
              <span><CalendarDays className="h-3.5 w-3.5" /> {formatShortDate(hoveredPoint)}</span>
            </article>
          </Popup>
        ) : null}
      </Map>
    </div>
  );
}

function formatShortDate(event: TourEvent) {
  return event.date ? new Intl.DateTimeFormat(undefined, {month: "short", day: "numeric"}).format(new Date(event.date)) : "TBD";
}
