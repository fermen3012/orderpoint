-- Seed data for OrderPoint

-- Insert a demo restaurant
INSERT INTO public.restaurants (id, name, logo_url) VALUES
('550e8400-e29b-41d4-a716-446655440000', 'Demo Restaurant', null);

-- Insert categories
INSERT INTO public.categories (id, restaurant_id, name, image_url, sort_order) VALUES
('650e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440000', 'Entradas', null, 1),
('650e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440000', 'Platos Principales', null, 2),
('650e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440000', 'Bebidas', null, 3),
('650e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440000', 'Postres', null, 4);

-- Insert products
INSERT INTO public.products (id, restaurant_id, category_id, name, description, price, image_url, is_available) VALUES
-- Entradas
('750e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440000', '650e8400-e29b-41d4-a716-446655440001', 'Ensalada César', 'Lechuga romana, crutones, queso parmesano y aderezo césar', 5.99, null, true),
('750e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440000', '650e8400-e29b-41d4-a716-446655440001', 'Alitas de Pollo', '8 piezas de alitas crujientes con salsa BBQ o búfalo', 7.99, null, true),
('750e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440000', '650e8400-e29b-41d4-a716-446655440001', 'Nachos Supremos', 'Nachos con queso, guacamole, crema y jalapeños', 6.99, null, true),

-- Platos Principales
('750e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440000', '650e8400-e29b-41d4-a716-446655440002', 'Hamburguesa Clásica', 'Carne de res, lechuga, tomate, cebolla, pepinillos y papas fritas', 9.99, null, true),
('750e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440000', '650e8400-e29b-41d4-a716-446655440002', 'Pizza Margarita', 'Salsa de tomate, mozzarella fresca y albahaca', 11.99, null, true),
('750e8400-e29b-41d4-a716-446655440006', '550e8400-e29b-41d4-a716-446655440000', '650e8400-e29b-41d4-a716-446655440002', 'Pasta Alfredo', 'Fettuccine con salsa cremosa alfredo y pollo', 10.99, null, true),
('750e8400-e29b-41d4-a716-446655440007', '550e8400-e29b-41d4-a716-446655440000', '650e8400-e29b-41d4-a716-446655440002', 'Tacos al Pastor', '3 tacos con carne al pastor, piña, cilantro y cebolla', 8.99, null, true),

-- Bebidas
('750e8400-e29b-41d4-a716-446655440008', '550e8400-e29b-41d4-a716-446655440000', '650e8400-e29b-41d4-a716-446655440003', 'Coca Cola', 'Refresco 500ml', 1.99, null, true),
('750e8400-e29b-41d4-a716-446655440009', '550e8400-e29b-41d4-a716-446655440000', '650e8400-e29b-41d4-a716-446655440003', 'Limonada Natural', 'Limonada fresca hecha en casa', 2.99, null, true),
('750e8400-e29b-41d4-a716-446655440010', '550e8400-e29b-41d4-a716-446655440000', '650e8400-e29b-41d4-a716-446655440003', 'Agua Mineral', 'Agua con gas 500ml', 1.49, null, true),

-- Postres
('750e8400-e29b-41d4-a716-446655440011', '550e8400-e29b-41d4-a716-446655440000', '650e8400-e29b-41d4-a716-446655440004', 'Cheesecake', 'Pastel de queso con frutos rojos', 4.99, null, true),
('750e8400-e29b-41d4-a716-446655440012', '550e8400-e29b-41d4-a716-446655440000', '650e8400-e29b-41d4-a716-446655440004', 'Brownie con Helado', 'Brownie de chocolate caliente con helado de vainilla', 5.49, null, true),
('750e8400-e29b-41d4-a716-446655440013', '550e8400-e29b-41d4-a716-446655440000', '650e8400-e29b-41d4-a716-446655440004', 'Flan Casero', 'Flan tradicional con caramelo', 3.99, null, true);

-- Insert modifier groups
INSERT INTO public.modifier_groups (id, restaurant_id, name, min_selection, max_selection) VALUES
('850e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440000', 'Término de Carne', 1, 1),
('850e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440000', 'Extras', 0, 5),
('850e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440000', 'Tamaño', 1, 1);

-- Insert modifier options
INSERT INTO public.modifier_options (id, modifier_group_id, name, price_adjustment, is_available) VALUES
-- Término de Carne
('950e8400-e29b-41d4-a716-446655440001', '850e8400-e29b-41d4-a716-446655440001', 'Término Medio', 0.00, true),
('950e8400-e29b-41d4-a716-446655440002', '850e8400-e29b-41d4-a716-446655440001', 'Bien Cocido', 0.00, true),
('950e8400-e29b-41d4-a716-446655440003', '850e8400-e29b-41d4-a716-446655440001', 'Poco Cocido', 0.00, true),

-- Extras
('950e8400-e29b-41d4-a716-446655440004', '850e8400-e29b-41d4-a716-446655440002', 'Queso Extra', 1.00, true),
('950e8400-e29b-41d4-a716-446655440005', '850e8400-e29b-41d4-a716-446655440002', 'Tocino', 1.50, true),
('950e8400-e29b-41d4-a716-446655440006', '850e8400-e29b-41d4-a716-446655440002', 'Aguacate', 1.25, true),

-- Tamaño
('950e8400-e29b-41d4-a716-446655440007', '850e8400-e29b-41d4-a716-446655440003', 'Pequeño', 0.00, true),
('950e8400-e29b-41d4-a716-446655440008', '850e8400-e29b-41d4-a716-446655440003', 'Mediano', 2.00, true),
('950e8400-e29b-41d4-a716-446655440009', '850e8400-e29b-41d4-a716-446655440003', 'Grande', 4.00, true);

-- Link modifiers to products (Hamburguesa)
INSERT INTO public.product_modifiers (product_id, modifier_group_id) VALUES
('750e8400-e29b-41d4-a716-446655440004', '850e8400-e29b-41d4-a716-446655440001'),
('750e8400-e29b-41d4-a716-446655440004', '850e8400-e29b-41d4-a716-446655440002');

-- Link modifiers to products (Pizza)
INSERT INTO public.product_modifiers (product_id, modifier_group_id) VALUES
('750e8400-e29b-41d4-a716-446655440005', '850e8400-e29b-41d4-a716-446655440003'),
('750e8400-e29b-41d4-a716-446655440005', '850e8400-e29b-41d4-a716-446655440002');
