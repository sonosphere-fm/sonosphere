CREATE TABLE "discord_rich_presence" (
	"user_id" integer PRIMARY KEY NOT NULL,
	"discord_id" text NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text NOT NULL,
	"expires_at" integer NOT NULL,
	"on" boolean DEFAULT true NOT NULL,
	"broken" boolean DEFAULT false NOT NULL,
	"created_at" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "discord_rich_presence" ADD CONSTRAINT "discord_rich_presence_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;