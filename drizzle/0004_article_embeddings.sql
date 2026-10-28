CREATE TABLE `article_embeddings` (
	`article_id` text NOT NULL,
	`model` text NOT NULL,
	`content_hash` text NOT NULL,
	`vector` text NOT NULL,
	PRIMARY KEY(`article_id`, `model`),
	FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON UPDATE no action ON DELETE no action
);
