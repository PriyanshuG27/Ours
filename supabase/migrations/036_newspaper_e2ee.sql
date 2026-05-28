-- 036_newspaper_e2ee.sql

ALTER TABLE newspaper_archives
RENAME COLUMN html_snapshot TO encrypted_html_snapshot;
