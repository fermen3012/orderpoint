-- Create profiles table
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  restaurant_id uuid references public.restaurants(id) on delete cascade,
  role text check (role in ('admin', 'kitchen', 'kiosk', 'owner', 'mesera')) not null default 'admin',
  full_name text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.profiles enable row level security;

-- Policies
create policy "Public profiles are viewable by everyone" on public.profiles
  for select using (true);

create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

-- Function to handle new user profiles
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, restaurant_id, role, full_name)
  values (
    new.id,
    (new.raw_user_meta_data->>'restaurant_id')::uuid,
    coalesce(new.raw_user_meta_data->>'role', 'admin'),
    new.raw_user_meta_data->>'full_name'
  );
  return new;
end;
$$ language plpgsql security definer;

-- Trigger for new user
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
