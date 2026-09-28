-- A suggested edit can clear a spot's hours ("hours unknown") or website. Hours clear with a JSON
-- null and the website with an empty string; approval stores both as a real null.

create or replace function private.valid_hours(h jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select h is null or h = 'null'::jsonb or (
    jsonb_typeof(h) = 'object'
    and (select count(*) from jsonb_object_keys(h)) = 7
    and (
      select bool_and(
        d in ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')
        and jsonb_typeof(h -> d -> 'closed') = 'boolean'
        and (h -> d ->> 'open') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
        and (h -> d ->> 'close') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      )
      from jsonb_object_keys(h) as d
    )
  );
$$;

create or replace function private.valid_edit_changes(c jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(c) = 'object'
    and c <> '{}'::jsonb
    and not exists (
      select 1 from jsonb_object_keys(c) k
      where k not in ('name', 'category', 'city', 'address', 'lat', 'lng', 'tags', 'description', 'operating_hours', 'website')
    )
    and (not c ? 'tags' or (jsonb_typeof(c -> 'tags') = 'array'
      and private.valid_tags(array(select jsonb_array_elements_text(c -> 'tags')))))
    and (not c ? 'operating_hours' or private.valid_hours(c -> 'operating_hours'))
    and (not c ? 'website' or coalesce(c ->> 'website', '') = '' or c ->> 'website' ~* '^https?://');
$$;

create or replace function public.review_spot_edit(p_edit_id uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.spot_edits;
  c jsonb;
begin
  if not public.is_admin() then
    raise exception 'Only admins can review edits' using errcode = '42501';
  end if;

  select * into e from public.spot_edits where id = p_edit_id and status = 'pending' for update;
  if not found then
    raise exception 'Edit % is not pending', p_edit_id;
  end if;

  if p_approve then
    c := e.changes;
    update public.spots set
      name            = coalesce(c ->> 'name', name),
      category        = coalesce(c ->> 'category', category),
      city            = coalesce(c ->> 'city', city),
      address         = coalesce(c ->> 'address', address),
      lat             = coalesce((c ->> 'lat')::double precision, lat),
      lng             = coalesce((c ->> 'lng')::double precision, lng),
      tags            = case when c ? 'tags' then array(select jsonb_array_elements_text(c -> 'tags')) else tags end,
      description     = coalesce(c ->> 'description', description),
      operating_hours = case when c ? 'operating_hours' then nullif(c -> 'operating_hours', 'null'::jsonb) else operating_hours end,
      website         = case when c ? 'website' then nullif(c ->> 'website', '') else website end,
      -- A changed description makes the old AI summary stale
      ai_summary      = case when c ? 'description' then null else ai_summary end
    where id = e.spot_id;
  end if;

  update public.spot_edits
    set status = case when p_approve then 'approved' else 'rejected' end, reviewed_at = now()
    where id = p_edit_id;
end;
$$;

revoke execute on function public.review_spot_edit(uuid, boolean) from public, anon;
grant execute on function public.review_spot_edit(uuid, boolean) to authenticated;
revoke execute on function private.valid_hours(jsonb), private.valid_edit_changes(jsonb) from public;
grant execute on function private.valid_hours(jsonb), private.valid_edit_changes(jsonb) to anon, authenticated;
