CREATE TABLE `stock_batches` (
	`store` text NOT NULL,
	`date` text NOT NULL,
	`import_id` text NOT NULL,
	PRIMARY KEY(`store`, `date`),
	FOREIGN KEY (`import_id`) REFERENCES `imports`(`id`) ON UPDATE no action ON DELETE no action
);
