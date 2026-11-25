CREATE TABLE "subsonic_links" (
	"user_id" integer PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"version" text DEFAULT '' NOT NULL,
	"open_subsonic" boolean DEFAULT false NOT NULL,
	"created_at" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "playback_source" text DEFAULT 'youtube' NOT NULL;--> statement-breakpoint
ALTER TABLE "subsonic_links" ADD CONSTRAINT "subsonic_links_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;