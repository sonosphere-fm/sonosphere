CREATE TABLE "rec_dislikes" (
	"user_id" integer NOT NULL,
	"kind" text NOT NULL,
	"item_id" integer NOT NULL,
	"artist_id" integer NOT NULL,
	"created_at" integer NOT NULL,
	CONSTRAINT "rec_dislikes_user_id_kind_item_id_pk" PRIMARY KEY("user_id","kind","item_id")
);
--> statement-breakpoint
ALTER TABLE "rec_dislikes" ADD CONSTRAINT "rec_dislikes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rec_dislikes" ADD CONSTRAINT "rec_dislikes_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;