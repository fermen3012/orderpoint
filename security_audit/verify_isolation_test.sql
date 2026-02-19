-- TEST RLS EXPLOIT SCRIPT
-- RUN THIS IN SUPABASE SQL EDITOR AS A REGULAR USER (Simulate Org A)

-- 1. Try to read all orders (Should see ONLY your Org's orders)
SELECT count(*) as "Total Orders Visible" FROM public.orders;

-- 2. Try to read specific order from another Org (Replace VALID_ID_FROM_ORG_B with a real ID if known)
-- This assumes you know an ID from another org.
-- SELECT * FROM public.orders WHERE id = 'VALID_ID_FROM_ORG_B';

-- 3. Try to insert order into another Org (Replace TARGET_ORG_ID with Org B's ID)
-- INSERT INTO public.orders (restaurant_id, total_amount, status)
-- VALUES ('TARGET_ORG_ID', 0.00, 'pending')
-- RETURNING *;

-- Expected Result:
-- 1. Count should match only your org's records.
-- 2. Select should return 0 rows.
-- 3. Insert should fail with "new row violates row-level security policy".
