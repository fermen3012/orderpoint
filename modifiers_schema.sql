-- Drop existing tables to avoid conflicts and apply new structure
DROP TABLE IF EXISTS public.product_modifiers;
DROP TABLE IF EXISTS public.modifier_options;
DROP TABLE IF EXISTS public.modifier_groups CASCADE;

-- 1. modifier_groups
CREATE TABLE public.modifier_groups (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE NOT NULL,
    name text NOT NULL,
    min_selections integer DEFAULT 0,
    max_selections integer, -- null for unlimited
    is_required boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. modifiers
CREATE TABLE public.modifiers (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    group_id uuid REFERENCES public.modifier_groups(id) ON DELETE CASCADE NOT NULL,
    name text NOT NULL,
    price_extra numeric(10, 2) DEFAULT 0.00,
    is_available boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. product_modifier_groups (Pivot / Junction)
CREATE TABLE public.product_modifier_groups (
    product_id uuid REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
    group_id uuid REFERENCES public.modifier_groups(id) ON DELETE CASCADE NOT NULL,
    sort_order integer DEFAULT 0,
    PRIMARY KEY (product_id, group_id)
);

-- Enable RLS
ALTER TABLE public.modifier_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_modifier_groups ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- 1. Policies for modifier_groups
CREATE POLICY "modifier_groups_select" ON public.modifier_groups
    FOR SELECT USING (true); -- Publicly viewable for kiosk/order flow

CREATE POLICY "modifier_groups_owner_all" ON public.modifier_groups
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.restaurant_id = modifier_groups.restaurant_id
            AND profiles.role = 'admin'
        )
    );

-- 2. Policies for modifiers
CREATE POLICY "modifiers_select" ON public.modifiers
    FOR SELECT USING (true); -- Publicly viewable

CREATE POLICY "modifiers_owner_all" ON public.modifiers
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.modifier_groups mg
            JOIN public.profiles p ON p.restaurant_id = mg.restaurant_id
            WHERE mg.id = modifiers.group_id
            AND p.id = auth.uid()
            AND p.role = 'admin'
        )
    );

-- 3. Policies for product_modifier_groups
CREATE POLICY "product_modifier_groups_select" ON public.product_modifier_groups
    FOR SELECT USING (true); -- Publicly viewable

CREATE POLICY "product_modifier_groups_owner_all" ON public.product_modifier_groups
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.products pr
            JOIN public.profiles p ON p.restaurant_id = pr.restaurant_id
            WHERE pr.id = product_modifier_groups.product_id
            AND p.id = auth.uid()
            AND p.role = 'admin'
        )
    );

-- Add to Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.modifier_groups;
ALTER PUBLICATION supabase_realtime ADD TABLE public.modifiers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.product_modifier_groups;
