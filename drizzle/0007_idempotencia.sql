ALTER TABLE `ticket_comments` ADD `idempotency_key` text;--> statement-breakpoint
CREATE UNIQUE INDEX `ticket_comments_idempotency_key_unique` ON `ticket_comments` (`idempotency_key`);--> statement-breakpoint
ALTER TABLE `tickets` ADD `idempotency_key` text;--> statement-breakpoint
CREATE UNIQUE INDEX `tickets_idempotency_key_unique` ON `tickets` (`idempotency_key`);