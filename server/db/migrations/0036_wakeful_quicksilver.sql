ALTER TABLE "shouts" ADD COLUMN "parent_id" integer;--> statement-breakpoint
ALTER TABLE "shouts" ADD COLUMN "deleted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "shouts" ADD CONSTRAINT "shouts_parent_id_shouts_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."shouts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "shouts_parent" ON "shouts" USING btree ("parent_id","created_at","id");