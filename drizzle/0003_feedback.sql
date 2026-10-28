CREATE TABLE `message_feedback` (
	`message_id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`helpful` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `message_feedback_created_idx` ON `message_feedback` (`created_at`);