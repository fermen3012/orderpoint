-- Enable Row Level Security
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modifier_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modifier_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Policies for public read access (Kiosk & Kitchen)
CREATE POLICY "Allow public read access for restaurants" ON public.restaurants FOR SELECT USING (true);
CREATE POLICY "Allow public read access for categories" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Allow public read access for products" ON public.products FOR SELECT USING (true);
CREATE POLICY "Allow public read access for modifier_groups" ON public.modifier_groups FOR SELECT USING (true);
CREATE POLICY "Allow public read access for modifier_options" ON public.modifier_options FOR SELECT USING (true);

-- Policies for orders (Kiosk can insert, Kitchen can read/update)
CREATE POLICY "Allow public insert for orders" ON public.orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public read for orders" ON public.orders FOR SELECT USING (true);
CREATE POLICY "Allow public update for orders" ON public.orders FOR UPDATE USING (true);

-- Policies for order items (Kiosk can insert, Kitchen can read)
CREATE POLICY "Allow public insert for order_items" ON public.order_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public read for order_items" ON public.order_items FOR SELECT USING (true);
