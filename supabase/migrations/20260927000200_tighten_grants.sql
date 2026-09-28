-- Supabase grants every API role full rights on new public tables by default, leaving row-level
-- security as the only guard. Reduce each role to exactly what its policies allow, so a future
-- policy mistake can't widen access on its own.

revoke all on public.spots, public.spot_edits, public.spot_reports, public.crowd_reports from anon, authenticated;

grant select, insert on public.spots to anon, authenticated;
grant update, delete on public.spots to authenticated;
grant insert on public.spot_edits, public.spot_reports, public.crowd_reports to anon, authenticated;
grant select, update, delete on public.spot_edits, public.spot_reports to authenticated;
grant select, delete on public.crowd_reports to authenticated;

-- Functions are executable by everyone by default. Keep only the ones the app calls.
revoke execute on all functions in schema private from anon, authenticated, public;
grant execute on function private.valid_scores(jsonb), private.valid_tags(text[]), private.valid_hours(jsonb),
  private.valid_edit_changes(jsonb) to anon, authenticated;

-- New tables and functions start closed; each migration grants what it needs
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke execute on functions from anon, authenticated, public;
