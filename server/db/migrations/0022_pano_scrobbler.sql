ALTER TABLE "api_apps" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
INSERT INTO "api_apps" ("user_id", "name", "description", "api_key", "secret", "callback_url", "created_at")
VALUES (NULL, 'Pano Scrobbler', 'Built-in GNU FM-compatible Pano Scrobbler client', 'panoScrobbler', 'panoScrobbler', '', EXTRACT(EPOCH FROM NOW())::integer)
ON CONFLICT ("api_key") DO NOTHING;
