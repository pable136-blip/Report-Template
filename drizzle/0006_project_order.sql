ALTER TABLE projects ADD COLUMN sort_order integer NOT NULL DEFAULT 0;
--> statement-breakpoint
WITH ranked AS (SELECT id, ROW_NUMBER() OVER (PARTITION BY workspace_id ORDER BY updated DESC,id) AS position FROM projects)
UPDATE projects SET sort_order=(SELECT position FROM ranked WHERE ranked.id=projects.id);
