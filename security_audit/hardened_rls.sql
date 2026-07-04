-- Security Hardening Script for OrderPoint (SaaS Multi-tenant)
-- Path: security_audit/hardened_rls.sql

-- 1. Helper Security Definer Functions (to prevent infinite recursion and bypass role limits safely)

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean SECURITY DEFINER AS $$
BEGIN
  RETURN COALESCE(
    (SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()),
    false
  );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.get_user_restaurant_id()
RETURNS uuid SECURITY DEFINER AS $$
BEGIN
  RETURN (SELECT restaurant_id FROM public.profiles WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text SECURITY DEFINER AS $$
BEGIN
  RETURN (SELECT role FROM public.profiles WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql;

-- 2. Drop existing permissive and conflicting policies
DROP POLICY IF EXISTS "Restaurants are viewable by everyone" ON public.restaurants;
DROP POLICY IF EXISTS "restaurants_select" ON public.restaurants;
DROP POLICY IF EXISTS "restaurants_write" ON public.restaurants;

DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete" ON public.profiles;

DROP POLICY IF EXISTS "Categories are viewable by everyone" ON public.categories;
DROP POLICY IF EXISTS "categories_select" ON public.categories;
DROP POLICY IF EXISTS "categories_write" ON public.categories;

DROP POLICY IF EXISTS "Products are viewable by everyone" ON public.products;
DROP POLICY IF EXISTS "products_select" ON public.products;
DROP POLICY IF EXISTS "products_write" ON public.products;

DROP POLICY IF EXISTS "Modifier Groups are viewable by everyone" ON public.modifier_groups;
DROP POLICY IF EXISTS "modifier_groups_select" ON public.modifier_groups;
DROP POLICY IF EXISTS "modifier_groups_owner_all" ON public.modifier_groups;
DROP POLICY IF EXISTS "modifier_groups_write" ON public.modifier_groups;

DROP POLICY IF EXISTS "modifiers_select" ON public.modifiers;
DROP POLICY IF EXISTS "modifiers_owner_all" ON public.modifiers;
DROP POLICY IF EXISTS "modifiers_write" ON public.modifiers;

DROP POLICY IF EXISTS "product_modifier_groups_select" ON public.product_modifier_groups;
DROP POLICY IF EXISTS "product_modifier_groups_owner_all" ON public.product_modifier_groups;
DROP POLICY IF EXISTS "product_modifier_groups_write" ON public.product_modifier_groups;

DROP POLICY IF EXISTS "Anyone can create orders" ON public.orders;
DROP POLICY IF EXISTS "Orders viewable by everyone (for demo KDS)" ON public.orders;
DROP POLICY IF EXISTS "Orders updatable by everyone (for demo KDS)" ON public.orders;
DROP POLICY IF EXISTS "orders_select" ON public.orders;
DROP POLICY IF EXISTS "orders_insert" ON public.orders;
DROP POLICY IF EXISTS "orders_update" ON public.orders;
DROP POLICY IF EXISTS "orders_delete" ON public.orders;

DROP POLICY IF EXISTS "Anyone can create order items" ON public.order_items;
DROP POLICY IF EXISTS "Order items viewable by everyone" ON public.order_items;
DROP POLICY IF EXISTS "order_items_select" ON public.order_items;
DROP POLICY IF EXISTS "order_items_insert" ON public.order_items;
DROP POLICY IF EXISTS "order_items_update" ON public.order_items;
DROP POLICY IF EXISTS "order_items_delete" ON public.order_items;

DROP POLICY IF EXISTS "Ingredients are viewable by everyone" ON public.ingredients;
DROP POLICY IF EXISTS "Authenticated users can insert ingredients" ON public.ingredients;
DROP POLICY IF EXISTS "Authenticated users can update ingredients" ON public.ingredients;
DROP POLICY IF EXISTS "Authenticated users can delete ingredients" ON public.ingredients;
DROP POLICY IF EXISTS "ingredients_select" ON public.ingredients;
DROP POLICY IF EXISTS "ingredients_write" ON public.ingredients;

DROP POLICY IF EXISTS "Product Ingredients are viewable by everyone" ON public.product_ingredients;
DROP POLICY IF EXISTS "Authenticated users can insert product_ingredients" ON public.product_ingredients;
DROP POLICY IF EXISTS "Authenticated users can update product_ingredients" ON public.product_ingredients;
DROP POLICY IF EXISTS "Authenticated users can delete product_ingredients" ON public.product_ingredients;
DROP POLICY IF EXISTS "product_ingredients_select" ON public.product_ingredients;
DROP POLICY IF EXISTS "product_ingredients_write" ON public.product_ingredients;

DROP POLICY IF EXISTS "product_availability_select" ON public.product_availability;
DROP POLICY IF EXISTS "product_availability_write" ON public.product_availability;

DROP POLICY IF EXISTS "tables_select" ON public.tables;
DROP POLICY IF EXISTS "tables_write" ON public.tables;

-- 3. Enable RLS on all tables
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modifier_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_modifier_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- 4. Apply Multi-tenant RLS Policies

-- A. Table: restaurants
CREATE POLICY "restaurants_select" ON public.restaurants
  FOR SELECT USING (true); -- Publicly viewable for kiosk/menus

CREATE POLICY "restaurants_write" ON public.restaurants
  FOR ALL USING (public.is_super_admin());

-- B. Table: profiles
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT USING (
    public.is_super_admin()
    OR auth.uid() = id
    OR public.get_user_restaurant_id() = restaurant_id
  );

CREATE POLICY "profiles_insert" ON public.profiles
  FOR INSERT WITH CHECK (
    public.is_super_admin()
    OR auth.uid() = id
  );

CREATE POLICY "profiles_update" ON public.profiles
  FOR UPDATE USING (
    public.is_super_admin()
    OR auth.uid() = id
    OR (public.get_user_restaurant_id() = restaurant_id AND public.get_user_role() IN ('admin', 'owner'))
  );

CREATE POLICY "profiles_delete" ON public.profiles
  FOR DELETE USING (
    public.is_super_admin()
    OR (public.get_user_restaurant_id() = restaurant_id AND public.get_user_role() IN ('admin', 'owner'))
  );

-- C. Table: categories
CREATE POLICY "categories_select" ON public.categories
  FOR SELECT USING (true); -- Menu viewable by public

CREATE POLICY "categories_write" ON public.categories
  FOR ALL USING (
    public.is_super_admin()
    OR (public.get_user_restaurant_id() = restaurant_id AND public.get_user_role() IN ('admin', 'owner'))
  )
  WITH CHECK (
    public.is_super_admin()
    OR (public.get_user_restaurant_id() = restaurant_id AND public.get_user_role() IN ('admin', 'owner'))
  );

-- D. Table: products
CREATE POLICY "products_select" ON public.products
  FOR SELECT USING (true); -- Menu viewable by public

CREATE POLICY "products_write" ON public.products
  FOR ALL USING (
    public.is_super_admin()
    OR (public.get_user_restaurant_id() = restaurant_id AND public.get_user_role() IN ('admin', 'owner'))
  )
  WITH CHECK (
    public.is_super_admin()
    OR (public.get_user_restaurant_id() = restaurant_id AND public.get_user_role() IN ('admin', 'owner'))
  );

-- E. Table: modifier_groups
CREATE POLICY "modifier_groups_select" ON public.modifier_groups
  FOR SELECT USING (true);

CREATE POLICY "modifier_groups_write" ON public.modifier_groups
  FOR ALL USING (
    public.is_super_admin()
    OR (public.get_user_restaurant_id() = restaurant_id AND public.get_user_role() IN ('admin', 'owner'))
  )
  WITH CHECK (
    public.is_super_admin()
    OR (public.get_user_restaurant_id() = restaurant_id AND public.get_user_role() IN ('admin', 'owner'))
  );

-- F. Table: modifiers
CREATE POLICY "modifiers_select" ON public.modifiers
  FOR SELECT USING (true);

CREATE POLICY "modifiers_write" ON public.modifiers
  FOR ALL USING (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.modifier_groups mg
      WHERE mg.id = modifiers.group_id
      AND mg.restaurant_id = public.get_user_restaurant_id()
      AND public.get_user_role() IN ('admin', 'owner')
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.modifier_groups mg
      WHERE mg.id = modifiers.group_id
      AND mg.restaurant_id = public.get_user_restaurant_id()
      AND public.get_user_role() IN ('admin', 'owner')
    )
  );

-- G. Table: product_modifier_groups
CREATE POLICY "product_modifier_groups_select" ON public.product_modifier_groups
  FOR SELECT USING (true);

CREATE POLICY "product_modifier_groups_write" ON public.product_modifier_groups
  FOR ALL USING (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_modifier_groups.product_id
      AND p.restaurant_id = public.get_user_restaurant_id()
      AND public.get_user_role() IN ('admin', 'owner')
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_modifier_groups.product_id
      AND p.restaurant_id = public.get_user_restaurant_id()
      AND public.get_user_role() IN ('admin', 'owner')
    )
  );

