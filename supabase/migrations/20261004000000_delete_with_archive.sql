-- Removing a spot deletes it. The spots table holds live spots only, so nothing has to filter out
-- removed ones. Before a spot is deleted, a trigger copies it and everything that hangs off it
-- (ratings, edits, reports, crowd reports) into private.deleted_spots, and an admin can restore it
-- from there. Archives older than 90 days are purged whenever another spot is deleted.

-- ---------------------------------------------------------------------------
-- The archive
-- ---------------------------------------------------------------------------

create table private.deleted_spots (
  id bigint generated always as identity primary key,
  spot_id text not null,
  name text not null,
  city text not null,
  -- { spot, ratings, edits, reports, crowd_reports }, each row as it stood at deletion
  snapshot jsonb not null,
  deleted_by uuid,
  deleted_at timestamptz not null default now()
);

create index deleted_spots_deleted_at_idx on private.deleted_spots (deleted_at desc);

create or replace function private.archive_spot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into private.deleted_spots (spot_id, name, city, snapshot, deleted_by)
  values (
    old.id, old.name, old.city,
    jsonb_build_object(
      'spot', to_jsonb(old),
      'ratings', coalesce((select jsonb_agg(to_jsonb(r)) from public.ratings r where r.spot_id = old.id), '[]'::jsonb),
      'edits', coalesce((select jsonb_agg(to_jsonb(e)) from public.spot_edits e where e.spot_id = old.id), '[]'::jsonb),
      'reports', coalesce((select jsonb_agg(to_jsonb(p)) from public.spot_reports p where p.spot_id = old.id), '[]'::jsonb),
      'crowd_reports', coalesce((select jsonb_agg(to_jsonb(c)) from public.crowd_reports c where c.spot_id = old.id), '[]'::jsonb)
    ),
    (select auth.uid())
  );
  delete from private.deleted_spots where deleted_at < now() - interval '90 days';
  return old;
end;
$$;

-- Runs before the delete, so the cascade hasn't yet taken the ratings and reports with it
create trigger spots_archive
  before delete on public.spots
  for each row execute function private.archive_spot();

