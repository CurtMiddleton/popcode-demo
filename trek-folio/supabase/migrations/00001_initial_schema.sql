-- Trek Folio: Initial database schema
-- Run this in Supabase SQL Editor to set up all tables

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ============================================
-- USERS (extends Supabase auth.users)
-- ============================================
create table public.users (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  name text,
  avatar_url text,
  home_city text,
  forwarding_alias text unique default (
    lower(substr(md5(random()::text), 1, 10))
  ),
  created_at timestamptz default now() not null
);

-- Auto-create a public.users row when someone signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================
-- TRIPS
-- ============================================
create table public.trips (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.users on delete cascade not null,
  name text not null,
  destination text,
  start_date date,
  end_date date,
  cover_image_url text,
  created_at timestamptz default now() not null
);

create index idx_trips_user_id on public.trips(user_id);
create index idx_trips_dates on public.trips(start_date, end_date);

-- ============================================
-- RESERVATIONS
-- ============================================
create type reservation_type as enum (
  'flight', 'hotel', 'restaurant', 'bar', 'activity', 'car_rental'
);

create table public.reservations (
  id uuid primary key default uuid_generate_v4(),
  trip_id uuid references public.trips on delete cascade,
  user_id uuid references public.users on delete cascade not null,
  type reservation_type not null,
  provider_name text,
  confirmation_number text,
  start_datetime timestamptz,
  end_datetime timestamptz,
  address text,
  lat double precision,
  lng double precision,
  google_place_id text,
  price numeric(10,2),
  currency text default 'USD',
  raw_email_body text,
  parsed_data jsonb,
  notes text,
  created_at timestamptz default now() not null
);

create index idx_reservations_trip_id on public.reservations(trip_id);
create index idx_reservations_user_id on public.reservations(user_id);
create index idx_reservations_type on public.reservations(type);
create index idx_reservations_dates on public.reservations(start_datetime, end_datetime);

-- ============================================
-- FLIGHTS (type-specific details)
-- ============================================
create table public.flights (
  id uuid primary key default uuid_generate_v4(),
  reservation_id uuid references public.reservations on delete cascade not null unique,
  airline text,
  flight_number text,
  origin_airport text,
  dest_airport text,
  departure_time timestamptz,
  arrival_time timestamptz,
  terminal text,
  gate text,
  seat text,
  booking_class text,
  layovers jsonb default '[]'::jsonb
);

create index idx_flights_reservation_id on public.flights(reservation_id);

-- ============================================
-- HOTELS (type-specific details)
-- ============================================
create table public.hotels (
  id uuid primary key default uuid_generate_v4(),
  reservation_id uuid references public.reservations on delete cascade not null unique,
  hotel_name text,
  address text,
  check_in timestamptz,
  check_out timestamptz,
  room_type text,
  phone text,
  website text,
  google_place_id text
);

create index idx_hotels_reservation_id on public.hotels(reservation_id);

-- ============================================
-- PHOTOS
-- ============================================
create table public.photos (
  id uuid primary key default uuid_generate_v4(),
  trip_id uuid references public.trips on delete cascade not null,
  user_id uuid references public.users on delete cascade not null,
  storage_url text not null,
  caption text,
  taken_at timestamptz,
  reservation_id uuid references public.reservations on delete set null,
  day_index integer,
  created_at timestamptz default now() not null
);

create index idx_photos_trip_id on public.photos(trip_id);

-- ============================================
-- TRIP SHARES (public read-only links)
-- ============================================
create table public.trip_shares (
  id uuid primary key default uuid_generate_v4(),
  trip_id uuid references public.trips on delete cascade not null,
  share_token text unique not null default (
    lower(substr(md5(random()::text), 1, 12))
  ),
  can_edit boolean default false,
  expires_at timestamptz,
  created_at timestamptz default now() not null
);

create index idx_trip_shares_token on public.trip_shares(share_token);
create index idx_trip_shares_trip_id on public.trip_shares(trip_id);

-- ============================================
-- TRIP COLLABORATORS
-- ============================================
create table public.trip_collaborators (
  id uuid primary key default uuid_generate_v4(),
  trip_id uuid references public.trips on delete cascade not null,
  user_id uuid references public.users on delete cascade,
  role text check (role in ('viewer', 'editor')) default 'viewer',
  invited_email text,
  accepted_at timestamptz,
  created_at timestamptz default now() not null,
  unique(trip_id, user_id)
);

create index idx_trip_collaborators_trip_id on public.trip_collaborators(trip_id);
create index idx_trip_collaborators_user_id on public.trip_collaborators(user_id);

-- ============================================
-- WISHLIST PLACES
-- ============================================
create table public.wishlist_places (
  id uuid primary key default uuid_generate_v4(),
  trip_id uuid references public.trips on delete cascade not null,
  name text not null,
  address text,
  lat double precision,
  lng double precision,
  google_place_id text,
  category text,
  notes text,
  created_at timestamptz default now() not null
);

