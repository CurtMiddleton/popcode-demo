-- Multi-provider print orders (Phase 2: Printify board book).
-- Additive + safe: existing Prodigi rows/flow are unaffected — `provider` defaults
-- to 'prodigi' (which is exactly what finalize/webhook/retry already assume via
-- `order.provider || 'prodigi'`), and `provider_meta` is null for Prodigi orders.
--
-- Run this in the prod Supabase SQL editor BEFORE deploying the create-checkout
-- change that writes these columns, and before testing a board-book order.

alter table print_orders add column if not exists provider text default 'prodigi';
alter table print_orders add column if not exists provider_meta jsonb;
