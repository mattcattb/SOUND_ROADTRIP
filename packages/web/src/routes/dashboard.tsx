import {createFileRoute, Navigate} from "@tanstack/react-router";
import {useQuery} from "@tanstack/react-query";
import {parseResponse, type InferResponseType} from "hono/client";
import {useEffect, useMemo, useRef, useState} from "react";
import Globe from "react-globe.gl";
import {
  Calendar,
  ExternalLink,
  MapPin,
  RefreshCw,
  SkipBack,
  SkipForward,
} from "lucide-react";
import {Button} from "../components/ui";
import {useSession} from "../lib/auth";
import {rpcClient} from "../lib/rpc.client";

const toursApi = rpcClient.tours.roadtrip;
type Roadtrip = InferResponseType<typeof toursApi.$get>;
type TourEvent = Roadtrip["events"][number];
const sessionKey = (userId: string) => `spotify-roadtrip:v1:${userId}`;

const getStoredRoadtrip = (userId?: string) => {
  if (!userId || typeof window === "undefined") return undefined;

  try {
    const value = window.sessionStorage.getItem(sessionKey(userId));
    return value ? (JSON.parse(value) as Roadtrip) : undefined;
  } catch {
    return undefined;
  }
};

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const {data: session, isPending} = useSession();
  const [activeEventId, setActiveEventId] = useState<string>();

  const roadtripQuery = useQuery({
    queryKey: ["roadtrip", session?.user.id],
    queryFn: () => parseResponse(toursApi.$get({query: {limit: "5"}})),
    enabled: Boolean(session && !isPending),
    initialData: () => getStoredRoadtrip(session?.user.id),
    staleTime: Infinity,
  });

  const events = roadtripQuery.data?.events ?? [];
  const activeIndex = Math.max(
    0,
    events.findIndex((event) => event.id === activeEventId),
  );
  const activeEvent = events[activeIndex];

  useEffect(() => {
    if (session?.user.id && roadtripQuery.data) {
      window.sessionStorage.setItem(
        sessionKey(session.user.id),
        JSON.stringify(roadtripQuery.data),
      );
    }
  }, [roadtripQuery.data, session?.user.id]);

  useEffect(() => {
    if (events.length > 0 && !events.some((event) => event.id === activeEventId)) {
      setActiveEventId(events[0].id);
    }
  }, [activeEventId, events]);

  if (!isPending && !session) {
    return <Navigate to="/login" replace />;
  }

  const move = (direction: -1 | 1) => {
    if (events.length === 0) return;
    setActiveEventId(events[(activeIndex + direction + events.length) % events.length].id);
  };

  return (
    <div className="space-y-6">
      <section className="grid gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.8fr)]">
        <div className="min-h-[620px] overflow-hidden rounded-lg border border-border bg-[#071013]">
          <div className="flex h-full min-h-[620px] items-center justify-center">
            {roadtripQuery.isLoading ? (
              <div className="text-sm text-white/70">Mapping your artists...</div>
            ) : events.length > 0 ? (
              <RoadtripGlobe
                events={events}
                activeEventId={activeEventId}
                onSelect={setActiveEventId}
              />
            ) : (
              <div className="max-w-sm text-center text-sm text-white/70">
                No mapped Ticketmaster events were found for these top artists yet.
              </div>
            )}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-lg border border-border bg-surface-elevated p-5">
            <p className="text-sm font-semibold uppercase text-muted-foreground">
              Spotify Roadtrip
            </p>
            <h1 className="mt-2 text-3xl font-semibold leading-tight">
              Your top artists’ upcoming shows, mapped across the globe.
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Signed in as {session?.user.email}. Ticketmaster matches are discovery data, not confirmed artist tour routes.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => roadtripQuery.refetch()}
              disabled={roadtripQuery.isFetching}
            >
              <RefreshCw className="h-4 w-4" />
              {roadtripQuery.isFetching ? "Refreshing" : "Refresh map"}
            </Button>
            {roadtripQuery.data?.provider.status === "not_configured" ? (
              <div className="mt-4 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-foreground">
                Add a Ticketmaster API key to load live concert locations.
              </div>
            ) : null}
            {roadtripQuery.data?.provider.status === "degraded" ? (
              <div className="mt-4 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-foreground">
                {roadtripQuery.data.provider.message ?? "Ticketmaster is temporarily unavailable."}
              </div>
            ) : null}
          </div>

          <div className="rounded-lg border border-border bg-surface-elevated p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Tour stop</h2>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 w-10 p-0"
                  onClick={() => move(-1)}
                  disabled={events.length === 0}
                >
                  <SkipBack className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 w-10 p-0"
                  onClick={() => move(1)}
                  disabled={events.length === 0}
                >
                  <SkipForward className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {activeEvent ? (
              <div className="mt-4 space-y-4">
                <div>
                  <div className="text-sm font-medium text-primary">{activeEvent.artistName}</div>
                  <div className="text-2xl font-semibold">{activeEvent.name}</div>
                </div>
                <div className="grid gap-3 text-sm">
                  <div className="flex gap-2">
                    <Calendar className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    <span>{formatEventDate(activeEvent)}</span>
                  </div>
                  <div className="flex gap-2">
                    <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    <span>
                      {activeEvent.venue.name}, {[
                        activeEvent.venue.city,
                        activeEvent.venue.state,
                        activeEvent.venue.country,
                      ].filter(Boolean).join(", ")}
                    </span>
                  </div>
                </div>
                {activeEvent.url ? (
                  <a
                    href={activeEvent.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                  >
                    Open event <ExternalLink className="h-4 w-4" />
                  </a>
                ) : null}
              </div>
            ) : (
              <div className="mt-4 text-sm text-muted-foreground">
                No upcoming mapped shows are available for these artists yet.
              </div>
            )}
          </div>
        </aside>
      </section>

      <section className="grid gap-3 md:grid-cols-5">
        {(roadtripQuery.data?.artists ?? []).map((artist) => (
          <a
            key={artist.id}
            href={artist.spotifyUrl}
            target="_blank"
            rel="noreferrer"
            className="overflow-hidden rounded-lg border border-border bg-surface-elevated transition hover:-translate-y-0.5 hover:border-primary/50"
          >
            {artist.image ? (
              <img src={artist.image} alt="" className="aspect-square w-full object-cover" />
            ) : (
              <div className="aspect-square bg-muted" />
            )}
            <div className="space-y-1 p-3">
              <div className="line-clamp-1 text-sm font-semibold">{artist.name}</div>
              <div className="line-clamp-1 text-xs text-muted-foreground">
                {artist.genres.join(", ") || "Top artist"}
              </div>
            </div>
          </a>
        ))}
      </section>

      {roadtripQuery.error ? (
        <div className="rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {roadtripQuery.error instanceof Error
            ? roadtripQuery.error.message
            : "Could not load the roadtrip."}
        </div>
      ) : null}
    </div>
  );
}

