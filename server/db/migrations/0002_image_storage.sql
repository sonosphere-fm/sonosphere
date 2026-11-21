-- Pictures move to object storage and get random ids in place of 1, 2, 3...: a new id for every picture, carried over
-- to the accounts, artists and albums pointing at it. Hand-written (a generated change of type cannot map the values).
ALTER TABLE "images" ALTER COLUMN "data" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "images" ADD COLUMN "key" text;--> statement-breakpoint
ALTER TABLE "images" ADD COLUMN "size" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "images" ADD COLUMN "width" integer;--> statement-breakpoint
ALTER TABLE "images" ADD COLUMN "height" integer;--> statement-breakpoint
ALTER TABLE "images" ADD COLUMN "new_id" text NOT NULL DEFAULT replace(gen_random_uuid()::text, '-', '');--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "new_image_id" text;--> statement-breakpoint
ALTER TABLE "artists" ADD COLUMN "new_image_id" text;--> statement-breakpoint
ALTER TABLE "albums" ADD COLUMN "new_image_id" text;--> statement-breakpoint
UPDATE "users" t SET "new_image_id" = i."new_id" FROM "images" i WHERE i."id" = t."image_id";--> statement-breakpoint
UPDATE "artists" t SET "new_image_id" = i."new_id" FROM "images" i WHERE i."id" = t."image_id";--> statement-breakpoint
UPDATE "albums" t SET "new_image_id" = i."new_id" FROM "images" i WHERE i."id" = t."image_id";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "image_id";--> statement-breakpoint
ALTER TABLE "artists" DROP COLUMN "image_id";--> statement-breakpoint
ALTER TABLE "albums" DROP COLUMN "image_id";--> statement-breakpoint
ALTER TABLE "users" RENAME COLUMN "new_image_id" TO "image_id";--> statement-breakpoint
ALTER TABLE "artists" RENAME COLUMN "new_image_id" TO "image_id";--> statement-breakpoint
ALTER TABLE "albums" RENAME COLUMN "new_image_id" TO "image_id";--> statement-breakpoint
ALTER TABLE "images" DROP COLUMN "id";--> statement-breakpoint
ALTER TABLE "images" RENAME COLUMN "new_id" TO "id";--> statement-breakpoint
ALTER TABLE "images" ADD PRIMARY KEY ("id");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_image_id_images_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."images"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artists" ADD CONSTRAINT "artists_image_id_images_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."images"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "albums" ADD CONSTRAINT "albums_image_id_images_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."images"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "images_uploader" ON "images" USING btree ("uploader_id");
