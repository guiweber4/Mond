CREATE TABLE `actions` (
	`id` text PRIMARY KEY NOT NULL,
	`dataset` text NOT NULL,
	`status` text NOT NULL,
	`updated_at` text NOT NULL,
	`payload` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `imports` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`created_at` text NOT NULL,
	`status` text NOT NULL,
	`count` integer NOT NULL,
	`hash` text NOT NULL,
	`file_key` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_imports_status` ON `imports` (`status`);--> statement-breakpoint
CREATE TABLE `records` (
	`kind` text NOT NULL,
	`rid` text NOT NULL,
	`import_id` text NOT NULL,
	`payload` text NOT NULL,
	PRIMARY KEY(`kind`, `rid`, `import_id`),
	FOREIGN KEY (`import_id`) REFERENCES `imports`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_records_import` ON `records` (`import_id`);--> statement-breakpoint
CREATE TABLE `reports` (
	`id` text PRIMARY KEY NOT NULL,
	`dataset` text NOT NULL,
	`title` text NOT NULL,
	`created_at` text NOT NULL,
	`payload` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`id` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL
);
