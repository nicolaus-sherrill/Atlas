-- Community ratings. Anyone can rate any spot on the six workability categories; a spot's scores
-- are the average of its visible ratings. Each person has one rating per spot, and rating again
-- replaces it. "Person" is a Supabase user, and visitors get an anonymous one the first time they
-- contribute, so rating needs no sign-up. Admins hide spam ratings, singly or every rating from
-- one rater, and the averages recompute.

create table public.ratings (
  id uuid primary key default gen_random_uuid(),
  spot_id text not null references public.spots (id) on delete cascade,
  -- Null only for the starter ratings that came with the original seed data
  user_id uuid references auth.users (id) on delete set null,
  scores jsonb not null check (private.valid_scores(scores)),
  status text not null default 'visible' check (status in ('visible', 'hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Nulls are distinct, so this allows any number of starter ratings
  constraint ratings_one_per_person unique (spot_id, user_id)
);

create index ratings_spot_visible_idx on public.ratings (spot_id) where status = 'visible';
create index ratings_user_idx on public.ratings (user_id);

alter table public.spots add column rating_count integer not null default 0;

-- Starter spots: their existing scores become one starter rating each
insert into public.ratings (spot_id, user_id, scores, created_at)
select id, created_by, scores, created_at from public.spots;

-- ---------------------------------------------------------------------------
-- Keep each spot's scores equal to the average of its visible ratings
-- ---------------------------------------------------------------------------

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
      jsonb_build_object(
        'wifi',       round(avg((scores ->> 'wifi')::numeric), 1),
        'outlets',    round(avg((scores ->> 'outlets')::numeric), 1),
        'food',       round(avg((scores ->> 'food')::numeric), 1),
        'atmosphere', round(avg((scores ->> 'atmosphere')::numeric), 1),
        'hours',      round(avg((scores ->> 'hours')::numeric), 1),
        'access',     round(avg((scores ->> 'access')::numeric), 1)
      ) as scores
    from visible
  )
  update public.spots s set
    rating_count = agg.n,
    -- With every rating hidden, keep the last scores rather than invent new ones
    scores = case when agg.n > 0 then agg.scores else s.scores end
  from agg
  where s.id = p_spot_id;
$$;

create or replace function private.ratings_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform private.recompute_spot_scores(old.spot_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') and (tg_op = 'INSERT' or new.spot_id <> old.spot_id) then
    perform private.recompute_spot_scores(new.spot_id);
  end if;
  return null;
end;
$$;

create trigger ratings_recompute
  after insert or update or delete on public.ratings
  for each row execute function private.ratings_changed();

select private.recompute_spot_scores(id) from public.spots;

-- The person who adds a spot gives it its first rating
create or replace function private.spot_first_rating()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.ratings (spot_id, user_id, scores) values (new.id, new.created_by, new.scores);
  return null;
end;
$$;

create trigger spots_first_rating
  after insert on public.spots
  for each row execute function private.spot_first_rating();

-- Raters set their scores and nothing else: not whose rating it is, and not its visibility
create or replace function private.sanitize_rating()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce((select auth.role()), '') in ('anon', 'authenticated') and not public.is_admin() then
    new.user_id := (select auth.uid());
    new.status := case when tg_op = 'UPDATE' then old.status else 'visible' end;
    new.spot_id := case when tg_op = 'UPDATE' then old.spot_id else new.spot_id end;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger ratings_sanitize
  before insert or update on public.ratings
  for each row execute function private.sanitize_rating();

create trigger ratings_rate_limit before insert on public.ratings
  for each row execute function private.enforce_rate_limit('30');

-- Scores now come from ratings, so a suggested edit can no longer change them
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
    and (not c ? 'website' or c ->> 'website' ~* '^https?://');
$$;

-- ---------------------------------------------------------------------------
-- Access
-- ---------------------------------------------------------------------------

alter table public.ratings enable row level security;

-- Rating requires a session, anonymous or real; the app creates an anonymous one when needed
grant select, insert, update, delete on public.ratings to authenticated;

create policy "Raters see their own ratings; admins see all" on public.ratings
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy "Anyone signed in can rate a published spot" on public.ratings
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.spots s where s.id = spot_id and s.status = 'published')
  );

create policy "Raters change their own rating; admins moderate" on public.ratings
  for update to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()))
  with check (user_id = (select auth.uid()) or (select public.is_admin()));

create policy "Raters remove their own rating; admins remove any" on public.ratings
  for delete to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

-- ---------------------------------------------------------------------------
-- Moderation, for the admin page
-- ---------------------------------------------------------------------------

-- Hide or restore every rating one person has given, for clearing a spam wave in one step
create or replace function public.set_rater_ratings_status(p_user_id uuid, p_status text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed integer;
begin
  if not public.is_admin() then
    raise exception 'Only admins can moderate ratings' using errcode = '42501';
  end if;
  if p_status not in ('visible', 'hidden') then
    raise exception 'Status must be visible or hidden';
  end if;
  update public.ratings set status = p_status where user_id = p_user_id and status <> p_status;
  get diagnostics changed = row_count;
  return changed;
end;
$$;

revoke execute on function public.set_rater_ratings_status(uuid, text) from public, anon;
grant execute on function public.set_rater_ratings_status(uuid, text) to authenticated;
revoke execute on function private.valid_edit_changes(jsonb) from public;
grant execute on function private.valid_edit_changes(jsonb) to anon, authenticated;
