-- 2026-10-06 — Scan symbol colour per Popcode.
--
-- RUN IN THE SUPABASE SQL EDITOR (prod). Additive and safe to re-run.
--
-- The badge baked into a Popcode's printed photos (Shop orders, My Popcodes →
-- Download) can be the colour symbol (default), black, or white. Chosen in
-- create.html, edit.html and order.html; read wherever the badge is drawn.
-- Owners already UPDATE their own row (2026-09-04-lock-content-tables), which is
-- all this needs — no new policy.
--
-- The pages tolerate this column being missing (they retry without it), so the
-- code can deploy first; until this runs, every Popcode stays on the colour symbol.

begin;

alter table public.collections
  add column if not exists symbol_color text not null default 'color';

alter table public.collections drop constraint if exists collections_symbol_color_check;
alter table public.collections
  add constraint collections_symbol_color_check check (symbol_color in ('color', 'black', 'white'));

commit;

-- PostgREST caches the schema; without this the API can keep answering
-- "column symbol_color does not exist" for a few minutes.
notify pgrst, 'reload schema';
