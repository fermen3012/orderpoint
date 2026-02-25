-- Create tables table
create table public.tables (
  id uuid default uuid_generate_v4() primary key,
  restaurant_id uuid references public.restaurants(id) on delete cascade not null,
  number text not null,
  capacity integer default 2,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(restaurant_id, number)
);

-- Enable RLS
alter table public.tables enable row level security;

-- Policies
create policy "Tables are viewable by everyone" on public.tables for select using (true);
create policy "Authenticated users can manage tables" on public.tables for all using (auth.role() = 'authenticated');

-- Add to Realtime
alter publication supabase_realtime add table public.tables;

-- Seed some tables for the demo restaurant
insert into public.tables (restaurant_id, number, capacity) values
('550e8400-e29b-41d4-a716-446655440000', '1', 4),
('550e8400-e29b-41d4-a716-446655440000', '2', 2),
('550e8400-e29b-41d4-a716-446655440000', '3', 2),
('550e8400-e29b-41d4-a716-446655440000', '4', 6),
('550e8400-e29b-41d4-a716-446655440000', '5', 4),
('550e8400-e29b-41d4-a716-446655440000', '6', 2),
('550e8400-e29b-41d4-a716-446655440000', '7', 2),
('550e8400-e29b-41d4-a716-446655440000', '8', 4);
