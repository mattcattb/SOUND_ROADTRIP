import {SpotifyApi, type AccessToken, type Artist} from "@spotify/web-api-ts-sdk";
import {appEnv} from "../common/env";
import {ServiceException, UpstreamServiceException} from "../common/errors";
import {createMemoryCache, createRedisCache} from "./cache";

const artistSearchCache = appEnv.NODE_ENV === "test"
  ? createMemoryCache({namespace: "spotify:artists"})
  : createRedisCache({namespace: "spotify:artists"});

const mapArtist = (artist: Artist) => ({
  id: artist.id,
  name: artist.name,
  image: artist.images[0]?.url,
  genres: artist.genres.slice(0, 3),
  popularity: artist.popularity,
  spotifyUrl: artist.external_urls.spotify,
});

export const searchSpotifyArtists = async (query: string) => {
  if (!appEnv.SPOTIFY_CLIENT_ID || !appEnv.SPOTIFY_CLIENT_SECRET) {
    throw new ServiceException("Spotify is not configured.");
  }

  return artistSearchCache.getOrSet(query.trim().toLowerCase(), 1000 * 60 * 60 * 6, async () => {
    const spotify = SpotifyApi.withClientCredentials(
      appEnv.SPOTIFY_CLIENT_ID ?? "",
      appEnv.SPOTIFY_CLIENT_SECRET ?? "",
    );
    const result = await spotify.search(query, ["artist"], undefined, 5).catch((error: unknown) => {
      throw new UpstreamServiceException("Spotify search failed.", {
        message: error instanceof Error ? error.message : undefined,
      });
    });
    return result.artists.items.map(mapArtist);
  });
};

export const getSpotifyTopArtists = async (accessToken: string, limit: number) => {
  const token: AccessToken = {
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: 3600,
    refresh_token: "",
  };
  const spotify = SpotifyApi.withAccessToken(appEnv.SPOTIFY_CLIENT_ID ?? "", token);
  const topArtistLimit = limit as Parameters<typeof spotify.currentUser.topItems>[2];

  const topArtists = await spotify.currentUser
    .topItems("artists", "medium_term", topArtistLimit)
    .catch((error: unknown) => {
      throw new UpstreamServiceException("Spotify request failed.", {
        message: error instanceof Error ? error.message : undefined,
      });
    });

  return topArtists.items.map(mapArtist);
};
