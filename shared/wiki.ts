export type WikiVersion = { content: string; version: number; createdAt: number; author: string | null };

export type WikiRevision = { id: number; version: number; content: string; createdAt: number; author: string | null };
export type WikiHistory = { versions: WikiRevision[]; locked: boolean };
export type WikiSaved = { wiki: WikiVersion | null };
