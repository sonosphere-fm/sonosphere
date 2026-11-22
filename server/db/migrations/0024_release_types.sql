CREATE TABLE "album_folds" (
	"artist_id" integer NOT NULL,
	"title_norm" text NOT NULL,
	"album_id" integer NOT NULL,
	CONSTRAINT "album_folds_artist_id_title_norm_pk" PRIMARY KEY("artist_id","title_norm")
);
--> statement-breakpoint
ALTER TABLE "albums" ADD COLUMN "release_type" text;--> statement-breakpoint
ALTER TABLE "album_folds" ADD CONSTRAINT "album_folds_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "album_folds" ADD CONSTRAINT "album_folds_album_id_albums_id_fk" FOREIGN KEY ("album_id") REFERENCES "public"."albums"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "album_folds_album" ON "album_folds" USING btree ("album_id");