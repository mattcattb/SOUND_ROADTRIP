import {ChevronDown, Headphones} from "lucide-react";

export function TopArtistPicker<T extends {id: string; name: string; image?: string}>({
  artists,
  selectedName,
  open,
  loading,
  connected,
  onToggle,
  onSelect,
}: {
  artists?: T[];
  selectedName?: string;
  open: boolean;
  loading: boolean;
  connected: boolean;
  onToggle: () => void;
  onSelect: (artist: T) => void;
}) {
  return (
    <div className={open ? "top-artist-picker open" : "top-artist-picker"}>
      <button
        type="button"
        className="top-artist-disclosure"
        aria-expanded={open}
        onClick={onToggle}
        disabled={loading}
      >
        <span className="top-artist-icon"><Headphones className="h-4 w-4" /></span>
        <span>
          <strong>{connected ? "Your top artists" : "Connect Spotify"}</strong>
          <small>
            {loading
              ? "Loading your listening history…"
              : connected
                ? `${artists?.length ?? 0} artists ranked by Spotify`
                : "Browse artists you already listen to"}
          </small>
        </span>
        <ChevronDown className={open ? "h-4 w-4 rotate-180" : "h-4 w-4"} />
      </button>

      {open && connected ? (
        artists?.length ? (
          <div className="top-artist-grid" aria-label="Your top Spotify artists">
            {artists.map((artist, index) => (
              <button
                key={artist.id}
                type="button"
                className={artist.name === selectedName ? "top-artist selected" : "top-artist"}
                onClick={() => onSelect(artist)}
              >
                <span className="top-artist-rank">{String(index + 1).padStart(2, "0")}</span>
                {artist.image ? (
                  <img src={artist.image} alt="" />
                ) : (
                  <span className="top-artist-fallback" aria-hidden="true">{artist.name.slice(0, 1)}</span>
                )}
                <strong>{artist.name}</strong>
              </button>
            ))}
          </div>
        ) : (
          <p className="choice-status">Spotify did not return any top artists yet.</p>
        )
      ) : null}
    </div>
  );
}
