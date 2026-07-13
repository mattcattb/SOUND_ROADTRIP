import {SpotifyApi, type AccessToken} from "@spotify/web-api-ts-sdk";
import {z} from "zod";
import {appEnv} from "../common/env";
import {UpstreamServiceException} from "../common/errors";
import type {ConcertProvider} from "../lib/concert-provider";
import {ticketmasterConcertProvider} from "../lib/ticketmaster";

const concertProvider: ConcertProvider = ticketmasterConcertProvider;

export const tourQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(10).default(5),
});

export const artistSearchSchema = z.object({
  artist: z.string().trim().min(2).max(80),
  artistId: z.string().trim().min(1).max(80).optional(),
});

export const artistOptionsSchema = z.object({
  query: z.string().trim().min(2).max(80),
});

export const searchArtistOptions = async (query: string) => ({
  artists: await concertProvider.searchArtists(query),
});

export const searchArtistTour = async (artistName: string, artistId?: string) => {
  const result = await concertProvider.searchArtistEvents(artistName, artistId);

  return {
    provider: {
      concerts: concertProvider.id,
      configured: true,
      status: "ready" as const,
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

export const getSpotifyArtists = async (
  accessToken: string,
  {limit}: z.infer<typeof tourQuerySchema>,
) => {
  const spotify = getSpotifyClient(accessToken);
  const topArtistLimit =
    limit as Parameters<typeof spotify.currentUser.topItems>[2];

  const topArtists = await spotify.currentUser
    .topItems("artists", "medium_term", topArtistLimit)
    .catch((err: unknown) => {
      throw new UpstreamServiceException("Spotify request failed.", {
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

  return {artists};
};
