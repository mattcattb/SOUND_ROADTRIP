export interface ConcertEvent {
  id: string;
  artistName: string;
  name: string;
  url?: string;
  date?: string;
  localDate?: string;
  localTime?: string;
  venue: {
    name: string;
    city?: string;
    state?: string;
    country?: string;
    latitude: number;
    longitude: number;
  };
}

export interface ConcertSearchResult {
  events: ConcertEvent[];
  error?: string;
}

export interface ConcertProvider {
  id: string;
  isConfigured: () => boolean;
  searchArtistEvents: (artistName: string) => Promise<ConcertSearchResult>;
}
