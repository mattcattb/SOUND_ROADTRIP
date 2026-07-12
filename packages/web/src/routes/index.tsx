import {createFileRoute} from "@tanstack/react-router";
import {useQuery} from "@tanstack/react-query";
import {parseResponse, type InferResponseType} from "hono/client";
import {useEffect, useMemo, useRef, useState} from "react";
import Globe from "react-globe.gl";
import {
  ArrowRight,
  CalendarDays,
  ExternalLink,
  Headphones,
  MapPin,
  Search,
  Sparkles,
} from "lucide-react";
import {Button, Input} from "../components/ui";
import {signInWithSpotify, useSession} from "../lib/auth";
import {rpcClient} from "../lib/rpc.client";

const searchApi = rpcClient.tours.search;
const roadtripApi = rpcClient.tours.roadtrip;
type SearchResult = InferResponseType<typeof searchApi.$get>;
type Roadtrip = InferResponseType<typeof roadtripApi.$get>;
type TourEvent = SearchResult["events"][number];

export const Route = createFileRoute("/")({component: ExplorePage});

function ExplorePage() {
  const {data: session, isPending: sessionPending} = useSession();
  const [artist, setArtist] = useState("");
  const [search, setSearch] = useState("");
  const [activeEventId, setActiveEventId] = useState<string>();

  const searchQuery = useQuery({
    queryKey: ["artist-tour", search],
    queryFn: () => parseResponse(searchApi.$get({query: {artist: search}})),
    enabled: search.length >= 2,
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60 * 24,
  });

  const spotifyQuery = useQuery({
    queryKey: ["spotify-roadtrip", session?.user.id],
    queryFn: () => parseResponse(roadtripApi.$get({query: {limit: "5"}})),
    enabled: Boolean(session && !search),
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60 * 24,
  });

  const data: SearchResult | Roadtrip | undefined = search ? searchQuery.data : spotifyQuery.data;
  const events = data?.events ?? [];
  const activeEvent = events.find((event) => event.id === activeEventId) ?? events[0];
  const loading = search ? searchQuery.isFetching : spotifyQuery.isFetching;
  const error = search ? searchQuery.error : spotifyQuery.error;

  useEffect(() => {
    if (events.length && !events.some((event) => event.id === activeEventId)) {
      setActiveEventId(events[0].id);
    }
  }, [activeEventId, events]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const value = artist.trim();
    if (value.length >= 2) setSearch(value);
  };

  return (
    <div className="explorer-shell">
      <header className="app-bar">
        <a href="/" className="brand" aria-label="Roadtrip home">
          <span className="brand-mark"><Sparkles className="h-4 w-4" /></span>
          <span>Roadtrip</span>
        </a>
        <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
          <span className="status-dot" /> LIVE CONCERT DISCOVERY
        </div>
      </header>

      <section className="globe-stage" aria-label="Interactive concert map">
        <RoadtripGlobe
          events={events}
          activeEventId={activeEvent?.id}
          onSelect={setActiveEventId}
        />
        <div className="globe-vignette" />
        <div className="hero-copy pointer-events-none">
          <p className="eyebrow">YOUR MUSIC. THE WHOLE WORLD.</p>
          <h1>Find where the music<br />takes you next.</h1>
          <p>Search any artist or connect Spotify to turn your taste into a living map of upcoming shows.</p>
        </div>

        <div className="command-panel">
          <form onSubmit={submit} className="search-form">
            <Search className="h-5 w-5 text-muted-foreground" />
            <Input
              value={artist}
              onChange={(event) => setArtist(event.target.value)}
              placeholder="Search an artist..."
              aria-label="Artist name"
              className="search-input"
            />
            <Button type="submit" size="sm" disabled={artist.trim().length < 2} aria-label="Search">
              Explore <ArrowRight className="h-4 w-4" />
            </Button>
          </form>
          <div className="or-divider"><span>OR</span></div>
          <Button
            className="spotify-button"
            onClick={signInWithSpotify}
            disabled={sessionPending || Boolean(session)}
          >
            <Headphones className="h-4 w-4" />
            {session ? "Spotify connected" : "Import my Spotify"}
          </Button>
          <p className="privacy-note">Read-only access · your listening data stays yours</p>
        </div>

        {loading ? <div className="map-state">Plotting tour dates…</div> : null}
      </section>

      {(search || session) && !loading ? (
        <section className="results-drawer" aria-live="polite">
          <div className="results-heading">
            <div>
              <p className="eyebrow">{search ? "ARTIST SEARCH" : "FROM YOUR TOP ARTISTS"}</p>
              <h2>{search || "Your Spotify roadtrip"}</h2>
            </div>
            <div className="result-count"><strong>{events.length}</strong> upcoming shows</div>
          </div>

          {data?.provider.status === "not_configured" ? (
            <p className="empty-state">Add a Ticketmaster API key to load live concert data.</p>
          ) : events.length === 0 ? (
            <p className="empty-state">No mapped shows found yet. Try another artist.</p>
          ) : (
            <div className="results-grid">
              <div className="event-list">
                {events.slice(0, 8).map((event) => (
                  <button
                    key={event.id}
                    className={event.id === activeEvent?.id ? "event-row active" : "event-row"}
                    onClick={() => setActiveEventId(event.id)}
                  >
                    <span className="event-date"><CalendarDays className="h-4 w-4" />{formatShortDate(event)}</span>
                    <span><strong>{event.name}</strong><small>{event.venue.city}, {event.venue.country}</small></span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                ))}
              </div>
              {activeEvent ? (
                <article className="event-detail">
                  <p className="eyebrow">SELECTED STOP</p>
                  <h3>{activeEvent.name}</h3>
                  <p><MapPin className="h-4 w-4" /> {activeEvent.venue.name}, {[activeEvent.venue.city, activeEvent.venue.state, activeEvent.venue.country].filter(Boolean).join(", ")}</p>
                  <p><CalendarDays className="h-4 w-4" /> {formatEventDate(activeEvent)}</p>
                  {activeEvent.url ? <a href={activeEvent.url} target="_blank" rel="noreferrer">View event <ExternalLink className="h-4 w-4" /></a> : null}
                </article>
              ) : null}
            </div>
          )}
          {error ? <p className="error-state">{error instanceof Error ? error.message : "Could not load concert data."}</p> : null}
        </section>
      ) : null}
    </div>
  );
}

