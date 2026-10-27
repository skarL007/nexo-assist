CREATE INDEX `conversations_employee_idx` ON `conversations` (`employee_id`,`status`);--> statement-breakpoint
CREATE INDEX `conversations_updated_idx` ON `conversations` (`updated_at`);--> statement-breakpoint
CREATE INDEX `drafts_conversation_idx` ON `drafts` (`conversation_id`);--> statement-breakpoint
CREATE INDEX `messages_conversation_idx` ON `messages` (`conversation_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `messages_role_created_idx` ON `messages` (`role`,`created_at`);--> statement-breakpoint
CREATE INDEX `tickets_owner_idx` ON `tickets` (`owner_id`);