ALTER TABLE report_workspaces ADD COLUMN coordinator_hash text;
--> statement-breakpoint
ALTER TABLE report_sessions ADD COLUMN role text NOT NULL DEFAULT 'department';
--> statement-breakpoint
ALTER TABLE report_sessions ADD COLUMN department text NOT NULL DEFAULT '';
--> statement-breakpoint
DELETE FROM report_sessions;
