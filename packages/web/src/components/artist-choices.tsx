export function ArtistChoices<T extends {id: string; name: string}>({
  label,
  artists,
  selectedName,
  onSelect,
}: {
  label: string;
  artists: T[];
  selectedName?: string;
  onSelect: (artist: T) => void;
}) {
  return (
    <div className="artist-choices">
      <p>{label}</p>
      {artists.length ? (
        <div className="artist-choice-list">
          {artists.map((artist) => (
            <button
              key={artist.id}
              type="button"
              className={artist.name === selectedName ? "artist-choice selected" : "artist-choice"}
              onClick={() => onSelect(artist)}
            >
              {artist.name}
            </button>
          ))}
        </div>
      ) : (
        <span>No matching artists found.</span>
      )}
    </div>
  );
}
