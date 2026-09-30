-- One-time reset explicitly requested by the owner on 2026-09-29.
-- Preserve unit identities, operational rules and encrypted AI connection configuration.
INSERT INTO settings(id,payload) SELECT '__reset_files',COALESCE(json_group_array(file_key),'[]') FROM imports WHERE file_key LIKE 'imports/%' ON CONFLICT(id) DO UPDATE SET payload=excluded.payload;
--> statement-breakpoint
DELETE FROM total_batches;
--> statement-breakpoint
DELETE FROM records;
--> statement-breakpoint
DELETE FROM imports;
--> statement-breakpoint
DELETE FROM actions;
--> statement-breakpoint
DELETE FROM reports;
--> statement-breakpoint
DELETE FROM ai_runs;
--> statement-breakpoint
DELETE FROM ai_quota;
--> statement-breakpoint
UPDATE settings SET payload=(SELECT json_group_array(json_set(value,'$.target',0)) FROM json_each(settings.payload)) WHERE id='stores';
--> statement-breakpoint
INSERT INTO settings(id,payload) VALUES('data_reset','{"id":"real-test-2026-09-29","mode":"real"}') ON CONFLICT(id) DO UPDATE SET payload=excluded.payload;
