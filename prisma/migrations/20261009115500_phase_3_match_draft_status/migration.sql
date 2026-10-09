-- PostgreSQL requires a newly added enum value to commit before it is used as a column default.
ALTER TYPE "MatchStatus" ADD VALUE IF NOT EXISTS 'DRAFT' BEFORE 'SCHEDULED';