function RoadtripGlobe({
  events,
  activeEventId,
  onSelect,
}: {
  events: TourEvent[];
  activeEventId?: string;
  onSelect: (eventId: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({width: 820, height: 620});

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(([entry]) => {
      setSize({
        width: Math.floor(entry.contentRect.width),
        height: Math.max(440, Math.floor(entry.contentRect.height)),
      });
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  const points = useMemo(
    () =>
      events.map((event) => ({
        ...event,
        lat: event.venue.latitude,
        lng: event.venue.longitude,
        size: event.id === activeEventId ? 0.42 : 0.24,
        color: event.id === activeEventId ? "#f59e0b" : "#14b8a6",
      })),
    [activeEventId, events],
  );

  return (
    <div ref={containerRef} className="h-full min-h-[620px] w-full">
      <Globe
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
        bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
        backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
        pointsData={points}
        pointAltitude="size"
        pointColor="color"
        pointRadius={0.38}
        onPointClick={(event) => onSelect((event as TourEvent).id)}
        labelsData={points}
        labelLat={(event) => (event as TourEvent).venue.latitude}
        labelLng={(event) => (event as TourEvent).venue.longitude}
        labelText={(event) => (event as TourEvent).venue.city ?? ""}
        labelSize={1.1}
        labelDotRadius={0.25}
        labelColor={() => "#ffffff"}
        width={size.width}
        height={size.height}
      />
    </div>
  );
}

function formatEventDate(event: TourEvent) {
  if (!event.date) return "Date TBD";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: event.localTime ? "short" : undefined,
  }).format(new Date(event.date));
}
