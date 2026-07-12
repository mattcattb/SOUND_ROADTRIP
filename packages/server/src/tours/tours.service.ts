import {SpotifyApi, type AccessToken} from "@spotify/web-api-ts-sdk";
import {and, eq} from "drizzle-orm";
import {z} from "zod";
import {appEnv} from "../common/env";
import {ServiceException, UnauthorizedException} from "../common/errors";
import {db} from "../db";
import {account} from "../db/schema";
import type {ConcertProvider} from "../lib/concert-provider";
import {ticketmasterConcertProvider} from "../lib/ticketmaster";

const concertProvider: ConcertProvider = ticketmasterConcertProvider;

export const tourQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(10).default(5),
});

const getSpotifyAccount = async (userId: string) => {
  const [spotifyAccount] = await db
    .select()
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, "spotify")))
    .limit(1);

  return spotifyAccount;
};

const getSpotifyClient = async (userId: string) => {
  const spotifyAccount = await getSpotifyAccount(userId);

  if (!spotifyAccount?.accessToken) {
    throw new UnauthorizedException("Connect Spotify to build a tour map.");
  }

  const expiresIn = spotifyAccount.accessTokenExpiresAt
    ? Math.max(
        1,
        Math.floor((spotifyAccount.accessTokenExpiresAt.getTime() - Date.now()) / 1000),
      )
    : 3600;

  const accessToken: AccessToken = {
    access_token: spotifyAccount.accessToken,
    token_type: "Bearer",
    expires_in: expiresIn,
    refresh_token: spotifyAccount.refreshToken ?? "",
    expires: spotifyAccount.accessTokenExpiresAt?.getTime(),
  };

  return {
    spotify: SpotifyApi.withAccessToken(appEnv.SPOTIFY_CLIENT_ID ?? "", accessToken),
    spotifyAccount,
  };
};

const persistSpotifyToken = async (
  spotifyAccount: typeof account.$inferSelect,
  token: AccessToken | null,
) => {
  if (!token || token.access_token === spotifyAccount.accessToken) {
    return;
  }

  await db
    .update(account)
    .set({
      accessToken: token.access_token,
      refreshToken: token.refresh_token || spotifyAccount.refreshToken,
      accessTokenExpiresAt: token.expires ? new Date(token.expires) : null,
      updatedAt: new Date(),
    })
    .where(eq(account.id, spotifyAccount.id));
};

export const getRoadtrip = async (
  userId: string,
  {limit}: z.infer<typeof tourQuerySchema>,
) => {
  const {spotify, spotifyAccount} = await getSpotifyClient(userId);
  const topArtistLimit =
    limit as Parameters<typeof spotify.currentUser.topItems>[2];

  const topArtists = await spotify.currentUser
    .topItems("artists", "medium_term", topArtistLimit)
    .catch((err: unknown) => {
      throw new ServiceException("Spotify request failed.", {
        message: err instanceof Error ? err.message : undefined,
      });
    });
  await persistSpotifyToken(spotifyAccount, await spotify.getAccessToken());

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
