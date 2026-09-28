-- Atlas: shared, community-contributed map of work spots.
--
-- Who can do what (enforced below with row-level security):
--   anyone   read published spots, add a spot, suggest an edit, report a problem, report crowd level
--   admins   everything above, plus approve or reject edits, resolve reports, remove or delete spots
-- Accounts are optional today. Rows carry a nullable created_by so saved lists and other
-- signed-in features can attach to users later without a schema rewrite.

create extension if not exists pgcrypto with schema extensions;

-- `private` is never exposed through the API. Visitors may call its validation helpers (check
-- constraints run as the visitor), but no table in it is granted to them.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Admins
-- ---------------------------------------------------------------------------

create table private.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  added_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from private.admins where user_id = (select auth.uid()));
$$;

-- ---------------------------------------------------------------------------
-- Validation helpers
-- ---------------------------------------------------------------------------

create or replace function private.valid_scores(s jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(s) = 'object'
    and (select count(*) from jsonb_object_keys(s)) = 6
    and (
      select bool_and(
        k in ('wifi', 'outlets', 'food', 'atmosphere', 'hours', 'access')
        and jsonb_typeof(s -> k) = 'number'
        and (s ->> k)::numeric between 1 and 5
      )
      from jsonb_object_keys(s) as k
    );
$$;

create or replace function private.valid_tags(t text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select t <@ array[
    'natural_lighting', 'open_late', 'quiet', 'food', 'alcohol', 'ada_accessible', 'bike_racks',
    'transit_nearby', 'outdoor_seating', 'free_parking', 'laptop_friendly', 'wifi_portal',
    'no_wifi_password', 'generous_seating'
  ]::text[];
$$;

-- Seven days, each { closed: bool, open: "HH:MM", close: "HH:MM" }
create or replace function private.valid_hours(h jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select h is null or (
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

-- An edit may only touch these fields, and each must itself be valid
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
      where k not in ('name', 'category', 'city', 'address', 'lat', 'lng', 'scores', 'tags', 'description', 'operating_hours')
    )
    and (not c ? 'scores' or private.valid_scores(c -> 'scores'))
    and (not c ? 'tags' or (jsonb_typeof(c -> 'tags') = 'array'
      and private.valid_tags(array(select jsonb_array_elements_text(c -> 'tags')))))
    and (not c ? 'operating_hours' or private.valid_hours(c -> 'operating_hours'));
$$;

-- ---------------------------------------------------------------------------
-- Spots
-- ---------------------------------------------------------------------------

create table public.spots (
  id text primary key default gen_random_uuid()::text,
  name text not null check (char_length(btrim(name)) between 1 and 200),
  category text not null check (category in ('cafe', 'library', 'coworking', 'park')),
  city text not null default '' check (char_length(city) <= 100),
  address text not null default '' check (char_length(address) <= 300),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  timezone text not null default 'America/Chicago',
  scores jsonb not null check (private.valid_scores(scores)),
  tags text[] not null default '{}' check (private.valid_tags(tags)),
  description text not null default '' check (char_length(description) <= 2000),
  ai_summary text check (char_length(ai_summary) <= 1000),
  operating_hours jsonb check (private.valid_hours(operating_hours)),
  status text not null default 'published' check (status in ('published', 'removed')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index spots_status_idx on public.spots (status);

-- ---------------------------------------------------------------------------
-- Suggested edits: queued until an admin approves or rejects them
-- ---------------------------------------------------------------------------

create table public.spot_edits (
  id uuid primary key default gen_random_uuid(),
  spot_id text not null references public.spots (id) on delete cascade,
  -- Only these keys are applied on approval; anything else is ignored.
  changes jsonb not null check (private.valid_edit_changes(changes)),
  note text not null default '' check (char_length(note) <= 1000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index spot_edits_pending_idx on public.spot_edits (created_at) where status = 'pending';

-- ---------------------------------------------------------------------------
-- Problem reports: "this place closed", "wrong info", and so on
-- ---------------------------------------------------------------------------

create table public.spot_reports (
  id uuid primary key default gen_random_uuid(),
  spot_id text not null references public.spots (id) on delete cascade,
  reason text not null check (reason in ('closed', 'wrong_info', 'duplicate', 'inappropriate', 'other')),
  details text not null default '' check (char_length(details) <= 1000),
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index spot_reports_open_idx on public.spot_reports (created_at) where status = 'open';

-- ---------------------------------------------------------------------------
-- Crowd reports: anonymous busyness check-ins, 1 (not busy) to 4 (very busy)
-- ---------------------------------------------------------------------------

create table public.crowd_reports (
  id bigint generated always as identity primary key,
  spot_id text not null references public.spots (id) on delete cascade,
  level smallint not null check (level between 1 and 4),
  reported_at timestamptz not null default now(),
  -- Local to the spot, set by trigger, so hourly averages line up with the spot's own day
  day_of_week smallint not null default 0,
  hour_of_day smallint not null default 0
);

create index crowd_reports_spot_time_idx on public.crowd_reports (spot_id, reported_at desc);

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
  new.reported_at := now();
  select timezone into tz from public.spots where id = new.spot_id;
  local_ts := new.reported_at at time zone coalesce(tz, 'America/Chicago');
  new.day_of_week := extract(dow from local_ts);
  new.hour_of_day := extract(hour from local_ts);
  return new;
end;
$$;

create trigger crowd_reports_local_time
  before insert on public.crowd_reports
  for each row execute function private.crowd_report_local_time();

-- ---------------------------------------------------------------------------
-- Housekeeping triggers
-- ---------------------------------------------------------------------------

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger spots_touch_updated_at
  before update on public.spots
  for each row execute function private.touch_updated_at();

-- Visitors can't choose their own status, author, or AI summary. Admins and the server can.
create or replace function private.sanitize_public_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce((select auth.role()), '') in ('anon', 'authenticated') and not public.is_admin() then
    new.created_by := (select auth.uid());
    if tg_table_name = 'spots' then
      new.status := 'published';
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

create trigger spots_sanitize before insert on public.spots
  for each row execute function private.sanitize_public_insert();
create trigger spot_edits_sanitize before insert on public.spot_edits
  for each row execute function private.sanitize_public_insert();
create trigger spot_reports_sanitize before insert on public.spot_reports
  for each row execute function private.sanitize_public_insert();

-- ---------------------------------------------------------------------------
-- Rate limits per visitor, keyed on a hash of their IP address (the IP itself is never stored)
-- ---------------------------------------------------------------------------

create table private.rate_limits (
  bucket text not null,
  client_hash text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (bucket, client_hash, window_start)
);

create or replace function private.enforce_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  headers json;
  v_ip text;
  v_hash text;
  max_per_hour integer := tg_argv[0]::integer;
  this_window timestamptz := date_trunc('hour', now());
  current_hits integer;
begin
  -- Admins and server-side jobs are exempt
  if coalesce((select auth.role()), '') not in ('anon', 'authenticated') or public.is_admin() then
    return new;
  end if;

  headers := nullif(current_setting('request.headers', true), '')::json;
  v_ip := coalesce(
    headers ->> 'cf-connecting-ip',
    split_part(headers ->> 'x-forwarded-for', ',', 1),
    'unknown'
  );
  v_hash := encode(extensions.digest(v_ip || tg_table_name, 'sha256'), 'hex');

  insert into private.rate_limits as r (bucket, client_hash, window_start, hits)
  values (tg_table_name, v_hash, this_window, 1)
  on conflict (bucket, client_hash, window_start) do update set hits = r.hits + 1
  returning hits into current_hits;

  if current_hits > max_per_hour then
    raise exception 'Too many submissions. Please try again later.' using errcode = 'P0429';
  end if;

  -- Opportunistic cleanup of old windows
  delete from private.rate_limits where window_start < now() - interval '1 day';
  return new;
end;
$$;

create trigger spots_rate_limit before insert on public.spots
  for each row execute function private.enforce_rate_limit('10');
create trigger spot_edits_rate_limit before insert on public.spot_edits
  for each row execute function private.enforce_rate_limit('20');
create trigger spot_reports_rate_limit before insert on public.spot_reports
  for each row execute function private.enforce_rate_limit('20');
create trigger crowd_reports_rate_limit before insert on public.crowd_reports
  for each row execute function private.enforce_rate_limit('30');

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.spots enable row level security;
alter table public.spot_edits enable row level security;
alter table public.spot_reports enable row level security;
alter table public.crowd_reports enable row level security;

grant select, insert on public.spots to anon, authenticated;
grant update, delete on public.spots to authenticated;
grant insert on public.spot_edits, public.spot_reports to anon, authenticated;
grant select, update, delete on public.spot_edits, public.spot_reports to authenticated;
grant insert on public.crowd_reports to anon, authenticated;
grant select, delete on public.crowd_reports to authenticated;

create policy "Published spots are public" on public.spots
  for select to anon, authenticated
  using (status = 'published' or (select public.is_admin()));

create policy "Anyone can add a spot" on public.spots
  for insert to anon, authenticated
  with check (true);

create policy "Admins update spots" on public.spots
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "Admins delete spots" on public.spots
  for delete to authenticated
  using ((select public.is_admin()));

create policy "Anyone can suggest an edit to a published spot" on public.spot_edits
  for insert to anon, authenticated
  with check (exists (select 1 from public.spots s where s.id = spot_id and s.status = 'published'));

create policy "Admins manage edits" on public.spot_edits
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "Anyone can report a problem" on public.spot_reports
  for insert to anon, authenticated
  with check (exists (select 1 from public.spots s where s.id = spot_id and s.status = 'published'));

create policy "Admins manage reports" on public.spot_reports
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "Anyone can report crowd level" on public.crowd_reports
  for insert to anon, authenticated
  with check (exists (select 1 from public.spots s where s.id = spot_id and s.status = 'published'));

create policy "Admins read raw crowd reports" on public.crowd_reports
  for select to authenticated
  using ((select public.is_admin()));

create policy "Admins delete crowd reports" on public.crowd_reports
  for delete to authenticated
  using ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- Crowd status: public aggregates only, never the raw reports
-- ---------------------------------------------------------------------------

create or replace function private.busyness_label(level integer)
returns text
language sql
immutable
set search_path = ''
as $$
  select case level
    when 1 then 'Not busy'
    when 2 then 'A little busy'
    when 3 then 'Busy'
    when 4 then 'Very busy'
    else 'Unknown'
  end;
$$;

-- { "<spot id>": { level, label, lastReportedAt, reportCount } } for reports in the last 3 hours
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
    join public.spots s on s.id = c.spot_id and s.status = 'published'
    where c.reported_at >= now() - interval '3 hours'
    group by c.spot_id
  ) live;
$$;

-- { spotId, current: {...} | null, hourlyAverages: [{ dayOfWeek, hourOfDay, avgLevel, count }] }
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
  where exists (select 1 from public.spots where id = p_spot_id and status = 'published');
$$;

grant execute on function public.crowd_status_all() to anon, authenticated;
grant execute on function public.crowd_status(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Moderation, for the admin page
-- ---------------------------------------------------------------------------

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
