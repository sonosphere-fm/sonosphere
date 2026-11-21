/** Catalogue lookups through listeners' Spotify apps stay off unless SPOTIFY_API=1; importing plays is always on. */
export const spotifyCatalogue = () => process.env.SPOTIFY_API === "1";
