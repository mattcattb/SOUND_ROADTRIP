import {createFileRoute} from "@tanstack/react-router";
import {useQuery} from "@tanstack/react-query";
import {DetailedError, parseResponse, type InferResponseType} from "hono/client";
import {useEffect, useState} from "react";
import {
  CalendarDays,
  ChevronDown,
  ExternalLink,
  MapPin,
  Search,
  Sparkles,
} from "lucide-react";
import {ArtistChoices} from "../components/artist-choices";
import {RoadtripMap} from "../components/roadtrip-map";
import {TopArtistPicker} from "../components/top-artist-picker";
import {Input} from "../components/ui";
import {signInWithSpotify, useSession} from "../lib/auth";
import {rpcClient} from "../lib/rpc.client";

const artistOptionsApi = rpcClient.tours.artists.search;
const featuredArtistsApi = rpcClient.tours.artists.featured;
const spotifyArtistsApi = rpcClient.tours.artists.spotify;
const eventsApi = rpcClient.tours.events;
type EventResult = InferResponseType<typeof eventsApi.$get, 200>;
type TourEvent = EventResult["events"][number];

const optionalSearchString = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

interface ExploreSearch {
  q?: string;
  artist?: string;
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
  const [debouncedArtist, setDebouncedArtist] = useState("");
  const [spotifyError, setSpotifyError] = useState("");
  const [discoveryOpen, setDiscoveryOpen] = useState(!search.artist);
  const [focusRequest, setFocusRequest] = useState(0);

  const normalizedArtist = artist.trim();
  const artistOptionsQuery = useQuery({
    queryKey: ["artist-options", debouncedArtist.toLowerCase()],
    queryFn: ({signal}) => parseResponse(artistOptionsApi.$get(
      {query: {query: debouncedArtist}},
      {init: {signal}},
    )),
    enabled:
      discoveryOpen &&
      debouncedArtist.length >= 2 &&
      normalizedArtist === debouncedArtist,
    retry: false,
    staleTime: 1000 * 60 * 60 * 6,
    gcTime: 1000 * 60 * 60 * 24,
  });

  const featuredArtistsQuery = useQuery({
    queryKey: ["featured-artists"],
    queryFn: () => parseResponse(featuredArtistsApi.$get()),
    enabled: discoveryOpen && normalizedArtist.length === 0,
    retry: false,
    staleTime: Infinity,
  });

  const spotifyQuery = useQuery({
    queryKey: ["spotify-artists", session?.user.id],
    queryFn: () => parseResponse(spotifyArtistsApi.$get({query: {limit: "20"}})),
    enabled: Boolean(session),
    retry: false,
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60 * 24,
  });

  const eventsQuery = useQuery({
    queryKey: ["artist-events", search.artist],
    queryFn: () => parseResponse(eventsApi.$get({query: {artist: search.artist ?? ""}})),
    enabled: Boolean(search.artist),
    retry: false,
    staleTime: 1000 * 60 * 15,
    gcTime: 1000 * 60 * 60 * 24,
  });
  const spotifyConnected = Boolean(session && spotifyQuery.data);

  const events = eventsQuery.data?.events ?? [];
  const activeEvent = events.find((event) => event.id === search.event) ?? events[0];

  useEffect(() => {
    setArtist(search.q ?? search.artist ?? "");
  }, [search.artist, search.q]);

  useEffect(() => {
    if (normalizedArtist.length < 2) {
      setDebouncedArtist("");
      return;
    }

    const timeout = window.setTimeout(() => setDebouncedArtist(normalizedArtist), 300);
    return () => window.clearTimeout(timeout);
  }, [normalizedArtist]);

  const selectArtist = (name: string) => {
    setDiscoveryOpen(false);
    if (search.artist === name) return;
    setFocusRequest(0);

    navigate({
      search: (previous) => ({
        ...previous,
        q: undefined,
        artist: name,
        event: undefined,
        picker: undefined,
      }),
    });
  };

