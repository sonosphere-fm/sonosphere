CREATE TABLE "user_totp" (
	"user_id" integer PRIMARY KEY NOT NULL,
	"secret" text NOT NULL,
	"recovery" text NOT NULL,
	"last_step" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_totp" ADD CONSTRAINT "user_totp_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;