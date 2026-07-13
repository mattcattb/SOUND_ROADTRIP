import {createFileRoute} from "@tanstack/react-router";
import {useQuery} from "@tanstack/react-query";
import {DetailedError, parseResponse, type InferResponseType} from "hono/client";
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

const artistOptionsApi = rpcClient.tours.artists.search;
const spotifyArtistsApi = rpcClient.tours.artists.spotify;
const eventsApi = rpcClient.tours.events;
type ArtistOptions = InferResponseType<typeof artistOptionsApi.$get, 200>;
type SpotifyArtists = InferResponseType<typeof spotifyArtistsApi.$get, 200>;
type EventResult = InferResponseType<typeof eventsApi.$get, 200>;
type ArtistChoice =
  | ArtistOptions["artists"][number]
  | SpotifyArtists["artists"][number];
type TourEvent = EventResult["events"][number];

export const Route = createFileRoute("/")({component: ExplorePage});

function ExplorePage() {
  const {data: session, isPending: sessionPending} = useSession();
  const [artist, setArtist] = useState("");
  const [artistLookup, setArtistLookup] = useState("");
  const [selectedArtist, setSelectedArtist] = useState<{
    name: string;
    ticketmasterId?: string;
  }>();
  const [activeEventId, setActiveEventId] = useState<string>();
  const [spotifyError, setSpotifyError] = useState("");
  const resultsRef = useRef<HTMLElement>(null);

  const artistOptionsQuery = useQuery({
    queryKey: ["artist-options", artistLookup],
    queryFn: () => parseResponse(artistOptionsApi.$get({query: {query: artistLookup}})),
    enabled: artistLookup.length >= 2,
    retry: false,
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60 * 24,
  });

  const spotifyQuery = useQuery({
    queryKey: ["spotify-artists", session?.user.id],
    queryFn: () => parseResponse(spotifyArtistsApi.$get({query: {limit: "5"}})),
    enabled: Boolean(session),
    retry: false,
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60 * 24,
  });

  const eventsQuery = useQuery({
    queryKey: ["artist-events", selectedArtist],
    queryFn: () => parseResponse(eventsApi.$get({
      query: selectedArtist?.ticketmasterId
        ? {artist: selectedArtist.name, artistId: selectedArtist.ticketmasterId}
        : {artist: selectedArtist?.name ?? ""},
    })),
    enabled: Boolean(selectedArtist),
    retry: false,
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60 * 24,
  });
  const spotifyConnected = Boolean(session && spotifyQuery.data);

  const events = eventsQuery.data?.events ?? [];
  const activeEvent = events.find((event) => event.id === activeEventId) ?? events[0];

  useEffect(() => {
    if (events.length && !events.some((event) => event.id === activeEventId)) {
      setActiveEventId(events[0].id);
    }
  }, [activeEventId, events]);

  useEffect(() => {
    if (
      selectedArtist &&
      !eventsQuery.isFetching &&
      (eventsQuery.data || eventsQuery.error)
    ) {
      resultsRef.current?.scrollIntoView({behavior: "smooth", block: "start"});
    }
  }, [eventsQuery.data, eventsQuery.error, eventsQuery.isFetching, selectedArtist]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const value = artist.trim();
    if (value.length >= 2) {
      setArtistLookup(value);
      setSelectedArtist(undefined);
      setActiveEventId(undefined);
    }
  };

  const selectArtist = (name: string, ticketmasterId?: string) => {
    setSelectedArtist({name, ticketmasterId});
    setArtist(name);
    setActiveEventId(undefined);
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
        <div className="command-panel">
          <div className="command-heading">
            <p className="eyebrow">EXPLORE LIVE MUSIC</p>
            <h1>Who do you want to see?</h1>
            <p>Search an artist to map their upcoming shows.</p>
          </div>
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
              Find artist <ArrowRight className="h-4 w-4" />
            </Button>
          </form>
          <div className="or-divider"><span>OR</span></div>
          <Button
            className="spotify-button"
            onClick={async () => {
              setSpotifyError("");
              try {
                await signInWithSpotify();
              } catch (error) {
                setSpotifyError(error instanceof Error ? error.message : "Spotify could not be connected.");
              }
            }}
            disabled={sessionPending || spotifyQuery.isFetching || spotifyConnected}
          >
            <Headphones className="h-4 w-4" />
            {sessionPending || spotifyQuery.isFetching
              ? "Loading Spotify…"
              : spotifyConnected
                ? "Spotify connected"
                : session
                  ? "Reconnect Spotify"
                  : "Import my Spotify"}
          </Button>
          <p className="privacy-note">Read-only access · your listening data stays yours</p>
          {spotifyError ? <p className="connect-error" role="alert">{spotifyError}</p> : null}
          {artistOptionsQuery.isFetching ? (
            <p className="choice-status">Finding artists…</p>
          ) : artistOptionsQuery.error ? (
            <p className="connect-error" role="alert">{getApiErrorMessage(artistOptionsQuery.error)}</p>
          ) : artistLookup && artistOptionsQuery.data ? (
            <ArtistChoices
              label="Choose the artist you meant"
              artists={artistOptionsQuery.data.artists}
              selectedName={selectedArtist?.name}
              onSelect={(option) => selectArtist(option.name, option.id)}
            />
          ) : null}
          {spotifyQuery.error ? (
            <p className="connect-error" role="alert">{getApiErrorMessage(spotifyQuery.error)}</p>
          ) : spotifyQuery.data ? (
            <ArtistChoices
              label="Choose from your top artists"
              artists={spotifyQuery.data.artists}
              selectedName={selectedArtist?.name}
              onSelect={(option) => selectArtist(option.name)}
            />
          ) : null}
        </div>

        {eventsQuery.isFetching ? <div className="map-state">Plotting tour dates…</div> : null}
      </section>

      {selectedArtist && !eventsQuery.isFetching ? (
        <section ref={resultsRef} className="results-drawer" aria-live="polite">
          <div className="results-heading">
            <div>
              <p className="eyebrow">SELECTED ARTIST</p>
              <h2>{selectedArtist.name}</h2>
            </div>
            <div className="result-count"><strong>{events.length}</strong> upcoming shows</div>
          </div>

          {eventsQuery.error ? (
            <p className="error-state" role="alert">{getApiErrorMessage(eventsQuery.error)}</p>
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
        </section>
      ) : null}
    </div>
  );
}

function ArtistChoices({
  label,
  artists,
  selectedName,
  onSelect,
}: {
  label: string;
  artists: ArtistChoice[];
  selectedName?: string;
  onSelect: (artist: ArtistChoice) => void;
}) {
  return (
    <div className="artist-choices">
      <p>{label}</p>
      {artists.length ? (
        <div className="artist-choice-list">
          {artists.map((artist) => (
            <button
              key={artist.id}
              type="button"
              className={artist.name === selectedName ? "artist-choice selected" : "artist-choice"}
              onClick={() => onSelect(artist)}
            >
              {artist.name}
            </button>
          ))}
        </div>
      ) : (
        <span>No matching artists found.</span>
      )}
    </div>
  );
}

function getApiErrorMessage(error: unknown) {
  if (error instanceof DetailedError) {
    const data = error.detail?.data;
    if (
      typeof data === "object" &&
      data !== null &&
      "error" in data &&
      typeof data.error === "object" &&
      data.error !== null &&
      "message" in data.error &&
      typeof data.error.message === "string"
    ) {
      return data.error.message;
    }
  }

  return error instanceof Error ? error.message : "Could not load concert data.";
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
