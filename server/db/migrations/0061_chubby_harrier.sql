ALTER TABLE "artists" ADD COLUMN "disambig" text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX "artists_mbid" ON "artists" USING btree ("mbid");