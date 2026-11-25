CREATE TABLE "ban_marks" (
	"user_id" integer NOT NULL,
	"kind" text NOT NULL,
	"value" text NOT NULL,
	"created_at" integer NOT NULL,
	CONSTRAINT "ban_marks_user_id_kind_value_pk" PRIMARY KEY("user_id","kind","value")
);
--> statement-breakpoint
CREATE TABLE "user_ips" (
	"user_id" integer NOT NULL,
	"ip" text NOT NULL,
	"first_at" integer NOT NULL,
	"last_at" integer NOT NULL,
	CONSTRAINT "user_ips_user_id_ip_pk" PRIMARY KEY("user_id","ip")
);
--> statement-breakpoint
ALTER TABLE "user_ips" ADD CONSTRAINT "user_ips_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ban_marks_value" ON "ban_marks" USING btree ("kind","value");--> statement-breakpoint
CREATE INDEX "user_ips_ip" ON "user_ips" USING btree ("ip");--> statement-breakpoint
CREATE INDEX "user_ips_last" ON "user_ips" USING btree ("last_at");--> statement-breakpoint
INSERT INTO "ban_marks" ("user_id", "kind", "value", "created_at")
SELECT "id", 'email',
  replace(split_part(lower(split_part("email", '@', 1)), '+', 1), '.', '') || '@' ||
  CASE WHEN lower(split_part("email", '@', 2)) = 'googlemail.com' THEN 'gmail.com' ELSE lower(split_part("email", '@', 2)) END,
  coalesce("banned_at", extract(epoch from now())::integer)
FROM "users" WHERE "banned" AND "email" NOT LIKE '%.invalid' ON CONFLICT DO NOTHING;