-- H. Table: ingredients
CREATE POLICY "ingredients_select" ON public.ingredients
  FOR SELECT USING (
    public.is_super_admin()
    OR public.get_user_restaurant_id() = restaurant_id
  );

CREATE POLICY "ingredients_write" ON public.ingredients
  FOR ALL USING (
    public.is_super_admin()
    OR (public.get_user_restaurant_id() = restaurant_id AND public.get_user_role() IN ('admin', 'owner'))
  )
  WITH CHECK (
    public.is_super_admin()
    OR (public.get_user_restaurant_id() = restaurant_id AND public.get_user_role() IN ('admin', 'owner'))
  );

-- I. Table: product_ingredients
CREATE POLICY "product_ingredients_select" ON public.product_ingredients
  FOR SELECT USING (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_ingredients.product_id
      AND p.restaurant_id = public.get_user_restaurant_id()
    )
  );

CREATE POLICY "product_ingredients_write" ON public.product_ingredients
  FOR ALL USING (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_ingredients.product_id
      AND p.restaurant_id = public.get_user_restaurant_id()
      AND public.get_user_role() IN ('admin', 'owner')
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_ingredients.product_id
      AND p.restaurant_id = public.get_user_restaurant_id()
      AND public.get_user_role() IN ('admin', 'owner')
    )
  );