function RoadtripGlobe({events, activeEventId, onSelect}: {events: TourEvent[]; activeEventId?: string; onSelect: (eventId: string) => void}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({width: 1200, height: 760});

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(([entry]) => setSize({width: Math.floor(entry.contentRect.width), height: Math.floor(entry.contentRect.height)}));
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const points = useMemo(() => events.map((event) => ({...event, altitude: event.id === activeEventId ? 0.22 : 0.12, color: event.id === activeEventId ? "#f4ff78" : "#62e6c5"})), [activeEventId, events]);

  return (
    <div ref={containerRef} className="globe-canvas">
      <Globe
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
        bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
        backgroundColor="rgba(0,0,0,0)"
        atmosphereColor="#73d8c0"
        atmosphereAltitude={0.16}
        pointsData={points}
        pointAltitude="altitude"
        pointColor="color"
        pointRadius={0.42}
        onPointClick={(point) => onSelect((point as TourEvent).id)}
        width={size.width}
        height={size.height}
      />
    </div>
  );
}

function formatShortDate(event: TourEvent) {
  return event.date ? new Intl.DateTimeFormat(undefined, {month: "short", day: "numeric"}).format(new Date(event.date)) : "TBD";
}

function formatEventDate(event: TourEvent) {
  return event.date ? new Intl.DateTimeFormat(undefined, {dateStyle: "long", timeStyle: event.localTime ? "short" : undefined}).format(new Date(event.date)) : "Date to be announced";
}
