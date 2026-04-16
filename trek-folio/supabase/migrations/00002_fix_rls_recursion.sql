-- Fix infinite recursion in RLS policies caused by cross-referencing tables
--
-- Original problem: `trips` SELECT policy joined `trip_collaborators` to
-- check membership, and `trip_collaborators` SELECT policy joined `trips`
-- to check ownership. Postgres couldn't evaluate either without evaluating
-- the other → infinite recursion.
--
-- Fix: wrap both lookups in SECURITY DEFINER functions. Functions declared
-- SECURITY DEFINER bypass RLS on tables they query, breaking the cycle.

-- ============================================
-- HELPER FUNCTIONS (bypass RLS via SECURITY DEFINER)
-- ============================================

create or replace function public.is_trip_member(trip_id_check uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.trip_collaborators
    where trip_id = trip_id_check
      and user_id = auth.uid()
  );
$$;

create or replace function public.is_trip_owner(trip_id_check uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.trips
    where id = trip_id_check
      and user_id = auth.uid()
  );
$$;

-- ============================================
-- TRIPS — no longer references trip_collaborators directly
-- ============================================
drop policy if exists "Users can view own trips" on public.trips;
create policy "Users can view own trips"
  on public.trips for select
  using (
    auth.uid() = user_id
    or public.is_trip_member(id)
  );

-- ============================================
-- TRIP_COLLABORATORS — no longer references trips directly
-- ============================================
drop policy if exists "Trip owners can manage collaborators" on public.trip_collaborators;
create policy "Trip owners can manage collaborators"
  on public.trip_collaborators for all
  using (public.is_trip_owner(trip_id));

-- ============================================
-- RESERVATIONS
-- ============================================
drop policy if exists "Users can view own reservations" on public.reservations;
create policy "Users can view own reservations"
  on public.reservations for select
  using (
    auth.uid() = user_id
    or public.is_trip_owner(trip_id)
    or public.is_trip_member(trip_id)
  );

-- ============================================
-- FLIGHTS
-- ============================================
drop policy if exists "Users can view flights via reservation" on public.flights;
create policy "Users can view flights via reservation"
  on public.flights for select
  using (
    exists (
      select 1 from public.reservations r
      where r.id = flights.reservation_id
        and (
          r.user_id = auth.uid()
          or public.is_trip_owner(r.trip_id)
          or public.is_trip_member(r.trip_id)
        )
    )
  );

-- ============================================
-- HOTELS
-- ============================================
drop policy if exists "Users can view hotels via reservation" on public.hotels;
create policy "Users can view hotels via reservation"
  on public.hotels for select
  using (
    exists (
      select 1 from public.reservations r
      where r.id = hotels.reservation_id
        and (
          r.user_id = auth.uid()
          or public.is_trip_owner(r.trip_id)
          or public.is_trip_member(r.trip_id)
        )
    )
  );

-- ============================================
-- PHOTOS
-- ============================================
drop policy if exists "Users can view photos" on public.photos;
create policy "Users can view photos"
  on public.photos for select
  using (
    auth.uid() = user_id
    or public.is_trip_owner(trip_id)
    or public.is_trip_member(trip_id)
  );

-- ============================================
-- WISHLIST_PLACES
-- ============================================
drop policy if exists "Users can view wishlist for accessible trips" on public.wishlist_places;
create policy "Users can view wishlist for accessible trips"
  on public.wishlist_places for select
  using (
    public.is_trip_owner(trip_id)
    or public.is_trip_member(trip_id)
  );
