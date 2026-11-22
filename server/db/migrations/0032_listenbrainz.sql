CREATE TABLE "listen_imports" (
	"user_id" integer NOT NULL,
	"service" text NOT NULL,
	"ts" integer NOT NULL,
	CONSTRAINT "listen_imports_user_id_service_pk" PRIMARY KEY("user_id","service")
);
--> statement-breakpoint
CREATE TABLE "recording_mbids" (
	"mbid" text PRIMARY KEY NOT NULL,
	"track_id" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "listen_imports" ADD CONSTRAINT "listen_imports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recording_mbids" ADD CONSTRAINT "recording_mbids_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recording_mbids_track" ON "recording_mbids" USING btree ("track_id");--> statement-breakpoint
INSERT INTO "api_apps" ("user_id", "name", "description", "api_key", "secret", "callback_url", "created_at")
VALUES (NULL, 'ListenBrainz token', 'Built-in ListenBrainz-compatible API', 'listenbrainz', md5(random()::text || clock_timestamp()::text), '', EXTRACT(EPOCH FROM NOW())::integer)
ON CONFLICT ("api_key") DO NOTHING;
