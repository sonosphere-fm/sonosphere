CREATE TABLE `album_tracks` (
	`album_id` integer NOT NULL,
	`track_id` integer NOT NULL,
	`position` integer NOT NULL,
	PRIMARY KEY(`album_id`, `track_id`),
	FOREIGN KEY (`album_id`) REFERENCES `albums`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`track_id`) REFERENCES `tracks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `albums` (
	`id` integer PRIMARY KEY NOT NULL,
	`artist_id` integer NOT NULL,
	`title` text NOT NULL,
	`title_norm` text NOT NULL,
	`release_date` text,
	`image_id` integer,
	`created_at` integer NOT NULL,
	`base_listeners` integer DEFAULT 0 NOT NULL,
	`base_playcount` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`artist_id`) REFERENCES `artists`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`image_id`) REFERENCES `images`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `albums_artist_id_title_norm_unique` ON `albums` (`artist_id`,`title_norm`);--> statement-breakpoint
CREATE TABLE `api_apps` (
	`id` integer PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`api_key` text NOT NULL,
	`secret` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_apps_api_key_unique` ON `api_apps` (`api_key`);--> statement-breakpoint
CREATE TABLE `api_sessions` (
	`key` text PRIMARY KEY NOT NULL,
	`app_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`app_id`) REFERENCES `api_apps`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `api_tokens` (
	`token` text PRIMARY KEY NOT NULL,
	`app_id` integer NOT NULL,
	`user_id` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`app_id`) REFERENCES `api_apps`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `artists` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`name_norm` text NOT NULL,
	`image_id` integer,
	`created_at` integer NOT NULL,
	`base_listeners` integer DEFAULT 0 NOT NULL,
	`base_playcount` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`image_id`) REFERENCES `images`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `artists_name_norm_unique` ON `artists` (`name_norm`);--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` integer PRIMARY KEY NOT NULL,
	`actor_id` integer,
	`actor_name` text DEFAULT '' NOT NULL,
	`action` text NOT NULL,
	`target_type` text DEFAULT '' NOT NULL,
	`target_id` integer,
	`target_label` text DEFAULT '' NOT NULL,
	`subject_id` integer,
	`note` text DEFAULT '' NOT NULL,
	`data` text DEFAULT '{}' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `audit_subject` ON `audit_log` (`subject_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `audit_time` ON `audit_log` (`created_at`);--> statement-breakpoint
CREATE TABLE `blocks` (
	`blocker_id` integer NOT NULL,
	`blocked_id` integer NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`blocker_id`, `blocked_id`),
	FOREIGN KEY (`blocker_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`blocked_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `dm_flags` (
	`id` integer PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`kind` text NOT NULL,
	`detail` text DEFAULT '' NOT NULL,
	`sample` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`resolved_at` integer,
	`resolved_by` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `dm_flags_open` ON `dm_flags` (`resolved_at`,`created_at`);--> statement-breakpoint
CREATE TABLE `dm_messages` (
	`id` integer PRIMARY KEY NOT NULL,
	`thread_id` integer NOT NULL,
	`sender_id` integer NOT NULL,
	`body` text NOT NULL,
	`created_at` integer NOT NULL,
	`deleted_at` integer,
	`deleted_by` integer,
	FOREIGN KEY (`thread_id`) REFERENCES `dm_threads`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sender_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `dm_messages_sender` ON `dm_messages` (`sender_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `dm_messages_thread` ON `dm_messages` (`thread_id`,`id`);--> statement-breakpoint
CREATE TABLE `dm_threads` (
	`id` integer PRIMARY KEY NOT NULL,
	`user_lo` integer NOT NULL,
	`user_hi` integer NOT NULL,
	`status` text DEFAULT 'request' NOT NULL,
	`requester_id` integer NOT NULL,
	`created_at` integer NOT NULL,
	`last_at` integer NOT NULL,
	`lo_read` integer DEFAULT 0 NOT NULL,
	`hi_read` integer DEFAULT 0 NOT NULL,
	`lo_cleared` integer DEFAULT 0 NOT NULL,
	`hi_cleared` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`user_lo`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_hi`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `dm_threads_hi` ON `dm_threads` (`user_hi`,`last_at`);--> statement-breakpoint
CREATE INDEX `dm_threads_lo` ON `dm_threads` (`user_lo`,`last_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `dm_threads_user_lo_user_hi_unique` ON `dm_threads` (`user_lo`,`user_hi`);--> statement-breakpoint
CREATE TABLE `event_artists` (
	`event_id` integer NOT NULL,
	`artist_id` integer NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`event_id`, `artist_id`),
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`artist_id`) REFERENCES `artists`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `event_attendance` (
	`event_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`event_id`, `user_id`),
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` integer PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`venue` text NOT NULL,
	`city` text NOT NULL,
	`country` text NOT NULL,
	`starts_at` integer NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`url` text DEFAULT '' NOT NULL,
	`creator_id` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`creator_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `follows` (
	`follower_id` integer NOT NULL,
	`followee_id` integer NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`follower_id`, `followee_id`),
	FOREIGN KEY (`follower_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`followee_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `follows_followee` ON `follows` (`followee_id`);--> statement-breakpoint
CREATE TABLE `images` (
	`id` integer PRIMARY KEY NOT NULL,
	`mime` text NOT NULL,
	`data` blob NOT NULL,
	`uploader_id` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `journals` (
	`id` integer PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `journals_user` ON `journals` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `loved_tracks` (
	`user_id` integer NOT NULL,
	`track_id` integer NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `track_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`track_id`) REFERENCES `tracks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `meta` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `mod_notes` (
	`id` integer PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`author_id` integer,
	`body` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `mod_notes_user` ON `mod_notes` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` integer PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`type` text NOT NULL,
	`actor_id` integer,
	`data` text DEFAULT '{}' NOT NULL,
	`read` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `notifications_user` ON `notifications` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `now_playing` (
	`user_id` integer PRIMARY KEY NOT NULL,
	`track_id` integer NOT NULL,
	`album_id` integer,
	`started_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`track_id`) REFERENCES `tracks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `obsessions` (
	`id` integer PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`track_id` integer NOT NULL,
	`comment` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`track_id`) REFERENCES `tracks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `playlist_tracks` (
	`id` integer PRIMARY KEY NOT NULL,
	`playlist_id` integer NOT NULL,
	`track_id` integer NOT NULL,
	`position` integer NOT NULL,
	`added_at` integer NOT NULL,
	FOREIGN KEY (`playlist_id`) REFERENCES `playlists`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`track_id`) REFERENCES `tracks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `playlists` (
	`id` integer PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `reports` (
	`id` integer PRIMARY KEY NOT NULL,
	`reporter_id` integer,
	`target_type` text NOT NULL,
	`target_id` integer NOT NULL,
	`reason` text NOT NULL,
	`detail` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`outcome` text DEFAULT '' NOT NULL,
	`snapshot` text DEFAULT '{}' NOT NULL,
	`resolved_by` integer,
	`resolved_at` integer,
	`created_at` integer NOT NULL,
	`resolution_note` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`reporter_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`resolved_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `reports_status` ON `reports` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `scrobbles` (
	`id` integer PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`track_id` integer NOT NULL,
	`artist_id` integer NOT NULL,
	`album_id` integer,
	`played_at` integer NOT NULL,
	`source` text DEFAULT 'web' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`track_id`) REFERENCES `tracks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`artist_id`) REFERENCES `artists`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`album_id`) REFERENCES `albums`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `scrobbles_user_artist` ON `scrobbles` (`user_id`,`artist_id`,`played_at`);--> statement-breakpoint
CREATE INDEX `scrobbles_time` ON `scrobbles` (`played_at`);--> statement-breakpoint
CREATE INDEX `scrobbles_album` ON `scrobbles` (`album_id`,`played_at`);--> statement-breakpoint
CREATE INDEX `scrobbles_track` ON `scrobbles` (`track_id`,`played_at`);--> statement-breakpoint
CREATE INDEX `scrobbles_artist` ON `scrobbles` (`artist_id`,`played_at`);--> statement-breakpoint
CREATE INDEX `scrobbles_user_time` ON `scrobbles` (`user_id`,`played_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `scrobbles_user_id_track_id_played_at_unique` ON `scrobbles` (`user_id`,`track_id`,`played_at`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`token` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `shouts` (
	`id` integer PRIMARY KEY NOT NULL,
	`author_id` integer NOT NULL,
	`target_type` text NOT NULL,
	`target_id` integer NOT NULL,
	`body` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `shouts_target` ON `shouts` (`target_type`,`target_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `similar_artists` (
	`artist_id` integer NOT NULL,
	`similar_id` integer NOT NULL,
	`score` real NOT NULL,
	`source` text DEFAULT 'computed' NOT NULL,
	PRIMARY KEY(`artist_id`, `similar_id`)
);
--> statement-breakpoint
CREATE TABLE `site_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `taggings` (
	`user_id` integer,
	`tag_id` integer NOT NULL,
	`item_type` text NOT NULL,
	`item_id` integer NOT NULL,
	`created_at` integer NOT NULL,
	`weight` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `taggings_tag` ON `taggings` (`tag_id`,`item_type`);--> statement-breakpoint
CREATE INDEX `taggings_item` ON `taggings` (`item_type`,`item_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `taggings_unique` ON `taggings` (COALESCE(`user_id`, 0),`tag_id`,`item_type`,`item_id`);--> statement-breakpoint
CREATE TABLE `tags` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`name_norm` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_name_norm_unique` ON `tags` (`name_norm`);--> statement-breakpoint
CREATE TABLE `tracks` (
	`id` integer PRIMARY KEY NOT NULL,
	`artist_id` integer NOT NULL,
	`title` text NOT NULL,
	`title_norm` text NOT NULL,
	`duration` integer DEFAULT 0 NOT NULL,
	`album_id` integer,
	`created_at` integer NOT NULL,
	`base_listeners` integer DEFAULT 0 NOT NULL,
	`base_playcount` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`artist_id`) REFERENCES `artists`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`album_id`) REFERENCES `albums`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tracks_artist_id_title_norm_unique` ON `tracks` (`artist_id`,`title_norm`);--> statement-breakpoint
CREATE TABLE `user_albums` (
	`user_id` integer NOT NULL,
	`album_id` integer NOT NULL,
	`plays` integer NOT NULL,
	PRIMARY KEY(`user_id`, `album_id`)
) WITHOUT ROWID;
--> statement-breakpoint
CREATE INDEX `user_albums_item` ON `user_albums` (`album_id`,`plays`);--> statement-breakpoint
CREATE INDEX `user_albums_top` ON `user_albums` (`user_id`,`plays`);--> statement-breakpoint
CREATE TABLE `user_artists` (
	`user_id` integer NOT NULL,
	`artist_id` integer NOT NULL,
	`plays` integer NOT NULL,
	PRIMARY KEY(`user_id`, `artist_id`)
) WITHOUT ROWID;
--> statement-breakpoint
CREATE INDEX `user_artists_item` ON `user_artists` (`artist_id`,`plays`);--> statement-breakpoint
CREATE INDEX `user_artists_top` ON `user_artists` (`user_id`,`plays`);--> statement-breakpoint
CREATE TABLE `user_tracks` (
	`user_id` integer NOT NULL,
	`track_id` integer NOT NULL,
	`plays` integer NOT NULL,
	PRIMARY KEY(`user_id`, `track_id`)
) WITHOUT ROWID;
--> statement-breakpoint
CREATE INDEX `user_tracks_item` ON `user_tracks` (`track_id`,`plays`);--> statement-breakpoint
CREATE INDEX `user_tracks_top` ON `user_tracks` (`user_id`,`plays`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`username_norm` text NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`realname` text DEFAULT '' NOT NULL,
	`about` text DEFAULT '' NOT NULL,
	`country` text DEFAULT '' NOT NULL,
	`website` text DEFAULT '' NOT NULL,
	`image_id` integer,
	`hide_recent` integer DEFAULT false NOT NULL,
	`shouts_enabled` integer DEFAULT true NOT NULL,
	`registered_at` integer NOT NULL,
	`is_admin` integer DEFAULT false NOT NULL,
	`suspended` integer DEFAULT false NOT NULL,
	`role` text DEFAULT 'user' NOT NULL,
	`banned` integer DEFAULT false NOT NULL,
	`banned_at` integer,
	`ban_reason` text DEFAULT '' NOT NULL,
	`dm_policy` text DEFAULT 'requests' NOT NULL,
	`dm_muted` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`image_id`) REFERENCES `images`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_norm_unique` ON `users` (`username_norm`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `video_cache` (
	`key` text PRIMARY KEY NOT NULL,
	`video_id` text,
	`fetched_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `wiki_locks` (
	`item_type` text NOT NULL,
	`item_id` integer NOT NULL,
	`locked_by` integer,
	`reason` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`item_type`, `item_id`),
	FOREIGN KEY (`locked_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `wikis` (
	`id` integer PRIMARY KEY NOT NULL,
	`item_type` text NOT NULL,
	`item_id` integer NOT NULL,
	`content` text NOT NULL,
	`author_id` integer,
	`version` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `wikis_item` ON `wikis` (`item_type`,`item_id`,`version`);