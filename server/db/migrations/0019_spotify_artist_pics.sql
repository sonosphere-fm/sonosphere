CREATE TABLE "spotify_artist_pics" (
	"spotify_id" text PRIMARY KEY NOT NULL,
	"name_norm" text NOT NULL,
	"followers" integer NOT NULL,
	"url" text NOT NULL,
	"width" integer,
	"height" integer
);
--> statement-breakpoint
CREATE INDEX "spotify_artist_pics_name" ON "spotify_artist_pics" USING btree ("name_norm","followers");