-- J. Table: product_availability
CREATE POLICY "product_availability_select" ON public.product_availability
  FOR SELECT USING (
    public.is_super_admin()
    OR public.get_user_restaurant_id() = restaurant_id
  );

CREATE POLICY "product_availability_write" ON public.product_availability
  FOR ALL USING (
    public.is_super_admin()
    OR (public.get_user_restaurant_id() = restaurant_id AND public.get_user_role() IN ('admin', 'owner'))
  )
  WITH CHECK (
    public.is_super_admin()
    OR (public.get_user_restaurant_id() = restaurant_id AND public.get_user_role() IN ('admin', 'owner'))
  );

-- K. Table: tables
CREATE POLICY "tables_select" ON public.tables
  FOR SELECT USING (
    public.is_super_admin()
    OR public.get_user_restaurant_id() = restaurant_id
  );

CREATE POLICY "tables_write" ON public.tables
  FOR ALL USING (
    public.is_super_admin()
    OR (public.get_user_restaurant_id() = restaurant_id AND public.get_user_role() IN ('admin', 'owner'))
  )
  WITH CHECK (
    public.is_super_admin()
    OR (public.get_user_restaurant_id() = restaurant_id AND public.get_user_role() IN ('admin', 'owner'))
  );

-- L. Table: orders
CREATE POLICY "orders_select" ON public.orders
  FOR SELECT USING (
    public.is_super_admin()
    OR public.get_user_restaurant_id() = restaurant_id
  );

