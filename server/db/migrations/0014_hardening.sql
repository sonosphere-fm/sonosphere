-- sign-in tokens and API session keys are kept as their SHA-256 from now on; existing ones are hashed in place, so nobody is signed out
UPDATE "sessions" SET "token" = encode(sha256(convert_to("token", 'UTF8')), 'hex');--> statement-breakpoint
UPDATE "api_tokens" SET "token" = encode(sha256(convert_to("token", 'UTF8')), 'hex');--> statement-breakpoint
UPDATE "api_sessions" SET "key" = encode(sha256(convert_to("key", 'UTF8')), 'hex');--> statement-breakpoint
ALTER TABLE "api_sessions" ADD COLUMN "last_used_at" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE "api_sessions" SET "last_used_at" = "created_at";--> statement-breakpoint
ALTER TABLE "scrobbles" ADD COLUMN "sent_artist" text;--> statement-breakpoint
ALTER TABLE "scrobbles" ADD COLUMN "sent_track" text;--> statement-breakpoint
ALTER TABLE "scrobbles" ADD COLUMN "sent_album" text;--> statement-breakpoint
ALTER TABLE "shouts" ADD COLUMN "artist_ref" integer GENERATED ALWAYS AS (CASE WHEN target_type = 'artist' THEN target_id END) STORED;--> statement-breakpoint
ALTER TABLE "shouts" ADD COLUMN "album_ref" integer GENERATED ALWAYS AS (CASE WHEN target_type = 'album' THEN target_id END) STORED;--> statement-breakpoint
ALTER TABLE "shouts" ADD COLUMN "track_ref" integer GENERATED ALWAYS AS (CASE WHEN target_type = 'track' THEN target_id END) STORED;--> statement-breakpoint
ALTER TABLE "shouts" ADD COLUMN "tag_ref" integer GENERATED ALWAYS AS (CASE WHEN target_type = 'tag' THEN target_id END) STORED;--> statement-breakpoint
ALTER TABLE "shouts" ADD COLUMN "user_ref" integer GENERATED ALWAYS AS (CASE WHEN target_type = 'user' THEN target_id END) STORED;--> statement-breakpoint
ALTER TABLE "shouts" ADD COLUMN "event_ref" integer GENERATED ALWAYS AS (CASE WHEN target_type = 'event' THEN target_id END) STORED;--> statement-breakpoint
ALTER TABLE "shouts" ADD COLUMN "journal_ref" integer GENERATED ALWAYS AS (CASE WHEN target_type = 'journal' THEN target_id END) STORED;--> statement-breakpoint
ALTER TABLE "taggings" ADD COLUMN "artist_ref" integer GENERATED ALWAYS AS (CASE WHEN item_type = 'artist' THEN item_id END) STORED;--> statement-breakpoint
ALTER TABLE "taggings" ADD COLUMN "album_ref" integer GENERATED ALWAYS AS (CASE WHEN item_type = 'album' THEN item_id END) STORED;--> statement-breakpoint
ALTER TABLE "taggings" ADD COLUMN "track_ref" integer GENERATED ALWAYS AS (CASE WHEN item_type = 'track' THEN item_id END) STORED;--> statement-breakpoint
ALTER TABLE "wiki_locks" ADD COLUMN "artist_ref" integer GENERATED ALWAYS AS (CASE WHEN item_type = 'artist' THEN item_id END) STORED;--> statement-breakpoint
ALTER TABLE "wiki_locks" ADD COLUMN "album_ref" integer GENERATED ALWAYS AS (CASE WHEN item_type = 'album' THEN item_id END) STORED;--> statement-breakpoint
ALTER TABLE "wiki_locks" ADD COLUMN "track_ref" integer GENERATED ALWAYS AS (CASE WHEN item_type = 'track' THEN item_id END) STORED;--> statement-breakpoint
ALTER TABLE "wiki_locks" ADD COLUMN "tag_ref" integer GENERATED ALWAYS AS (CASE WHEN item_type = 'tag' THEN item_id END) STORED;--> statement-breakpoint
ALTER TABLE "wikis" ADD COLUMN "artist_ref" integer GENERATED ALWAYS AS (CASE WHEN item_type = 'artist' THEN item_id END) STORED;--> statement-breakpoint
ALTER TABLE "wikis" ADD COLUMN "album_ref" integer GENERATED ALWAYS AS (CASE WHEN item_type = 'album' THEN item_id END) STORED;--> statement-breakpoint
ALTER TABLE "wikis" ADD COLUMN "track_ref" integer GENERATED ALWAYS AS (CASE WHEN item_type = 'track' THEN item_id END) STORED;--> statement-breakpoint
ALTER TABLE "wikis" ADD COLUMN "tag_ref" integer GENERATED ALWAYS AS (CASE WHEN item_type = 'tag' THEN item_id END) STORED;--> statement-breakpoint
-- rows attached to something that no longer exists go before the foreign keys arrive
DELETE FROM "shouts" WHERE ("artist_ref" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "artists" WHERE "id" = "artist_ref")) OR ("album_ref" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "albums" WHERE "id" = "album_ref")) OR ("track_ref" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "tracks" WHERE "id" = "track_ref")) OR ("tag_ref" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "tags" WHERE "id" = "tag_ref")) OR ("user_ref" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "users" WHERE "id" = "user_ref")) OR ("event_ref" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "events" WHERE "id" = "event_ref")) OR ("journal_ref" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "journals" WHERE "id" = "journal_ref"));--> statement-breakpoint
DELETE FROM "taggings" WHERE ("artist_ref" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "artists" WHERE "id" = "artist_ref")) OR ("album_ref" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "albums" WHERE "id" = "album_ref")) OR ("track_ref" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "tracks" WHERE "id" = "track_ref"));--> statement-breakpoint
DELETE FROM "wiki_locks" WHERE ("artist_ref" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "artists" WHERE "id" = "artist_ref")) OR ("album_ref" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "albums" WHERE "id" = "album_ref")) OR ("track_ref" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "tracks" WHERE "id" = "track_ref")) OR ("tag_ref" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "tags" WHERE "id" = "tag_ref"));--> statement-breakpoint
DELETE FROM "wikis" WHERE ("artist_ref" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "artists" WHERE "id" = "artist_ref")) OR ("album_ref" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "albums" WHERE "id" = "album_ref")) OR ("track_ref" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "tracks" WHERE "id" = "track_ref")) OR ("tag_ref" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "tags" WHERE "id" = "tag_ref"));--> statement-breakpoint
ALTER TABLE "shouts" ADD CONSTRAINT "shouts_artist_ref_artists_id_fk" FOREIGN KEY ("artist_ref") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shouts" ADD CONSTRAINT "shouts_album_ref_albums_id_fk" FOREIGN KEY ("album_ref") REFERENCES "public"."albums"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shouts" ADD CONSTRAINT "shouts_track_ref_tracks_id_fk" FOREIGN KEY ("track_ref") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shouts" ADD CONSTRAINT "shouts_tag_ref_tags_id_fk" FOREIGN KEY ("tag_ref") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shouts" ADD CONSTRAINT "shouts_user_ref_users_id_fk" FOREIGN KEY ("user_ref") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shouts" ADD CONSTRAINT "shouts_event_ref_events_id_fk" FOREIGN KEY ("event_ref") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shouts" ADD CONSTRAINT "shouts_journal_ref_journals_id_fk" FOREIGN KEY ("journal_ref") REFERENCES "public"."journals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "taggings" ADD CONSTRAINT "taggings_artist_ref_artists_id_fk" FOREIGN KEY ("artist_ref") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "taggings" ADD CONSTRAINT "taggings_album_ref_albums_id_fk" FOREIGN KEY ("album_ref") REFERENCES "public"."albums"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "taggings" ADD CONSTRAINT "taggings_track_ref_tracks_id_fk" FOREIGN KEY ("track_ref") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wiki_locks" ADD CONSTRAINT "wiki_locks_artist_ref_artists_id_fk" FOREIGN KEY ("artist_ref") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wiki_locks" ADD CONSTRAINT "wiki_locks_album_ref_albums_id_fk" FOREIGN KEY ("album_ref") REFERENCES "public"."albums"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wiki_locks" ADD CONSTRAINT "wiki_locks_track_ref_tracks_id_fk" FOREIGN KEY ("track_ref") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wiki_locks" ADD CONSTRAINT "wiki_locks_tag_ref_tags_id_fk" FOREIGN KEY ("tag_ref") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wikis" ADD CONSTRAINT "wikis_artist_ref_artists_id_fk" FOREIGN KEY ("artist_ref") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wikis" ADD CONSTRAINT "wikis_album_ref_albums_id_fk" FOREIGN KEY ("album_ref") REFERENCES "public"."albums"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wikis" ADD CONSTRAINT "wikis_track_ref_tracks_id_fk" FOREIGN KEY ("track_ref") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wikis" ADD CONSTRAINT "wikis_tag_ref_tags_id_fk" FOREIGN KEY ("tag_ref") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "shouts_artist_ref" ON "shouts" USING btree ("artist_ref") WHERE "shouts"."artist_ref" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "shouts_album_ref" ON "shouts" USING btree ("album_ref") WHERE "shouts"."album_ref" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "shouts_track_ref" ON "shouts" USING btree ("track_ref") WHERE "shouts"."track_ref" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "shouts_tag_ref" ON "shouts" USING btree ("tag_ref") WHERE "shouts"."tag_ref" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "shouts_user_ref" ON "shouts" USING btree ("user_ref") WHERE "shouts"."user_ref" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "shouts_event_ref" ON "shouts" USING btree ("event_ref") WHERE "shouts"."event_ref" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "shouts_journal_ref" ON "shouts" USING btree ("journal_ref") WHERE "shouts"."journal_ref" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "taggings_artist_ref" ON "taggings" USING btree ("artist_ref") WHERE "taggings"."artist_ref" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "taggings_album_ref" ON "taggings" USING btree ("album_ref") WHERE "taggings"."album_ref" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "taggings_track_ref" ON "taggings" USING btree ("track_ref") WHERE "taggings"."track_ref" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "wiki_locks_artist_ref" ON "wiki_locks" USING btree ("artist_ref") WHERE "wiki_locks"."artist_ref" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "wiki_locks_album_ref" ON "wiki_locks" USING btree ("album_ref") WHERE "wiki_locks"."album_ref" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "wiki_locks_track_ref" ON "wiki_locks" USING btree ("track_ref") WHERE "wiki_locks"."track_ref" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "wiki_locks_tag_ref" ON "wiki_locks" USING btree ("tag_ref") WHERE "wiki_locks"."tag_ref" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "wikis_artist_ref" ON "wikis" USING btree ("artist_ref") WHERE "wikis"."artist_ref" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "wikis_album_ref" ON "wikis" USING btree ("album_ref") WHERE "wikis"."album_ref" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "wikis_track_ref" ON "wikis" USING btree ("track_ref") WHERE "wikis"."track_ref" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "wikis_tag_ref" ON "wikis" USING btree ("tag_ref") WHERE "wikis"."tag_ref" IS NOT NULL;