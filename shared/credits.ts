export type ArtistCredit = {
  mbid: string;
  name: string;
  role: string;
  attributes: string[];
  begin: string;
  end: string;
  ended: boolean;
};
export type Credits = { items: ArtistCredit[]; source: string | null };