CREATE POLICY "orders_insert" ON public.orders
  FOR INSERT WITH CHECK (
    public.is_super_admin()
    OR (
      restaurant_id = public.get_user_restaurant_id()
      AND public.get_user_role() IN ('kiosk', 'mesera', 'admin', 'owner')
    )
  );

CREATE POLICY "orders_update" ON public.orders
  FOR UPDATE USING (
    public.is_super_admin()
    OR (
      restaurant_id = public.get_user_restaurant_id()
      AND public.get_user_role() IN ('kitchen', 'mesera', 'admin', 'owner')
    )
  );

CREATE POLICY "orders_delete" ON public.orders
  FOR DELETE USING (
    public.is_super_admin()
    OR (
      restaurant_id = public.get_user_restaurant_id()
      AND public.get_user_role() IN ('admin', 'owner')
    )
  );

-- M. Table: order_items
CREATE POLICY "order_items_select" ON public.order_items
  FOR SELECT USING (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
      AND o.restaurant_id = public.get_user_restaurant_id()
    )
  );

CREATE POLICY "order_items_insert" ON public.order_items
  FOR INSERT WITH CHECK (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
      AND o.restaurant_id = public.get_user_restaurant_id()
      AND public.get_user_role() IN ('kiosk', 'mesera', 'admin', 'owner')
    )
  );

CREATE POLICY "order_items_update" ON public.order_items
  FOR UPDATE USING (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
      AND o.restaurant_id = public.get_user_restaurant_id()
      AND public.get_user_role() IN ('kitchen', 'mesera', 'admin', 'owner')
    )
  );

CREATE POLICY "order_items_delete" ON public.order_items
  FOR DELETE USING (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
      AND o.restaurant_id = public.get_user_restaurant_id()
      AND public.get_user_role() IN ('admin', 'owner')
    )
  );

-- 5. Storage Security Policies for 'products' and 'restaurants' buckets

DROP POLICY IF EXISTS "Public Read Access" ON storage.objects;
DROP POLICY IF EXISTS "Authorized Upload Access" ON storage.objects;

-- Select policy: public access to products and restaurants buckets
CREATE POLICY "Public Read Access" ON storage.objects
  FOR SELECT USING (bucket_id IN ('products', 'restaurants'));

-- Insert/Update/Delete policy: Enforces authentication, roles, and matching path restaurant UUID structure
CREATE POLICY "Authorized Upload Access" ON storage.objects
  FOR ALL
  USING (
    bucket_id IN ('products', 'restaurants')
    AND auth.role() = 'authenticated'
    AND (
      public.is_super_admin()
      OR (
        public.get_user_role() IN ('admin', 'owner')
        AND (
          -- If path starts with 'products/{restaurant_id}/', it must match the user's restaurant_id
          NOT (name ~ '^products/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/')
          OR (substring(name from '^products/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})')::uuid = public.get_user_restaurant_id())
        )
        AND (
          -- If path starts with 'categories/{restaurant_id}/', it must match the user's restaurant_id
          NOT (name ~ '^categories/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/')
          OR (substring(name from '^categories/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})')::uuid = public.get_user_restaurant_id())
        )
        AND (
          -- If logo path contains restaurant_id, it must match the user's restaurant_id
          NOT (name ~ '^logos/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})')
          OR (substring(name from '^logos/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})')::uuid = public.get_user_restaurant_id())
        )
      )
    )
  )
  WITH CHECK (
    bucket_id IN ('products', 'restaurants')
    AND auth.role() = 'authenticated'
    AND (
      public.is_super_admin()
      OR (
        public.get_user_role() IN ('admin', 'owner')
        AND (
          NOT (name ~ '^products/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/')
          OR (substring(name from '^products/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})')::uuid = public.get_user_restaurant_id())
        )
        AND (
          NOT (name ~ '^categories/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/')
          OR (substring(name from '^categories/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})')::uuid = public.get_user_restaurant_id())
        )
        AND (
          NOT (name ~ '^logos/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})')
          OR (substring(name from '^logos/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})')::uuid = public.get_user_restaurant_id())
        )
      )
    )
  );
