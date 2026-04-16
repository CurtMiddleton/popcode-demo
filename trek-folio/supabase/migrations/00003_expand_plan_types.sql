-- Expand reservation_type enum to support TripIt-style plan types.
-- New values: concert, parking, cruise, rail, ferry, theater, tour,
-- meeting, transportation, note, directions
--
-- Postgres requires ALTER TYPE ... ADD VALUE to be run outside a
-- transaction block. Run each statement separately if your migration
-- runner wraps in transactions. In Supabase SQL Editor it works fine.

alter type reservation_type add value if not exists 'concert';
alter type reservation_type add value if not exists 'parking';
alter type reservation_type add value if not exists 'cruise';
alter type reservation_type add value if not exists 'rail';
alter type reservation_type add value if not exists 'ferry';
alter type reservation_type add value if not exists 'theater';
alter type reservation_type add value if not exists 'tour';
alter type reservation_type add value if not exists 'meeting';
alter type reservation_type add value if not exists 'transportation';
alter type reservation_type add value if not exists 'note';
alter type reservation_type add value if not exists 'directions';

-- Note: type-specific columns continue to live in the existing
-- `flights` and `hotels` sub-tables. For the new types we use the
-- generic reservations row + parsed_data JSONB column. Specialized
-- sub-tables (cruises, concerts, etc.) can be added later if/when
-- they need structured queries.
