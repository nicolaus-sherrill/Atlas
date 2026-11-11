-- Atlas widens from places to work to public third spaces: anywhere anyone can walk into without
-- a membership or an invitation, where staying an hour or more is normal.
--
-- * Eleven kinds of place instead of four.
-- * Each spot says what it is good for: work, gather, create. At least one.
-- * A spot can be marked as charging for entry (a museum ticket, a day pass).
-- * Ratings gain "seating" and lose "hours": the hours score is now worked out from the spot's
--   opening hours, in the app. Old ratings keep their hours number; it no longer counts.
-- * Outdoors and in museums, wifi, power and food are optional to rate, so a park isn't marked
--   down for having no outlets, and a park with public wifi still gets credit for it.
-- * Five new tags.

-- ---------------------------------------------------------------------------
-- Kinds of place
-- ---------------------------------------------------------------------------

alter table public.spots drop constraint spots_category_check;
alter table public.spots add constraint spots_category_check check (category in (
  'cafe', 'bar', 'food_hall',
  'library', 'community_center',
  'museum', 'bookstore', 'makerspace',
  'park',
  'coworking', 'hotel'
));

-- ---------------------------------------------------------------------------
-- Good for, and paid entry
-- ---------------------------------------------------------------------------

alter table public.spots
  -- Every spot so far was added as a place to work
  add column good_for text[] not null default '{work}'
    check (good_for <@ array['work', 'gather', 'create']::text[] and cardinality(good_for) >= 1),
  add column paid_entry boolean not null default false;

-- ---------------------------------------------------------------------------
-- Scores
-- ---------------------------------------------------------------------------

-- What the tables accept: any of the known criteria, each 1 to 5. "hours" stays allowed so old
-- ratings and archived spots still load. What a visitor must rate is enforced below.
create or replace function private.valid_scores(s jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(s) = 'object'
    and s <> '{}'::jsonb
    and (
      select bool_and(
        k in ('seating', 'wifi', 'outlets', 'food', 'atmosphere', 'access', 'hours')
        and jsonb_typeof(s -> k) = 'number'
        and (s ->> k)::numeric between 1 and 5
      )
      from jsonb_object_keys(s) as k
    );
$$;

-- A visitor's rating covers seating, atmosphere and access everywhere, plus wifi, power and food
-- wherever those are expected. Hours are never rated.
create or replace function private.enforce_score_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  cat text;
  required text[] := array['seating', 'atmosphere', 'access'];
  missing text;
begin
  if coalesce((select auth.role()), '') not in ('anon', 'authenticated') or public.is_admin() then
    return new;
  end if;

  if tg_table_name = 'spots' then
    cat := new.category;
  else
    select category into cat from public.spots where id = new.spot_id;
  end if;

  new.scores := new.scores - 'hours';

  if cat is distinct from 'park' and cat is distinct from 'museum' then
    required := required || array['wifi', 'outlets', 'food'];
  end if;

  select k into missing from unnest(required) as k where not new.scores ? k limit 1;
  if missing is not null then
    raise exception 'A rating here needs a score for %', missing using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger spots_score_rules before insert on public.spots
  for each row execute function private.enforce_score_rules();
create trigger ratings_score_rules before insert or update on public.ratings
  for each row execute function private.enforce_score_rules();

-- A spot's scores are the average of its visible ratings, criterion by criterion. A criterion
-- nobody rated is left out rather than counted as a low score.
create or replace function private.recompute_spot_scores(p_spot_id text)
returns void
language sql
security definer
set search_path = ''
as $$
  with visible as (
    select scores from public.ratings where spot_id = p_spot_id and status = 'visible'
  ),
  agg as (
    select count(*) as n,
      jsonb_strip_nulls(jsonb_build_object(
        'seating',    round(avg((scores ->> 'seating')::numeric), 1),
        'wifi',       round(avg((scores ->> 'wifi')::numeric), 1),
        'outlets',    round(avg((scores ->> 'outlets')::numeric), 1),
        'food',       round(avg((scores ->> 'food')::numeric), 1),
        'atmosphere', round(avg((scores ->> 'atmosphere')::numeric), 1),
        'access',     round(avg((scores ->> 'access')::numeric), 1)
      )) as scores
    from visible
  )
  update public.spots s set
    rating_count = agg.n,
    -- With every rating hidden, keep the last scores rather than invent new ones
    scores = case when agg.n > 0 and agg.scores <> '{}'::jsonb then agg.scores else s.scores end
  from agg
  where s.id = p_spot_id;
$$;

-- Drop the rated hours number from every spot's average
select private.recompute_spot_scores(id) from public.spots;

-- ---------------------------------------------------------------------------
-- Tags
-- ---------------------------------------------------------------------------

create or replace function private.valid_tags(t text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select t <@ array[
    'natural_lighting', 'open_late', 'quiet', 'food', 'alcohol', 'ada_accessible', 'bike_racks',
    'transit_nearby', 'outdoor_seating', 'free_parking', 'laptop_friendly', 'wifi_portal',
    'no_wifi_password', 'generous_seating',
    'restrooms', 'drinking_water', 'shade', 'dog_friendly', 'kid_friendly'
  ]::text[];
$$;

-- ---------------------------------------------------------------------------
-- Suggested edits can change what a spot is good for and whether entry is paid
-- ---------------------------------------------------------------------------

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
      where k not in ('name', 'category', 'city', 'address', 'lat', 'lng', 'tags', 'description',
        'operating_hours', 'website', 'good_for', 'paid_entry')
    )
    and (not c ? 'tags' or (jsonb_typeof(c -> 'tags') = 'array'
      and private.valid_tags(array(select jsonb_array_elements_text(c -> 'tags')))))
    and (not c ? 'operating_hours' or private.valid_hours(c -> 'operating_hours'))
    and (not c ? 'website' or coalesce(c ->> 'website', '') = '' or c ->> 'website' ~* '^https?://')
    and (not c ? 'good_for' or (jsonb_typeof(c -> 'good_for') = 'array'
      and jsonb_array_length(c -> 'good_for') >= 1
      and array(select jsonb_array_elements_text(c -> 'good_for')) <@ array['work', 'gather', 'create']::text[]))
    and (not c ? 'paid_entry' or jsonb_typeof(c -> 'paid_entry') = 'boolean');
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
      good_for        = case when c ? 'good_for' then array(select jsonb_array_elements_text(c -> 'good_for')) else good_for end,
      paid_entry      = coalesce((c ->> 'paid_entry')::boolean, paid_entry),
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
revoke execute on function private.valid_scores(jsonb), private.valid_tags(text[]), private.valid_edit_changes(jsonb) from public;
grant execute on function private.valid_scores(jsonb), private.valid_tags(text[]), private.valid_edit_changes(jsonb) to anon, authenticated;
revoke execute on function private.enforce_score_rules() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Two spots that were filed as cafes because nothing else fit
-- ---------------------------------------------------------------------------

update public.spots set category = 'hotel', good_for = '{work,gather}'
  where name = 'The Carpenter Hotel' and category = 'cafe';
update public.spots set category = 'bookstore'
  where name = 'First Light Book Shop' and category = 'cafe';
