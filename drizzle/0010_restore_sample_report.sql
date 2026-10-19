-- Restore only the sample report deletion explicitly reported by the owner.
-- Its existing projects, attachments, settings and design remain unchanged.
UPDATE report_workspaces SET deleted_at=NULL
WHERE id='6979E2190EBC' AND deleted_at='2026-10-15T12:57:01.632Z';
