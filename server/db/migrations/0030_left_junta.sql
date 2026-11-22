ALTER TABLE "users" ADD COLUMN "username_font" text DEFAULT 'default' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "profile_accent" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "profile_accent_end" text;