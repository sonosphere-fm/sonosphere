export type MusicMatch = { id: string; albumId: string | null };

export const loose = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s*[([].*?[)\]]\s*/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

export const score = (want: string, got: string) => {
  if (!want || !got) return 0;
  if (want === got) return 2;
  return got.includes(want) || want.includes(got) ? 1 : 0;
};

/** The best few candidates for an artist and title, so playback can fall through ones the server won't stream. */
export function pickMatches(
  candidates: { id: string; title: string; artist: string; albumId: string | null }[],
  artist: string,
  track: string
): MusicMatch[] {
  const wantArtist = loose(artist);
  const wantTitle = loose(track);
  const found = candidates
    .map((song, index) => ({
      ...song,
      index,
      score: score(wantArtist, loose(song.artist)) + score(wantTitle, loose(song.title)),
    }))
    .filter((song) => song.score >= 2);
  found.sort((a, b) => b.score - a.score || a.index - b.index);
  const picked: MusicMatch[] = [];
  const seen = new Set<string>();
  for (const song of found) {
    if (seen.has(song.id)) continue;
    seen.add(song.id);
    picked.push({ id: song.id, albumId: song.albumId });
    if (picked.length === 3) break;
  }
  return picked;
}
