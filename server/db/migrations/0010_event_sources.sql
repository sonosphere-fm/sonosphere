ALTER TABLE "events" ADD COLUMN "source" text DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "source_id" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "lat" real;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "lon" real;--> statement-breakpoint
CREATE UNIQUE INDEX "events_source" ON "events" USING btree ("source","source_id");--> statement-breakpoint
CREATE INDEX "events_starts" ON "events" USING btree ("starts_at");