// Types shared by the server and the browser for the player's video lookup.
/** GET /api/video: YouTube video ids for a track, best match first. Empty when nothing was found. */
export type VideoLookup = { videoIds: string[] };
