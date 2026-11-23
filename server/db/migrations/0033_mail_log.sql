CREATE TABLE "mail_log" (
	"token" text PRIMARY KEY NOT NULL,
	"to" text NOT NULL,
	"subject" text NOT NULL,
	"sent_at" integer NOT NULL,
	"opened_at" integer,
	"clicked_at" integer,
	"opens" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX "mail_log_sent" ON "mail_log" USING btree ("sent_at");