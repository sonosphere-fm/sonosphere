CREATE TABLE `spotify_auth` (
	`state` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`verifier` text NOT NULL,
	`redirect_uri` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `spotify_links` (
	`user_id` integer PRIMARY KEY NOT NULL,
	`spotify_id` text NOT NULL,
	`display_name` text DEFAULT '' NOT NULL,
	`access_token` text NOT NULL,
	`refresh_token` text NOT NULL,
	`expires_at` integer NOT NULL,
	`cursor` integer DEFAULT 0 NOT NULL,
	`recent_at` integer DEFAULT 0 NOT NULL,
	`playing_at` integer DEFAULT 0 NOT NULL,
	`imported_at` integer,
	`imported` integer DEFAULT 0 NOT NULL,
	`broken` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `spotify_links_due` ON `spotify_links` (`recent_at`);