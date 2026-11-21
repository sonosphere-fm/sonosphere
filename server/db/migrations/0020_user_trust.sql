CREATE TABLE "user_trust" (
	"user_id" integer PRIMARY KEY NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"checked_at" integer,
	"cleared_at" integer,
	"cleared_by" integer,
	"held" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_trust" ADD CONSTRAINT "user_trust_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_trust" ADD CONSTRAINT "user_trust_cleared_by_users_id_fk" FOREIGN KEY ("cleared_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
INSERT INTO "user_trust" ("user_id", "cleared_at") SELECT "id", extract(epoch from now())::integer FROM "users";
