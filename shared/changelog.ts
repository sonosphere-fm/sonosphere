export type ChangelogEntry = {
  hash: string;
  subject: string;
  committedAt: string;
  author: string;
  additions: number;
  deletions: number;
};

export type Changelog = {
  items: ChangelogPost[];
  total: number;
  limit: number;
};

export type ChangelogPost = {
  id: number;
  title: string;
  body: string;
  author: string;
  editor: string;
  createdAt: number;
  updatedAt: number;
};

export type ChangelogText = { title: string; body: string };
export type ChangelogSaved = { id: number };
export type ChangelogCommits = { items: ChangelogEntry[] };
export type ChangelogDeleted = { ok: true };
