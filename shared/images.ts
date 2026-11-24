export type ImageSaved = { image: string };

export type GalleryKind = "artist" | "album";
export type GalleryVote = -1 | 0 | 1;

export type GalleryImage = {
  id: number;
  image: string;
  score: number;
  up: number;
  down: number;
  mine: GalleryVote;
  main: boolean;
  uploader: string | null;
  uploaderId: number | null;
  createdAt: number;
};

export type GalleryList = { items: GalleryImage[]; main: string | null };
