-- Run as the migration/owner role. Attach the real login role through your
-- provider/IAM tooling; never put a database password in this file.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'liga_goal_runtime') THEN
    CREATE ROLE liga_goal_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
END $$;
GRANT CONNECT ON DATABASE :DBNAME TO liga_goal_runtime;
GRANT USAGE ON SCHEMA public TO liga_goal_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO liga_goal_runtime;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO liga_goal_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO liga_goal_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO liga_goal_runtime;
