import {z} from "zod";
import {getSpotifyTopArtists, searchSpotifyArtists} from "../lib/spotify";
import {searchTicketmasterArtistEvents} from "../lib/ticketmaster";

export const tourQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(10).default(5),
});

export const artistSearchSchema = z.object({
  artist: z.string().trim().min(2).max(80),
});

export const artistOptionsSchema = z.object({
  query: z.string().trim().min(2).max(80),
});

export const searchArtistOptions = async (query: string) => ({
  artists: await searchSpotifyArtists(query),
});

export const searchArtistTour = async (artistName: string) => {
  const result = await searchTicketmasterArtistEvents(artistName);

  return {
    provider: {
      concerts: "ticketmaster" as const,
      configured: true,
      status: "ready" as const,
    },
    artist: {name: artistName},
    events: result.events,
  };
};

export const getSpotifyArtists = async (
  accessToken: string,
  {limit}: z.infer<typeof tourQuerySchema>,
) => ({artists: await getSpotifyTopArtists(accessToken, limit)});
