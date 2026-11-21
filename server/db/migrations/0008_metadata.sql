ALTER TABLE "albums" ADD COLUMN "mbid" text;--> statement-breakpoint
ALTER TABLE "albums" ADD COLUMN "meta_at" integer;--> statement-breakpoint
ALTER TABLE "albums" ADD COLUMN "cover_at" integer;--> statement-breakpoint
ALTER TABLE "artists" ADD COLUMN "mbid" text;--> statement-breakpoint
ALTER TABLE "artists" ADD COLUMN "spotify_id" text;--> statement-breakpoint
ALTER TABLE "artists" ADD COLUMN "meta_at" integer;--> statement-breakpoint
ALTER TABLE "images" ADD COLUMN "url" text;--> statement-breakpoint
ALTER TABLE "tracks" ADD COLUMN "meta_at" integer;