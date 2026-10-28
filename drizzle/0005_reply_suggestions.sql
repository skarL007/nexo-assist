CREATE TABLE `reply_suggestions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`conversation_id` text NOT NULL,
	`analyst_id` text NOT NULL,
	`outcome` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`analyst_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `reply_suggestions_created_idx` ON `reply_suggestions` (`created_at`);