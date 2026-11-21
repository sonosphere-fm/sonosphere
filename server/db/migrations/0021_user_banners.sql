ALTER TABLE "users" ADD COLUMN "banner_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_banner_id_images_id_fk" FOREIGN KEY ("banner_id") REFERENCES "public"."images"("id") ON DELETE set null ON UPDATE no action;
