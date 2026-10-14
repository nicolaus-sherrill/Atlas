-- Reviews from many people. Anyone can write one review of a spot, the same quiet anonymous identity
-- as rating, and change or delete it later. A review goes live at once; admins hide spam. Reviews
-- are separate from ratings: either can exist without the other. The spot's own description stays
-- as its first entry, "from the person who added it", and reviews follow it. Decided 2026-10-14.

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  spot_id text not null references public.spots (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  status text not null default 'visible' check (status in ('visible', 'hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reviews_one_per_person unique (spot_id, user_id)
);

create index reviews_spot_visible_idx on public.reviews (spot_id, created_at desc) where status = 'visible';
create index reviews_user_idx on public.reviews (user_id);

-- Writers set the text and nothing else: not whose review it is, its spot once written, or whether
-- it shows
create or replace function private.sanitize_review()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce((select auth.role()), '') in ('anon', 'authenticated') and not public.is_admin() then
    new.user_id := (select auth.uid());
    new.status := case when tg_op = 'UPDATE' then old.status else 'visible' end;
    new.spot_id := case when tg_op = 'UPDATE' then old.spot_id else new.spot_id end;
    new.created_at := case when tg_op = 'UPDATE' then old.created_at else now() end;
  end if;
  new.body := btrim(new.body);
  if not private.restoring() then
    new.updated_at := now();
  end if;
  return new;
end;
$$;

create trigger reviews_sanitize
  before insert or update on public.reviews
  for each row execute function private.sanitize_review();

create trigger reviews_rate_limit before insert on public.reviews
  for each row execute function private.enforce_rate_limit('20');

-- ---------------------------------------------------------------------------
-- Access. Nobody reads the table directly except a writer, their own row, and admins. Everyone
-- reads visible reviews through spot_reviews(), which leaves out who wrote them.
-- ---------------------------------------------------------------------------

alter table public.reviews enable row level security;

grant select, insert, update, delete on public.reviews to authenticated;

create policy "Writers see their own review; admins see all" on public.reviews
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy "Anyone signed in can review a spot" on public.reviews
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "Writers change their own review; admins moderate" on public.reviews
  for update to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()))
  with check (user_id = (select auth.uid()) or (select public.is_admin()));

create policy "Writers remove their own review; admins remove any" on public.reviews
  for delete to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

create or replace function public.spot_reviews(p_spot_id text)
returns table (id uuid, body text, created_at timestamptz, updated_at timestamptz, mine boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.body, r.created_at, r.updated_at, r.user_id is not distinct from (select auth.uid()) and r.user_id is not null
  from public.reviews r
  where r.spot_id = p_spot_id and r.status = 'visible'
  order by r.created_at desc
  limit 200;
$$;

revoke execute on function public.spot_reviews(text) from public;
grant execute on function public.spot_reviews(text) to anon, authenticated;

-- Admins hide or show one review
create or replace function public.set_review_status(p_review_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can moderate reviews' using errcode = '42501';
  end if;
  if p_status not in ('visible', 'hidden') then
    raise exception 'Status must be visible or hidden';
  end if;
  update public.reviews set status = p_status where id = p_review_id;
end;
$$;

revoke execute on function public.set_review_status(uuid, text) from public, anon;
grant execute on function public.set_review_status(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Deleting a spot archives its reviews with everything else, and restoring brings them back
-- ---------------------------------------------------------------------------

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
      'reviews', coalesce((select jsonb_agg(to_jsonb(v)) from public.reviews v where v.spot_id = old.id), '[]'::jsonb),
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
  -- Archives made before reviews existed have no reviews key
  insert into public.reviews
    select * from jsonb_populate_recordset(null::public.reviews, coalesce(a.snapshot -> 'reviews', '[]'::jsonb));
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

revoke execute on function public.restore_spot(bigint) from public, anon;
grant execute on function public.restore_spot(bigint) to authenticated;
