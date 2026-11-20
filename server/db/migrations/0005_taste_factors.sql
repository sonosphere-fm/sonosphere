CREATE TABLE `taste_factors` (
	`kind` text NOT NULL,
	`id` integer NOT NULL,
	`vec` blob NOT NULL,
	PRIMARY KEY(`kind`, `id`)
);
--> statement-breakpoint
-- Similar artists now also weigh listening order: queue every artist for a fresh look in the background.
INSERT OR IGNORE INTO `taste_queue` (`kind`, `id`, `queued_at`) SELECT DISTINCT 'artist', `artist_id`, 0 FROM `user_artists`;
