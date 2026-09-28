-- Link spots to real places in OpenStreetMap. Contributors pick a place while typing its name, and
-- Atlas pre-fills the address, hours, website and tags from OpenStreetMap. Atlas's database is
-- published under the Open Database License (ODbL 1.0), which is what lets it store that data.

alter table public.spots
  add column website text check (website is null or (website ~* '^https?://' and char_length(website) <= 500)),
  add column osm_type text check (osm_type in ('node', 'way', 'relation')),
  add column osm_id bigint check (osm_id > 0),
  add constraint spots_osm_ref_complete check ((osm_type is null) = (osm_id is null));

-- One published Atlas spot per real place. A removed spot doesn't block re-adding it.
create unique index spots_osm_place_unique on public.spots (osm_type, osm_id)
  where status = 'published' and osm_id is not null;

-- Website becomes editable through suggested edits. The OpenStreetMap link is set when a spot is
-- created and changed only by admins.
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
      where k not in ('name', 'category', 'city', 'address', 'lat', 'lng', 'scores', 'tags', 'description', 'operating_hours', 'website')
    )
    and (not c ? 'scores' or private.valid_scores(c -> 'scores'))
    and (not c ? 'tags' or (jsonb_typeof(c -> 'tags') = 'array'
      and private.valid_tags(array(select jsonb_array_elements_text(c -> 'tags')))))
    and (not c ? 'operating_hours' or private.valid_hours(c -> 'operating_hours'))
    and (not c ? 'website' or c ->> 'website' ~* '^https?://');
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
      scores          = coalesce(c -> 'scores', scores),
      tags            = case when c ? 'tags' then array(select jsonb_array_elements_text(c -> 'tags')) else tags end,
      description     = coalesce(c ->> 'description', description),
      operating_hours = case when c ? 'operating_hours' then c -> 'operating_hours' else operating_hours end,
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
revoke execute on function private.valid_edit_changes(jsonb) from public;
grant execute on function private.valid_edit_changes(jsonb) to anon, authenticated;