  const focusEvent = (eventId: string) => {
    setFocusRequest((request) => request + 1);
    navigate({
      search: (previous) => ({...previous, event: eventId}),
    });
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

      <main className="explorer-workspace">
        <section className="map-stage" aria-label="Interactive concert map">
          <RoadtripMap
            events={events}
            activeEventId={activeEvent?.id}
            focusRequest={focusRequest}
            onSelect={focusEvent}
          />
          <div className="map-vignette" />
          {!search.artist ? (
            <div className="map-intro">
              <p className="eyebrow">TOURS, MAPPED</p>
              <h1>Follow the music.</h1>
              <p>Choose an artist from the panel to plot their next stops around the world.</p>
            </div>
          ) : null}
          {eventsQuery.isFetching ? <div className="map-state">Plotting tour dates…</div> : null}
        </section>

        <aside className="concert-rail" aria-label="Artist and concert explorer">
          <button
            type="button"
            className="rail-discovery-toggle"
            aria-expanded={discoveryOpen}
            onClick={() => setDiscoveryOpen((open) => !open)}
          >
            <span className="rail-toggle-icon"><Search className="h-4 w-4" /></span>
            <span className="rail-toggle-copy">
              <small>DISCOVER</small>
              <strong>{search.artist ? "Change artist" : "Find an artist"}</strong>
            </span>
            <ChevronDown className={discoveryOpen ? "h-4 w-4 rotate-180" : "h-4 w-4"} />
          </button>

          {discoveryOpen ? (
            <div className="rail-discovery">
              <div className="rail-search-form" role="search">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  value={artist}
                  onChange={(event) => setArtist(event.target.value)}
                  placeholder="Search an artist..."
                  aria-label="Artist name"
                  className="search-input"
                />
              </div>
              <TopArtistPicker
                artists={spotifyQuery.data?.artists}
                selectedName={search.artist}
                open={search.picker === "spotify"}
                loading={sessionPending || spotifyQuery.isFetching}
                connected={spotifyConnected}
                onToggle={async () => {
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
                onSelect={(option) => selectArtist(option.name)}
              />
              {spotifyError ? <p className="connect-error" role="alert">{spotifyError}</p> : null}
              {normalizedArtist.length >= 2 && normalizedArtist !== debouncedArtist ? (
                <p className="choice-status">Finding artists…</p>
              ) : normalizedArtist.length >= 2 && artistOptionsQuery.isFetching ? (
                <p className="choice-status">Finding artists…</p>
              ) : normalizedArtist.length >= 2 && artistOptionsQuery.error ? (
                <p className="connect-error" role="alert">{getApiErrorMessage(artistOptionsQuery.error)}</p>
              ) : normalizedArtist === debouncedArtist && artistOptionsQuery.data ? (
                <ArtistChoices
                  label="Choose the artist you meant"
                  artists={artistOptionsQuery.data.artists}
                  selectedName={search.artist}
                  onSelect={(option) => selectArtist(option.name)}
                />
              ) : normalizedArtist.length === 1 ? (
                <p className="choice-status">Keep typing to search Spotify…</p>
              ) : normalizedArtist.length === 0 && featuredArtistsQuery.isFetching ? (
                <p className="choice-status">Loading featured artists…</p>
              ) : normalizedArtist.length === 0 && featuredArtistsQuery.error ? (
                <p className="connect-error" role="alert">{getApiErrorMessage(featuredArtistsQuery.error)}</p>
              ) : normalizedArtist.length === 0 && featuredArtistsQuery.data ? (
                <ArtistChoices
                  label="Featured artists"
                  artists={featuredArtistsQuery.data.artists}
                  selectedName={search.artist}
                  onSelect={(option) => selectArtist(option.name)}
                  layout="grid"
                />
              ) : null}
              {spotifyQuery.error ? (
                <p className="connect-error" role="alert">{getApiErrorMessage(spotifyQuery.error)}</p>
              ) : null}
            </div>
          ) : null}

          <section className="rail-tour" aria-live="polite">
            <div className="rail-tour-heading">
              <div>
                <p className="eyebrow">{search.artist ? "UPCOMING TOUR" : "CONCERT EXPLORER"}</p>
                <h2>{search.artist ?? "Your route starts here"}</h2>
              </div>
              {search.artist ? <span className="rail-count">{events.length}</span> : null}
            </div>

            {!search.artist ? (
              <div className="rail-empty">
                <MapPin className="h-5 w-5" />
                <p>Search manually or import your top Spotify artists to map upcoming concerts.</p>
              </div>
            ) : eventsQuery.isFetching ? (
              <div className="rail-empty"><p>Finding upcoming stops…</p></div>
            ) : eventsQuery.error ? (
              <p className="error-state" role="alert">{getApiErrorMessage(eventsQuery.error)}</p>
            ) : events.length === 0 ? (
              <div className="rail-empty"><p>No mapped shows found yet. Try another artist.</p></div>
            ) : (
              <div className="rail-event-list">
                {events.map((event, index) => {
                  const active = event.id === activeEvent?.id;
                  return (
                    <article key={event.id} className={active ? "rail-event active" : "rail-event"}>
                      <button type="button" className="rail-event-main" onClick={() => focusEvent(event.id)}>
                        <span className="rail-stop-number">{String(index + 1).padStart(2, "0")}</span>
                        <span className="rail-event-copy">
                          <small>{formatShortDate(event)} · {event.venue.city ?? event.venue.country ?? event.venue.name}</small>
                          <strong>{event.name}</strong>
                        </span>
                        <MapPin className="h-4 w-4" />
                      </button>
                      {active ? (
                        <div className="rail-event-detail">
                          <p><MapPin className="h-4 w-4" /> {event.venue.name}, {[event.venue.city, event.venue.state, event.venue.country].filter(Boolean).join(", ")}</p>
                          <p><CalendarDays className="h-4 w-4" /> {formatEventDate(event)}</p>
                          {event.url ? <a href={event.url} target="_blank" rel="noreferrer">View event <ExternalLink className="h-4 w-4" /></a> : null}
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </aside>
      </main>
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

function formatShortDate(event: TourEvent) {
  return event.date ? new Intl.DateTimeFormat(undefined, {month: "short", day: "numeric"}).format(new Date(event.date)) : "TBD";
}

function formatEventDate(event: TourEvent) {
  return event.date ? new Intl.DateTimeFormat(undefined, {dateStyle: "long", timeStyle: event.localTime ? "short" : undefined}).format(new Date(event.date)) : "Date to be announced";
}
