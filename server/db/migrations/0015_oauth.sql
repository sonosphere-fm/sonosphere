CREATE TABLE "oauth_accounts" (
	"provider" text NOT NULL,
	"subject" text NOT NULL,
	"user_id" integer NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"created_at" integer NOT NULL,
	CONSTRAINT "oauth_accounts_provider_subject_pk" PRIMARY KEY("provider","subject"),
	CONSTRAINT "oauth_accounts_user_provider" UNIQUE("user_id","provider")
);
--> statement-breakpoint
ALTER TABLE "oauth_accounts" ADD CONSTRAINT "oauth_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;