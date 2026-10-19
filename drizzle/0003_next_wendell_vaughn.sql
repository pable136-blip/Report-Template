CREATE TABLE `report_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `report_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `report_workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`department` text NOT NULL,
	`title` text NOT NULL,
	`password_hash` text NOT NULL,
	`salt` text NOT NULL,
	`created` text NOT NULL,
	`failures` integer DEFAULT 0 NOT NULL,
	`locked_until` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE `attachments` ADD `workspace_id` text;--> statement-breakpoint
ALTER TABLE `projects` ADD `workspace_id` text;