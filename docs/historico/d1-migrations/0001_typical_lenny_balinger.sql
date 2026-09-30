CREATE TABLE `ai_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`enabled` integer NOT NULL,
	`cipher` text NOT NULL,
	`hint` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ai_quota` (
	`id` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ai_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`dataset` text NOT NULL,
	`purpose` text NOT NULL,
	`created_at` text NOT NULL,
	`status` text NOT NULL,
	`duration_ms` integer NOT NULL,
	`input_tokens` integer,
	`output_tokens` integer,
	`output` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_ai_runs_created` ON `ai_runs` (`created_at`);