INSERT INTO "api_apps" ("user_id", "name", "description", "api_key", "secret", "callback_url", "created_at")
VALUES (NULL, 'Scrobble relay', 'Built-in relay to Last.fm', 'relay', md5(random()::text || clock_timestamp()::text), '', EXTRACT(EPOCH FROM NOW())::integer)
ON CONFLICT ("api_key") DO NOTHING;
