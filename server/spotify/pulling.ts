/** Reading plays and catalogue data from Spotify stays off unless SPOTIFY_API=1. */
export const spotifyPulling = () => process.env.SPOTIFY_API === "1";
