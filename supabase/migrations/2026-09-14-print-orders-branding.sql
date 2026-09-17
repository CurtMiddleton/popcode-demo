-- Per-order Prodigi branding (the companion postcard insert).
--
-- The card is NOT a line item: it is placed in the box by the fulfilling lab,
-- so it never appears in `items` or the quote. Its artwork URL is resolved at
-- checkout (from the order's slug) and stored here, so order submission needs
-- no further lookup.
--
-- Shape mirrors Prodigi's order schema:
--   { "postcard": { "url": "https://…/{slug}/companion-card.png" } }
alter table print_orders add column if not exists branding jsonb;
