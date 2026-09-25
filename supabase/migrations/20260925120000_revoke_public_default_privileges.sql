-- Prevent newly created public-schema objects from being automatically exposed to API roles.
-- Existing object grants are unchanged; future access must be granted explicitly.

alter default privileges for role postgres in schema public
revoke select, insert, update, delete on tables from anon, authenticated, service_role;

alter default privileges for role postgres in schema public
revoke execute on functions from anon, authenticated, service_role, public;

alter default privileges for role postgres in schema public
revoke usage, select, update on sequences from anon, authenticated, service_role;
