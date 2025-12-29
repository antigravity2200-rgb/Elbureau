-- Enable the Realtime extension (if not already enabled)
-- In Supabase Dashboard: Database -> Replication -> Enable for 'rooms' table (after creation)

-- 1. Create the 'rooms' table
create table public.rooms (
  id text primary key, -- The 4-digit room code
  host_id text not null, -- The ID of the host player
  game_state jsonb not null, -- The full game state blob
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Enable Row Level Security (RLS)
alter table public.rooms enable row level security;

-- 3. Create RLS Policies
-- Allow anyone to read rooms (simplifies joining logic)
create policy "Enable read access for all users"
on public.rooms for select
to public
using (true);

-- Allow anyone to insert (create) a room
create policy "Enable insert for all users"
on public.rooms for insert
to public
with check (true);

-- Allow anyone to update a room (in this simple version, we trust the clients/host)
-- In a stricter app, only the host should update, but for this game, we'll keep it open
-- to avoid complex auth for now (since we are using anonymous id logic).
create policy "Enable update for all users"
on public.rooms for update
to public
using (true);

-- 4. Enable Realtime for this table
-- This is critical! Run this command to ensure clients receive updates.
alter publication supabase_realtime add table public.rooms;