-- ---------------------------------------------------------------------------
-- Restoring puts rows back as they were. Two insert triggers would rewrite them (a new spot's
-- first rating, a crowd report's timestamp), so both stand aside while a restore runs.
-- ---------------------------------------------------------------------------

create or replace function private.restoring()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(current_setting('atlas.restoring', true), '') = 'on';
$$;

create or replace function private.spot_first_rating()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.restoring() then
    return null;
  end if;
  insert into public.ratings (spot_id, user_id, scores) values (new.id, new.created_by, new.scores);
  return null;
end;
$$;

create or replace function private.crowd_report_local_time()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  tz text;
  local_ts timestamp;
begin
  if private.restoring() then
    return new;
  end if;
  new.reported_at := now();
  select timezone into tz from public.spots where id = new.spot_id;
  local_ts := new.reported_at at time zone coalesce(tz, 'America/Chicago');
  new.day_of_week := extract(dow from local_ts);
  new.hour_of_day := extract(hour from local_ts);
  return new;
end;
$$;

create or replace function public.list_deleted_spots()
returns table (id bigint, spot_id text, name text, city text, rating_count integer, deleted_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  return query
    select d.id, d.spot_id, d.name, d.city, jsonb_array_length(d.snapshot -> 'ratings'), d.deleted_at
    from private.deleted_spots d
    order by d.deleted_at desc;
end;
$$;

create or replace function public.restore_spot(p_archive_id bigint)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  a private.deleted_spots;
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;

  select * into a from private.deleted_spots where id = p_archive_id for update;
  if not found then
    raise exception 'That deleted spot is no longer in the archive.';
  end if;

  perform set_config('atlas.restoring', 'on', true);

  begin
    insert into public.spots select * from jsonb_populate_record(null::public.spots, a.snapshot -> 'spot');
  exception when unique_violation then
    raise exception 'That place is on Atlas again, so this copy can''t be restored.' using errcode = '23505';
  end;

  insert into public.ratings
    select * from jsonb_populate_recordset(null::public.ratings, a.snapshot -> 'ratings');
  insert into public.spot_edits
    select * from jsonb_populate_recordset(null::public.spot_edits, a.snapshot -> 'edits');
  insert into public.spot_reports
    select * from jsonb_populate_recordset(null::public.spot_reports, a.snapshot -> 'reports');
  insert into public.crowd_reports overriding system value
    select * from jsonb_populate_recordset(null::public.crowd_reports, a.snapshot -> 'crowd_reports');

  perform set_config('atlas.restoring', 'off', true);
  perform private.recompute_spot_scores(a.spot_id);
  delete from private.deleted_spots where id = p_archive_id;
  return a.spot_id;
end;
$$;

revoke execute on function public.list_deleted_spots(), public.restore_spot(bigint) from public, anon;
grant execute on function public.list_deleted_spots(), public.restore_spot(bigint) to authenticated;

-- ---------------------------------------------------------------------------
-- Delete what was soft-removed (the trigger archives it), then retire the status column
-- ---------------------------------------------------------------------------

delete from public.spots where status = 'removed';

drop policy "Published spots are public" on public.spots;
drop policy "Anyone can suggest an edit to a published spot" on public.spot_edits;
drop policy "Anyone can report a problem" on public.spot_reports;
drop policy "Anyone can report crowd level" on public.crowd_reports;
drop policy "Anyone signed in can rate a published spot" on public.ratings;
drop index public.spots_osm_place_unique;

alter table public.spots drop column status;

create policy "Spots are public" on public.spots
  for select to anon, authenticated
  using (true);

-- The foreign key already requires the spot to exist
create policy "Anyone can suggest an edit" on public.spot_edits
  for insert to anon, authenticated
  with check (true);

create policy "Anyone can report a problem" on public.spot_reports
  for insert to anon, authenticated
  with check (true);

create policy "Anyone can report crowd level" on public.crowd_reports
  for insert to anon, authenticated
  with check (true);

create policy "Anyone signed in can rate a spot" on public.ratings
  for insert to authenticated
  with check (user_id = (select auth.uid()));

-- One spot per real place
create unique index spots_osm_place_unique on public.spots (osm_type, osm_id) where osm_id is not null;

-- These read status, so they're rewritten without it

create or replace function private.sanitize_public_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce((select auth.role()), '') in ('anon', 'authenticated') and not public.is_admin() then
    new.created_by := (select auth.uid());
    if tg_table_name = 'spots' then
      new.ai_summary := null;
      new.id := gen_random_uuid()::text;
    elsif tg_table_name = 'spot_edits' then
      new.status := 'pending';
      new.reviewed_at := null;
    elsif tg_table_name = 'spot_reports' then
      new.status := 'open';
      new.resolved_at := null;
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.crowd_status_all()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_object_agg(spot_id, jsonb_build_object(
    'level', level,
    'label', private.busyness_label(level),
    'lastReportedAt', last_reported_at,
    'reportCount', report_count
  )), '{}'::jsonb)
  from (
    select c.spot_id,
      round(avg(c.level))::integer as level,
      max(c.reported_at) as last_reported_at,
      count(*) as report_count
    from public.crowd_reports c
    where c.reported_at >= now() - interval '3 hours'
    group by c.spot_id
  ) live;
$$;

create or replace function public.crowd_status(p_spot_id text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with live as (
    select round(avg(level))::integer as level, max(reported_at) as last_reported_at, count(*) as report_count
    from public.crowd_reports
    where spot_id = p_spot_id and reported_at >= now() - interval '3 hours'
  ),
  hourly as (
    select day_of_week, hour_of_day, round(avg(level), 1) as avg_level, count(*) as n
    from public.crowd_reports
    where spot_id = p_spot_id
    group by day_of_week, hour_of_day
  )
  select jsonb_build_object(
    'spotId', p_spot_id,
    'current', (
      select case when live.report_count = 0 then null else jsonb_build_object(
        'level', live.level,
        'label', private.busyness_label(live.level),
        'lastReportedAt', live.last_reported_at,
        'reportCount', live.report_count
      ) end from live
    ),
    'hourlyAverages', coalesce((
      select jsonb_agg(jsonb_build_object(
        'dayOfWeek', day_of_week, 'hourOfDay', hour_of_day, 'avgLevel', avg_level, 'count', n
      ) order by day_of_week, hour_of_day) from hourly
    ), '[]'::jsonb)
  )
  where exists (select 1 from public.spots where id = p_spot_id);
$$;
