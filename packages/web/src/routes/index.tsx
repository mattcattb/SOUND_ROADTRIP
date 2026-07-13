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
  X,
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

const optionalSearchString = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

interface ExploreSearch {
  q?: string;
  artist?: string;
  artistId?: string;
  event?: string;
  picker?: "spotify";
}

export const Route = createFileRoute("/")({
  validateSearch: (rawSearch: Record<string, unknown>): ExploreSearch => {
    const artist = optionalSearchString(rawSearch.artist);
    const query = optionalSearchString(rawSearch.q);
    return {
      q: query && query.length >= 2 ? query : undefined,
      artist,
      artistId: artist ? optionalSearchString(rawSearch.artistId) : undefined,
      event: artist ? optionalSearchString(rawSearch.event) : undefined,
      picker: rawSearch.picker === "spotify" ? "spotify" as const : undefined,
    };
  },
  component: ExplorePage,
});

function ExplorePage() {
  const {data: session, isPending: sessionPending} = useSession();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [artist, setArtist] = useState("");
  const [spotifyError, setSpotifyError] = useState("");
  const resultsRef = useRef<HTMLElement>(null);

  const artistOptionsQuery = useQuery({
    queryKey: ["artist-options", search.q],
    queryFn: () => parseResponse(artistOptionsApi.$get({query: {query: search.q ?? ""}})),
    enabled: Boolean(search.q),
    retry: false,
    staleTime: 1000 * 60 * 60 * 6,
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
    queryKey: ["artist-events", search.artist, search.artistId],
    queryFn: () => parseResponse(eventsApi.$get({
      query: search.artistId
        ? {artist: search.artist ?? "", artistId: search.artistId}
        : {artist: search.artist ?? ""},
    })),
    enabled: Boolean(search.artist),
    retry: false,
    staleTime: 1000 * 60 * 15,
    gcTime: 1000 * 60 * 60 * 24,
  });
  const spotifyConnected = Boolean(session && spotifyQuery.data);

  const events = eventsQuery.data?.events ?? [];
  const activeEvent = events.find((event) => event.id === search.event) ?? events[0];
  const modalEvent = search.event
    ? events.find((event) => event.id === search.event)
    : undefined;

  useEffect(() => {
    setArtist(search.q ?? search.artist ?? "");
  }, [search.artist, search.q]);

  useEffect(() => {
    if (
      search.artist &&
      !eventsQuery.isFetching &&
      (eventsQuery.data || eventsQuery.error)
    ) {
      resultsRef.current?.scrollIntoView({behavior: "smooth", block: "start"});
    }
  }, [eventsQuery.data, eventsQuery.error, eventsQuery.isFetching, search.artist]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const value = artist.trim();
    if (value.length >= 2) {
      navigate({
        search: (previous) => ({
          ...previous,
          q: value,
          artist: undefined,
          artistId: undefined,
          event: undefined,
        }),
      });
    }
  };

  const selectArtist = (name: string, ticketmasterId?: string) => {
    if (search.artist === name && search.artistId === ticketmasterId) {
      resultsRef.current?.scrollIntoView({behavior: "smooth", block: "start"});
      return;
    }

    navigate({
      search: (previous) => ({
        ...previous,
        q: undefined,
        artist: name,
        artistId: ticketmasterId,
        event: undefined,
        picker: undefined,
      }),
    });
  };

  const closeEvent = () => navigate({
    replace: true,
    search: (previous) => ({...previous, event: undefined}),
  });

  useEffect(() => {
    if (!search.event) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeEvent();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [search.event]);

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
          onSelect={(eventId) => navigate({
            search: (previous) => ({...previous, event: eventId}),
          })}
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
              if (spotifyConnected) {
                navigate({
                  search: (previous) => ({
                    ...previous,
                    picker: previous.picker === "spotify" ? undefined : "spotify",
                  }),
                });
                return;
              }
              try {
                await signInWithSpotify(`${window.location.origin}/?picker=spotify`);
              } catch (error) {
                setSpotifyError(error instanceof Error ? error.message : "Spotify could not be connected.");
              }
            }}
            disabled={sessionPending || spotifyQuery.isFetching}
          >
            <Headphones className="h-4 w-4" />
            {sessionPending || spotifyQuery.isFetching
              ? "Loading Spotify…"
              : spotifyConnected
                ? search.picker === "spotify"
                  ? "Hide Spotify artists"
                  : "Choose Spotify artist"
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
          ) : search.q && artistOptionsQuery.data ? (
            <ArtistChoices
              label="Choose the artist you meant"
              artists={artistOptionsQuery.data.artists}
              selectedName={search.artist}
              onSelect={(option) => selectArtist(option.name, option.id)}
            />
          ) : null}
          {spotifyQuery.error ? (
            <p className="connect-error" role="alert">{getApiErrorMessage(spotifyQuery.error)}</p>
          ) : search.picker === "spotify" && spotifyQuery.data ? (
            <ArtistChoices
              label="Choose from your top artists"
              artists={spotifyQuery.data.artists}
              selectedName={search.artist}
              onSelect={(option) => selectArtist(option.name)}
            />
          ) : null}
        </div>

        {eventsQuery.isFetching ? <div className="map-state">Plotting tour dates…</div> : null}
      </section>

      {search.artist && !eventsQuery.isFetching ? (
        <section ref={resultsRef} className="results-drawer" aria-live="polite">
          <div className="results-heading">
            <div>
              <p className="eyebrow">SELECTED ARTIST</p>
              <h2>{search.artist}</h2>
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
                    onClick={() => navigate({
                      search: (previous) => ({...previous, event: event.id}),
                    })}
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

      {search.event && !eventsQuery.isFetching ? (
        <div
          className="event-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeEvent();
          }}
        >
          <section
            className="event-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="event-modal-title"
          >
            <button className="event-modal-close" onClick={closeEvent} aria-label="Close event">
              <X className="h-5 w-5" />
            </button>
            {modalEvent ? (
              <>
                <p className="eyebrow">SELECTED STOP</p>
                <h2 id="event-modal-title">{modalEvent.name}</h2>
                <p><MapPin className="h-4 w-4" /> {modalEvent.venue.name}, {[modalEvent.venue.city, modalEvent.venue.state, modalEvent.venue.country].filter(Boolean).join(", ")}</p>
                <p><CalendarDays className="h-4 w-4" /> {formatEventDate(modalEvent)}</p>
                {modalEvent.url ? <a href={modalEvent.url} target="_blank" rel="noreferrer">View event <ExternalLink className="h-4 w-4" /></a> : null}
              </>
            ) : (
              <>
                <p className="eyebrow">EVENT UNAVAILABLE</p>
                <h2 id="event-modal-title">This event is not in the current results.</h2>
              </>
            )}
          </section>
        </div>
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
