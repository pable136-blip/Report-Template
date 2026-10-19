CREATE TABLE report_admin_config (id integer PRIMARY KEY CHECK (id=1),password_hash text NOT NULL,salt text NOT NULL);
--> statement-breakpoint
CREATE TABLE report_admin_sessions (token_hash text PRIMARY KEY NOT NULL,expires integer NOT NULL);
--> statement-breakpoint
CREATE TABLE report_admin_attempts (client_key text PRIMARY KEY NOT NULL,attempts integer NOT NULL,reset_at integer NOT NULL);
--> statement-breakpoint
ALTER TABLE report_sessions ADD COLUMN admin_session_hash text;
--> statement-breakpoint
CREATE INDEX report_sessions_admin ON report_sessions(admin_session_hash);
--> statement-breakpoint
UPDATE report_workspaces SET department='스마트도시추진과' WHERE id='6979E2190EBC' AND department='예시 총괄부서';
--> statement-breakpoint
UPDATE report_sessions SET department='스마트도시추진과' WHERE workspace_id='6979E2190EBC' AND role='coordinator' AND department='예시 총괄부서';
