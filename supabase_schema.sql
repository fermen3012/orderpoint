-- Enable necessary extensions
create extension if not exists "uuid-ossp";

-- 1. Restaurants Table
create table public.restaurants (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  logo_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Categories Table
create table public.categories (
  id uuid default uuid_generate_v4() primary key,
  restaurant_id uuid references public.restaurants(id) on delete cascade not null,
  name text not null,
  image_url text,
  sort_order integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Products Table
create table public.products (
  id uuid default uuid_generate_v4() primary key,
  restaurant_id uuid references public.restaurants(id) on delete cascade not null,
  category_id uuid references public.categories(id) on delete set null,
  name text not null,
  description text,
  price numeric(10, 2) not null,
  image_url text,
  is_available boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Modifier Groups Table
create table public.modifier_groups (
  id uuid default uuid_generate_v4() primary key,
  restaurant_id uuid references public.restaurants(id) on delete cascade not null,
  name text not null,
  min_selection integer default 0,
  max_selection integer,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. Product Modifiers (Pivot Table)
create table public.product_modifiers (
  id uuid default uuid_generate_v4() primary key,
  product_id uuid references public.products(id) on delete cascade not null,
  modifier_group_id uuid references public.modifier_groups(id) on delete cascade not null,
  unique(product_id, modifier_group_id)
);

-- 6. Modifier Options Table
create table public.modifier_options (
  id uuid default uuid_generate_v4() primary key,
  modifier_group_id uuid references public.modifier_groups(id) on delete cascade not null,
  name text not null,
  price_adjustment numeric(10, 2) default 0.00,
  is_available boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 7. Orders Table
create table public.orders (
  id uuid default uuid_generate_v4() primary key,
  restaurant_id uuid references public.restaurants(id) on delete cascade not null,
  status text check (status in ('pending', 'preparing', 'ready', 'completed')) default 'pending',
  total_amount numeric(10, 2) not null,
  order_number serial,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  preparing_at timestamp with time zone,
  ready_at timestamp with time zone,
  completed_at timestamp with time zone
);

-- 8. Order Items Table
create table public.order_items (
  id uuid default uuid_generate_v4() primary key,
  order_id uuid references public.orders(id) on delete cascade not null,
  product_id uuid references public.products(id) on delete set null,
  quantity integer default 1,
  unit_price numeric(10, 2) not null,
  modifiers_json jsonb default '[]'::jsonb,
  removed_ingredients text[],
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 9. Ingredients Table
create table public.ingredients (
  id uuid default uuid_generate_v4() primary key,
  restaurant_id uuid references public.restaurants(id) on delete cascade not null,
  name text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 10. Product Ingredients (Pivot Table)
create table public.product_ingredients (
  id uuid default uuid_generate_v4() primary key,
  product_id uuid references public.products(id) on delete cascade not null,
  ingredient_id uuid references public.ingredients(id) on delete cascade not null,
  is_removable boolean default true,
  unique(product_id, ingredient_id)
);

-- Enable Row Level Security (RLS)
alter table public.restaurants enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.modifier_groups enable row level security;
alter table public.product_modifiers enable row level security;
alter table public.modifier_options enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.ingredients enable row level security;
alter table public.product_ingredients enable row level security;

-- RLS Policies
create policy "Restaurants are viewable by everyone" on public.restaurants for select using (true);
create policy "Categories are viewable by everyone" on public.categories for select using (true);
create policy "Products are viewable by everyone" on public.products for select using (true);
create policy "Modifier Groups are viewable by everyone" on public.modifier_groups for select using (true);
create policy "Product Modifiers are viewable by everyone" on public.product_modifiers for select using (true);
create policy "Modifier Options are viewable by everyone" on public.modifier_options for select using (true);

create policy "Anyone can create orders" on public.orders for insert with check (true);
create policy "Orders viewable by everyone (for demo KDS)" on public.orders for select using (true);
create policy "Orders updatable by everyone (for demo KDS)" on public.orders for update using (true);

create policy "Anyone can create order items" on public.order_items for insert with check (true);
create policy "Order items viewable by everyone" on public.order_items for select using (true);

create policy "Ingredients are viewable by everyone" on public.ingredients for select using (true);
create policy "Product Ingredients are viewable by everyone" on public.product_ingredients for select using (true);

-- Admin Policies for Ingredients
create policy "Authenticated users can insert ingredients" on public.ingredients for insert with check (auth.role() = 'authenticated');
create policy "Authenticated users can update ingredients" on public.ingredients for update using (auth.role() = 'authenticated');
create policy "Authenticated users can delete ingredients" on public.ingredients for delete using (auth.role() = 'authenticated');

create policy "Authenticated users can insert product_ingredients" on public.product_ingredients for insert with check (auth.role() = 'authenticated');
create policy "Authenticated users can update product_ingredients" on public.product_ingredients for update using (auth.role() = 'authenticated');
create policy "Authenticated users can delete product_ingredients" on public.product_ingredients for delete using (auth.role() = 'authenticated');

-- Realtime
alter publication supabase_realtime add table public.orders;
alter publication supabase_realtime add table public.order_items;
alter publication supabase_realtime add table public.ingredients;
alter publication supabase_realtime add table public.product_ingredients;
