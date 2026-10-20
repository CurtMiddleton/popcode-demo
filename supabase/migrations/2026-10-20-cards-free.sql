-- Holiday cards don't count toward the Popcode limit, like books.
--
-- Additive, replaces one function. RUN IN THE SUPABASE SQL EDITOR (prod).
-- Depends on 2026-10-18-books-not-counted.sql.
--
-- A card (collections.kind = 'card', made in public/card.html) is a Shop
-- design whose front photo is a Popcode. Without this it counts as one of the
-- free plan's five, so someone who has used theirs can't make a card at all.
-- popcode_free_kind() is the single list the count, the insert trigger and
-- order settlement all read, so adding 'card' here covers all three.

create or replace function public.popcode_free_kind(k text)
returns boolean language sql immutable as $$
  select coalesce(k, '') in ('book', 'calendar', 'boardbook', 'card')
$$;
