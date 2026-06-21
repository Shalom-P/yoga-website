-- 0024_teacher_role.sql
-- Adds a 'teacher' value to the user_role enum so teachers can hold real logins
-- (until now a "teacher" was a pure data record in public.teachers with no auth
-- identity; profiles.role was only 'customer' | 'admin').
--
-- MUST be applied on its own, BEFORE 0025. Postgres forbids using a freshly-added
-- enum label inside the same transaction that adds it, and every function/policy
-- in 0025 references 'teacher'. Apply in order:
--   psql "$SUPABASE_DB_URL" -f supabase/migrations/0024_teacher_role.sql
--   psql "$SUPABASE_DB_URL" -f supabase/migrations/0025_teacher_provisioning.sql

alter type public.user_role add value if not exists 'teacher';