create index idx_wishlist_places_trip_id on public.wishlist_places(trip_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Enable RLS on all tables
alter table public.users enable row level security;
alter table public.trips enable row level security;
alter table public.reservations enable row level security;
alter table public.flights enable row level security;
alter table public.hotels enable row level security;
alter table public.photos enable row level security;
alter table public.trip_shares enable row level security;
alter table public.trip_collaborators enable row level security;
alter table public.wishlist_places enable row level security;

-- USERS: users can read/update their own profile
create policy "Users can view own profile"
  on public.users for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.users for update
  using (auth.uid() = id);

-- TRIPS: owners and collaborators can access
create policy "Users can view own trips"
  on public.trips for select
  using (
    auth.uid() = user_id
    or id in (
      select trip_id from public.trip_collaborators
      where user_id = auth.uid()
    )
  );

create policy "Users can create trips"
  on public.trips for insert
  with check (auth.uid() = user_id);

create policy "Users can update own trips"
  on public.trips for update
  using (auth.uid() = user_id);

create policy "Users can delete own trips"
  on public.trips for delete
  using (auth.uid() = user_id);

-- RESERVATIONS: accessible by trip owner and collaborators
create policy "Users can view own reservations"
  on public.reservations for select
  using (
    auth.uid() = user_id
    or trip_id in (
      select id from public.trips where user_id = auth.uid()
    )
    or trip_id in (
      select trip_id from public.trip_collaborators
      where user_id = auth.uid()
    )
  );

create policy "Users can create reservations"
  on public.reservations for insert
  with check (auth.uid() = user_id);

create policy "Users can update own reservations"
  on public.reservations for update
  using (auth.uid() = user_id);

create policy "Users can delete own reservations"
  on public.reservations for delete
  using (auth.uid() = user_id);

-- FLIGHTS: follow reservation access
create policy "Users can view flights via reservation"
  on public.flights for select
  using (
    reservation_id in (
      select id from public.reservations
      where user_id = auth.uid()
      or trip_id in (select id from public.trips where user_id = auth.uid())
      or trip_id in (select trip_id from public.trip_collaborators where user_id = auth.uid())
    )
  );

create policy "Users can manage own flights"
  on public.flights for insert
  with check (
    reservation_id in (
      select id from public.reservations where user_id = auth.uid()
    )
  );

create policy "Users can update own flights"
  on public.flights for update
  using (
    reservation_id in (
      select id from public.reservations where user_id = auth.uid()
    )
  );

create policy "Users can delete own flights"
  on public.flights for delete
  using (
    reservation_id in (
      select id from public.reservations where user_id = auth.uid()
    )
  );

-- HOTELS: follow reservation access
create policy "Users can view hotels via reservation"
  on public.hotels for select
  using (
    reservation_id in (
      select id from public.reservations
      where user_id = auth.uid()
      or trip_id in (select id from public.trips where user_id = auth.uid())
      or trip_id in (select trip_id from public.trip_collaborators where user_id = auth.uid())
    )
  );

create policy "Users can manage own hotels"
  on public.hotels for insert
  with check (
    reservation_id in (
      select id from public.reservations where user_id = auth.uid()
    )
  );

create policy "Users can update own hotels"
  on public.hotels for update
  using (
    reservation_id in (
      select id from public.reservations where user_id = auth.uid()
    )
  );

create policy "Users can delete own hotels"
  on public.hotels for delete
  using (
    reservation_id in (
      select id from public.reservations where user_id = auth.uid()
    )
  );

-- PHOTOS: trip owner and collaborators
create policy "Users can view photos"
  on public.photos for select
  using (
    auth.uid() = user_id
    or trip_id in (select id from public.trips where user_id = auth.uid())
    or trip_id in (select trip_id from public.trip_collaborators where user_id = auth.uid())
  );

create policy "Users can upload photos"
  on public.photos for insert
  with check (auth.uid() = user_id);

create policy "Users can update own photos"
  on public.photos for update
  using (auth.uid() = user_id);

create policy "Users can delete own photos"
  on public.photos for delete
  using (auth.uid() = user_id);

-- TRIP SHARES: trip owner can manage, anyone with token can read
create policy "Trip owners can manage shares"
  on public.trip_shares for all
  using (
    trip_id in (select id from public.trips where user_id = auth.uid())
  );

-- Allow anonymous access to trip shares by token (for share links)
create policy "Anyone can read shares by token"
  on public.trip_shares for select
  using (true);

-- TRIP COLLABORATORS: trip owner can manage
create policy "Trip owners can manage collaborators"
  on public.trip_collaborators for all
  using (
    trip_id in (select id from public.trips where user_id = auth.uid())
  );

create policy "Collaborators can view their own entries"
  on public.trip_collaborators for select
  using (auth.uid() = user_id);

-- WISHLIST PLACES: follow trip access
create policy "Users can view wishlist for accessible trips"
  on public.wishlist_places for select
  using (
    trip_id in (select id from public.trips where user_id = auth.uid())
    or trip_id in (select trip_id from public.trip_collaborators where user_id = auth.uid())
  );

create policy "Users can manage wishlist on own trips"
  on public.wishlist_places for insert
  with check (
    trip_id in (select id from public.trips where user_id = auth.uid())
  );

create policy "Users can update wishlist on own trips"
  on public.wishlist_places for update
  using (
    trip_id in (select id from public.trips where user_id = auth.uid())
  );

create policy "Users can delete wishlist on own trips"
  on public.wishlist_places for delete
  using (
    trip_id in (select id from public.trips where user_id = auth.uid())
  );

-- ============================================
-- STORAGE BUCKETS
-- ============================================
-- Run these in Supabase dashboard or via API:
-- insert into storage.buckets (id, name, public) values ('trip-photos', 'trip-photos', true);
-- insert into storage.buckets (id, name, public) values ('trip-covers', 'trip-covers', true);
-- insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true);
