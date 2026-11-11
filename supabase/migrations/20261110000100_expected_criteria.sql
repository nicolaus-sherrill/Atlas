-- Which criteria a rating must cover now follows from what the place is, not from a short list of
-- exempt kinds:
--
-- * Food and drink is expected only at food and drink places (cafe, bar, food hall). A library or
--   a bookstore is no longer marked down for not serving food.
-- * Wifi and power are expected only where the spot is listed as good for work, and never
--   outdoors. A bar listed for gathering isn't marked down for having no outlets; a museum listed
--   for work is rated on its wifi.
-- * Seating, atmosphere and access are expected everywhere.
--
-- An optional criterion can still be rated, and then it counts.

create or replace function private.enforce_score_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  cat text;
  purposes text[];
  required text[] := array['seating', 'atmosphere', 'access'];
  missing text;
begin
  if coalesce((select auth.role()), '') not in ('anon', 'authenticated') or public.is_admin() then
    return new;
  end if;

  if tg_table_name = 'spots' then
    cat := new.category;
    purposes := new.good_for;
  else
    select category, good_for into cat, purposes from public.spots where id = new.spot_id;
  end if;

  new.scores := new.scores - 'hours';

  if 'work' = any(purposes) and cat is distinct from 'park' then
    required := required || array['wifi', 'outlets'];
  end if;
  if cat in ('cafe', 'bar', 'food_hall') then
    required := required || array['food'];
  end if;

  select k into missing from unnest(required) as k where not new.scores ? k limit 1;
  if missing is not null then
    raise exception 'A rating here needs a score for %', missing using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke execute on function private.enforce_score_rules() from public, anon, authenticated;

-- Until now every rating had to give food a number, so a place that serves none got a 1. Outside
-- food and drink places that 1 only ever meant "not here": drop it and let the average skip it.
update public.ratings r
  set scores = r.scores - 'food'
  from public.spots s
  where s.id = r.spot_id
    and s.category not in ('cafe', 'bar', 'food_hall')
    and (r.scores ->> 'food')::numeric = 1;

select private.recompute_spot_scores(id) from public.spots where category not in ('cafe', 'bar', 'food_hall');
