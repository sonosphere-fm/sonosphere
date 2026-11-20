ALTER TABLE `spotify_auth` ADD `client_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `spotify_auth` ADD `origin` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `spotify_links` ADD `client_id` text DEFAULT '' NOT NULL;