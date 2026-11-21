// Types shared by the server and the browser for uploaded pictures.
/** POST /api/image: the id of the stored picture, served at /api/image/<id>. */
export type ImageSaved = { image: string };
