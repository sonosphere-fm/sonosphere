CREATE TABLE "discord_presence" (
	"user_id" integer PRIMARY KEY NOT NULL,
	"last_play_at" integer,
	"created_at" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "discord_presence" ADD CONSTRAINT "discord_presence_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;