import {z} from "zod";
import {appEnv} from "../common/env";
import type {ConcertProvider} from "./concert-provider";

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

const isTicketmasterConfigured = () => Boolean(appEnv.TICKETMASTER_API_KEY);

const searchTicketmasterArtistEvents: ConcertProvider["searchArtistEvents"] = async (
  artistName,
) => {
  if (!appEnv.TICKETMASTER_API_KEY) {
    return {events: []};
  }

  const params = new URLSearchParams({
    apikey: appEnv.TICKETMASTER_API_KEY,
    keyword: artistName,
    classificationName: "music",
    sort: "date,asc",
    size: "20",
  });

  let response: Response;
  try {
    response = await fetch(
      `https://app.ticketmaster.com/discovery/v2/events.json?${params}`,
      {signal: AbortSignal.timeout(8_000)},
    );
  } catch {
    return {events: [], error: "Ticketmaster could not be reached."};
  }

  if (!response.ok) {
    return {
      events: [],
      error: `Ticketmaster returned ${response.status}.`,
    };
  }

  let data: z.infer<typeof ticketmasterResponseSchema>;
  try {
    data = ticketmasterResponseSchema.parse(await response.json());
  } catch {
    return {events: [], error: "Ticketmaster returned an unexpected response."};
  }

  const events = (data._embedded?.events ?? []).flatMap((event) => {
    const venue = event._embedded?.venues?.[0];
    const latitude = Number(venue?.location?.latitude);
    const longitude = Number(venue?.location?.longitude);

    if (!venue || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return [];
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
};

export const ticketmasterConcertProvider: ConcertProvider = {
  id: "ticketmaster",
  isConfigured: isTicketmasterConfigured,
  searchArtistEvents: searchTicketmasterArtistEvents,
};
