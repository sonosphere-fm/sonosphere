ALTER TABLE "users" ADD COLUMN "email_notify" text DEFAULT 'instant' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_muted" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "digest_at" integer;