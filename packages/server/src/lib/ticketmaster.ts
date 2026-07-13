import {z} from "zod";
import {appEnv} from "../common/env";
import {ServiceException, UpstreamServiceException} from "../common/errors";
import {type Cache, createMemoryCache, createRedisCache} from "./cache";

const ticketmasterEventSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string().optional(),
  dates: z.object({
    start: z.object({
      localDate: z.string().optional(),
      localTime: z.string().optional(),
      dateTime: z.string().optional(),
    }),
  }),
  _embedded: z
    .object({
      attractions: z
        .array(z.object({id: z.string(), name: z.string()}))
        .optional(),
      venues: z
        .array(
          z.object({
            name: z.string(),
            city: z.object({name: z.string().optional()}).optional(),
            state: z.object({stateCode: z.string().optional()}).optional(),
            country: z.object({countryCode: z.string().optional()}).optional(),
            location: z
              .object({
                latitude: z.string(),
                longitude: z.string(),
              })
              .optional(),
          }),
        )
        .optional(),
    })
    .optional(),
});

const ticketmasterResponseSchema = z.object({
  _embedded: z
    .object({
      events: z.array(ticketmasterEventSchema).optional(),
    })
    .optional(),
});

const ticketmasterAttractionResponseSchema = z.object({
  _embedded: z
    .object({
      attractions: z.array(z.object({id: z.string(), name: z.string()})).optional(),
    })
    .optional(),
});

const normalizeArtistName = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

const ticketmasterRequestIntervalMs = appEnv.NODE_ENV === "test" ? 5 : 225;
let ticketmasterRequestQueue = Promise.resolve();
let nextTicketmasterRequestAt = 0;
const createTicketmasterCache = (namespace: string): Cache => appEnv.NODE_ENV === "test"
  ? createMemoryCache({namespace})
  : createRedisCache({namespace});
const artistCache = createTicketmasterCache("ticketmaster:artists");
const eventCache = createTicketmasterCache("ticketmaster:events");

export const clearTicketmasterCache = () => Promise.all([
  artistCache.clear(),
  eventCache.clear(),
]);

const scheduleTicketmasterRequest = <T>(request: () => Promise<T>) => {
  const scheduled = ticketmasterRequestQueue.then(async () => {
    const waitMs = Math.max(0, nextTicketmasterRequestAt - Date.now());
    if (waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
    nextTicketmasterRequestAt = Date.now() + ticketmasterRequestIntervalMs;
    return request();
  });
  ticketmasterRequestQueue = scheduled.then(
    () => undefined,
    () => undefined,
  );
  return scheduled;
};

const fetchTicketmaster = async <T extends z.ZodTypeAny>(
  url: string,
  schema: T,
): Promise<z.infer<T>> => {
  let response: Response;
  try {
    response = await scheduleTicketmasterRequest(() =>
      fetch(url, {signal: AbortSignal.timeout(8_000)}),
    );
  } catch (error) {
    throw new UpstreamServiceException("Ticketmaster could not be reached.", {
      message: error instanceof Error ? error.message : String(error),
    });
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new UpstreamServiceException(
      `Ticketmaster returned ${response.status}.`,
      {
        status: response.status,
        statusText: response.statusText,
        body: body.slice(0, 500),
      },
    );
  }

  try {
    return schema.parse(await response.json());
  } catch (error) {
    throw new UpstreamServiceException(
      "Ticketmaster returned an unexpected response.",
      {
        message: error instanceof Error ? error.message : String(error),
      },
    );
  }
};

const searchTicketmasterArtists = async (query: string) => {
  if (!appEnv.TICKETMASTER_API_KEY) {
    throw new ServiceException("Ticketmaster is not configured.");
  }

  return artistCache.getOrSet(normalizeArtistName(query), 1000 * 60 * 60 * 6, async () => {
    const params = new URLSearchParams({
      apikey: appEnv.TICKETMASTER_API_KEY ?? "",
      keyword: query,
      classificationName: "music",
      size: "5",
    });
    const data = await fetchTicketmaster(
      `https://app.ticketmaster.com/discovery/v2/attractions.json?${params}`,
      ticketmasterAttractionResponseSchema,
    );
    return data._embedded?.attractions ?? [];
  });
};

export const searchTicketmasterArtistEvents = async (
  artistName: string,
  selectedAttractionId?: string,
) => {
  if (!appEnv.TICKETMASTER_API_KEY) {
    throw new ServiceException("Ticketmaster is not configured.");
  }

  const normalizedArtistName = normalizeArtistName(artistName);
  const cacheKey = selectedAttractionId
    ? `id:${selectedAttractionId}`
    : `name:${normalizedArtistName}`;

  return eventCache.getOrSet(cacheKey, 1000 * 60 * 15, async () => {
    const attractionId = selectedAttractionId ?? (await searchTicketmasterArtists(artistName))
      .find(
        (attraction) => normalizeArtistName(attraction.name) === normalizedArtistName,
      )?.id;

    const params = new URLSearchParams({
      apikey: appEnv.TICKETMASTER_API_KEY ?? "",
      classificationName: "music",
      sort: "date,asc",
      size: "20",
    });
    params.set(attractionId ? "attractionId" : "keyword", attractionId ?? artistName);

    const data = await fetchTicketmaster(
      `https://app.ticketmaster.com/discovery/v2/events.json?${params}`,
      ticketmasterResponseSchema,
    );

    const events = (data._embedded?.events ?? []).flatMap((event) => {
      if (
        !attractionId &&
        !event._embedded?.attractions?.some(
          (attraction) =>
            normalizeArtistName(attraction.name) === normalizedArtistName,
        )
      ) {
        return [];
      }

      const venue = event._embedded?.venues?.[0];
      const latitude = Number(venue?.location?.latitude);
      const longitude = Number(venue?.location?.longitude);

      if (!venue || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        throw new UpstreamServiceException(
          "Ticketmaster returned an event without venue coordinates.",
          {eventId: event.id},
        );
      }

      return {
        id: event.id,
        artistName,
        name: event.name,
        url: event.url,
        date: event.dates.start.dateTime ?? event.dates.start.localDate,
        localDate: event.dates.start.localDate,
        localTime: event.dates.start.localTime,
        venue: {
          name: venue.name,
          city: venue.city?.name,
          state: venue.state?.stateCode,
          country: venue.country?.countryCode,
          latitude,
          longitude,
        },
      };
    });

    return {events};
  });
};
