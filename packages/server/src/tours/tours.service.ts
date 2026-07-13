import {SpotifyApi, type AccessToken} from "@spotify/web-api-ts-sdk";
import {z} from "zod";
import {appEnv} from "../common/env";
import {ServiceException} from "../common/errors";
import type {ConcertProvider} from "../lib/concert-provider";
import {ticketmasterConcertProvider} from "../lib/ticketmaster";

const concertProvider: ConcertProvider = ticketmasterConcertProvider;

export const tourQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(10).default(5),
});

export const artistSearchSchema = z.object({
  artist: z.string().trim().min(2).max(80),
});

export const searchArtistTour = async (artistName: string) => {
  const result = await concertProvider.searchArtistEvents(artistName);

  return {
    provider: {
      concerts: concertProvider.id,
      configured: concertProvider.isConfigured(),
      status: !concertProvider.isConfigured()
        ? "not_configured" as const
        : result.error
          ? "degraded" as const
          : "ready" as const,
      message: result.error,
    },
    artist: {name: artistName},
    events: result.events,
  };
};

const getSpotifyClient = (accessToken: string) => {
  const token: AccessToken = {
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: 3600,
    refresh_token: "",
  };

  return SpotifyApi.withAccessToken(
    appEnv.SPOTIFY_CLIENT_ID ?? "",
    token,
  );
};

export const getRoadtrip = async (
  accessToken: string,
  {limit}: z.infer<typeof tourQuerySchema>,
) => {
  const spotify = getSpotifyClient(accessToken);
  const topArtistLimit =
    limit as Parameters<typeof spotify.currentUser.topItems>[2];

  const topArtists = await spotify.currentUser
    .topItems("artists", "medium_term", topArtistLimit)
    .catch((err: unknown) => {
      throw new ServiceException("Spotify request failed.", {
        message: err instanceof Error ? err.message : undefined,
      });
    });
  const artists = topArtists.items.map((artist) => ({
    id: artist.id,
    name: artist.name,
    image: artist.images[0]?.url,
    genres: artist.genres.slice(0, 3),
    popularity: artist.popularity,
    spotifyUrl: artist.external_urls.spotify,
  }));

  const searches = await Promise.all(
    artists.map((artist) => concertProvider.searchArtistEvents(artist.name)),
  );
  const eventIds = new Set<string>();
  const events = searches
    .flatMap((search) => search.events)
    .filter((event) => {
      if (eventIds.has(event.id)) return false;
      eventIds.add(event.id);
      return true;
    })
    .sort((a, b) => {
      if (!a.date) return 1;
      if (!b.date) return -1;
      return a.date.localeCompare(b.date);
    });
  const providerError = searches.find((search) => search.error)?.error;

  return {
    provider: {
      concerts: concertProvider.id,
      configured: concertProvider.isConfigured(),
      status: !concertProvider.isConfigured()
        ? "not_configured"
        : providerError
          ? "degraded"
          : "ready",
      message: providerError,
    },
    artists,
    events,
  };
};
