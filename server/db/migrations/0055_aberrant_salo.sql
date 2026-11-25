CREATE TABLE "listening_suspicion" (
	"user_id" integer PRIMARY KEY NOT NULL,
	"score" real DEFAULT 0 NOT NULL,
	"target" text,
	"updated_at" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "listening_suspicion" ADD CONSTRAINT "listening_suspicion_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;