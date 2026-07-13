export function ArtistChoices<T extends {id: string; name: string; image?: string; genres?: string[]}>({
  label,
  artists,
  selectedName,
  onSelect,
  layout = "list",
}: {
  label: string;
  artists: T[];
  selectedName?: string;
  onSelect: (artist: T) => void;
  layout?: "list" | "grid";
}) {
  return (
    <div className="artist-choices">
      <p>{label}</p>
      {artists.length ? (
        <div className={`artist-choice-list ${layout === "grid" ? "artist-choice-grid" : ""}`}>
          {artists.map((artist) => (
            <button
              key={artist.id}
              type="button"
              className={artist.name === selectedName ? "artist-choice selected" : "artist-choice"}
              onClick={() => onSelect(artist)}
            >
              {artist.image ? (
                <img src={artist.image} alt="" />
              ) : (
                <span className="artist-choice-fallback" aria-hidden="true">
                  {artist.name.slice(0, 1)}
                </span>
              )}
              <span className="artist-choice-copy">
                <strong>{artist.name}</strong>
                {artist.genres?.length ? <small>{artist.genres.slice(0, 2).join(" · ")}</small> : null}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <span>No matching artists found.</span>
      )}
    </div>
  );
}
