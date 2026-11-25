CREATE TABLE "jellyfin_links" (
	"user_id" integer PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"jellyfin_user_id" text NOT NULL,
	"device_id" text NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"version" text DEFAULT '' NOT NULL,
	"created_at" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "jellyfin_links" ADD CONSTRAINT "jellyfin_links_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
UPDATE "users" SET "playback_source" = 'music' WHERE "playback_source" = 'subsonic';
