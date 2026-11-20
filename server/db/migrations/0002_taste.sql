CREATE TABLE `taste_norms` (
	`kind` text NOT NULL,
	`id` integer NOT NULL,
	`norm` real NOT NULL,
	`computed_at` integer NOT NULL,
	PRIMARY KEY(`kind`, `id`)
);
--> statement-breakpoint
CREATE TABLE `taste_queue` (
	`kind` text NOT NULL,
	`id` integer NOT NULL,
	`queued_at` integer NOT NULL,
	PRIMARY KEY(`kind`, `id`)
);
--> statement-breakpoint
CREATE INDEX `taste_queue_age` ON `taste_queue` (`queued_at`);--> statement-breakpoint
CREATE TABLE `user_neighbours` (
	`user_id` integer NOT NULL,
	`neighbour_id` integer NOT NULL,
	`score` real NOT NULL,
	PRIMARY KEY(`user_id`, `neighbour_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`neighbour_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `user_neighbours_best` ON `user_neighbours` (`user_id`,`score`);