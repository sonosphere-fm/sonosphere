ALTER TABLE "discord_rich_presence" ADD COLUMN "details" text DEFAULT 'trackArtist' NOT NULL;--> statement-breakpoint
ALTER TABLE "discord_rich_presence" ADD COLUMN "layout" text DEFAULT 'stacked' NOT NULL;--> statement-breakpoint
ALTER TABLE "discord_rich_presence" ADD COLUMN "branding" boolean DEFAULT true NOT NULL;