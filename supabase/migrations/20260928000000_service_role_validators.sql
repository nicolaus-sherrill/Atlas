-- The server-side key (service_role) writes AI summaries. Row checks call these validators on every
-- update, so it needs them too; 20260927000200 granted them only to anon and authenticated.
grant usage on schema private to service_role;
grant execute on function private.valid_scores(jsonb), private.valid_tags(text[]), private.valid_hours(jsonb),
  private.valid_edit_changes(jsonb) to service_role;
