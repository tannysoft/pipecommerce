-- Phase 2k — Row Level Security
--
-- Workers app connects via service_role (Supabase) ที่ bypass RLS อยู่แล้ว
-- ดังนั้น RLS = defense-in-depth ป้องกันถ้ามี anon key รั่ว/มี dev เผลอใช้ผิด
--
-- Pattern:
--   1. Enable RLS ทุกตาราง (default deny — ไม่มี policy = ไม่ access)
--   2. Public read policy เฉพาะ storefront-facing tables
--   3. Authenticated shop-members policy = scope ด้วย shop_members membership
--
-- Junction tables (cart_items, fulfillment_line_items, ...) ไม่ตั้ง policy
-- เพิ่ม — Workers + service_role เท่านั้นที่ใช้ → bypass อยู่แล้ว

-- ─── Helper: shop ids ของ user ที่ login ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.user_shop_ids()
RETURNS uuid[]
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    ARRAY(SELECT shop_id FROM public.shop_members WHERE user_id = auth.uid()),
    '{}'::uuid[]
  )
$$;

-- ─── Enable RLS on all tables ────────────────────────────────────────────────
-- Phase 1 + 2a (tenant + identity)
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_auth_settings ENABLE ROW LEVEL SECURITY;

-- Phase 2b (catalog)
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_products ENABLE ROW LEVEL SECURITY;

-- Phase 2c (inventory)
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;

-- Phase 2d (cart + orders)
ALTER TABLE carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE fulfillments ENABLE ROW LEVEL SECURITY;
ALTER TABLE fulfillment_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;

-- Phase 2e (discounts + tax)
ALTER TABLE discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE discount_usages ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_discount_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_discount_applications ENABLE ROW LEVEL SECURITY;

-- Phase 2f (payment + shipping)
ALTER TABLE payment_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_rates ENABLE ROW LEVEL SECURITY;

-- Phase 2g (CRM + loyalty)
ALTER TABLE customer_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_loyalty ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_redemptions ENABLE ROW LEVEL SECURITY;

-- Phase 2h (themes)
ALTER TABLE themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_theme_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_theme_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE theme_draft_tokens ENABLE ROW LEVEL SECURITY;

-- Phase 2i (marketing + bulk + reports + SEO)
ALTER TABLE shop_announcement_bars ENABLE ROW LEVEL SECURITY;
ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE bulk_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_snapshots_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_email_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_redirects ENABLE ROW LEVEL SECURITY;

-- Phase 2j (platform plumbing)
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ─── Public-read policies for storefront ────────────────────────────────────
CREATE POLICY "anon_read_shops_active"
  ON shops FOR SELECT TO anon
  USING (status = 'active' AND deleted_at IS NULL);

CREATE POLICY "anon_read_shop_domains_active"
  ON shop_domains FOR SELECT TO anon
  USING (ssl_status = 'active');

CREATE POLICY "anon_read_products_active"
  ON products FOR SELECT TO anon
  USING (status = 'active' AND deleted_at IS NULL);

CREATE POLICY "anon_read_product_variants"
  ON product_variants FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM products p
      WHERE p.id = product_variants.product_id
        AND p.status = 'active'
        AND p.deleted_at IS NULL
    )
  );

CREATE POLICY "anon_read_product_options"
  ON product_options FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM products p
      WHERE p.id = product_options.product_id
        AND p.status = 'active'
        AND p.deleted_at IS NULL
    )
  );

CREATE POLICY "anon_read_product_images"
  ON product_images FOR SELECT TO anon
  USING (deleted_at IS NULL);

CREATE POLICY "anon_read_collections"
  ON collections FOR SELECT TO anon
  USING (true);

CREATE POLICY "anon_read_collection_products"
  ON collection_products FOR SELECT TO anon
  USING (true);

CREATE POLICY "anon_read_themes_active"
  ON themes FOR SELECT TO anon
  USING (is_active = true);

CREATE POLICY "anon_read_shop_theme_settings"
  ON shop_theme_settings FOR SELECT TO anon
  USING (true);

CREATE POLICY "anon_read_shop_theme_assets"
  ON shop_theme_assets FOR SELECT TO anon
  USING (deleted_at IS NULL);

CREATE POLICY "anon_read_announcement_bars_active"
  ON shop_announcement_bars FOR SELECT TO anon
  USING (is_active = true);

CREATE POLICY "anon_read_shop_auth_settings"
  ON shop_auth_settings FOR SELECT TO anon
  USING (true);

CREATE POLICY "anon_read_seo_redirects_active"
  ON seo_redirects FOR SELECT TO anon
  USING (is_active = true);

CREATE POLICY "anon_read_plans"
  ON plans FOR SELECT TO anon
  USING (true);

-- ─── Authenticated shop-member policies (per-shop access) ───────────────────
-- macro pattern: shop_id = ANY(public.user_shop_ids())

CREATE POLICY "members_all_shops" ON shops FOR ALL TO authenticated
  USING (id = ANY(public.user_shop_ids()))
  WITH CHECK (id = ANY(public.user_shop_ids()));

CREATE POLICY "members_all_shop_domains" ON shop_domains FOR ALL TO authenticated
  USING (shop_id = ANY(public.user_shop_ids()))
  WITH CHECK (shop_id = ANY(public.user_shop_ids()));

CREATE POLICY "members_all_shop_members" ON shop_members FOR ALL TO authenticated
  USING (shop_id = ANY(public.user_shop_ids()))
  WITH CHECK (shop_id = ANY(public.user_shop_ids()));

CREATE POLICY "members_all_customers" ON customers FOR ALL TO authenticated
  USING (shop_id = ANY(public.user_shop_ids()))
  WITH CHECK (shop_id = ANY(public.user_shop_ids()));

CREATE POLICY "members_all_customer_identities" ON customer_identities FOR ALL TO authenticated
  USING (shop_id = ANY(public.user_shop_ids()))
  WITH CHECK (shop_id = ANY(public.user_shop_ids()));

CREATE POLICY "members_all_shop_auth_settings" ON shop_auth_settings FOR ALL TO authenticated
  USING (shop_id = ANY(public.user_shop_ids()))
  WITH CHECK (shop_id = ANY(public.user_shop_ids()));

CREATE POLICY "members_all_products" ON products FOR ALL TO authenticated
  USING (shop_id = ANY(public.user_shop_ids()))
  WITH CHECK (shop_id = ANY(public.user_shop_ids()));

CREATE POLICY "members_all_product_variants" ON product_variants FOR ALL TO authenticated
  USING (shop_id = ANY(public.user_shop_ids()))
  WITH CHECK (shop_id = ANY(public.user_shop_ids()));

CREATE POLICY "members_all_product_images" ON product_images FOR ALL TO authenticated
  USING (shop_id = ANY(public.user_shop_ids()))
  WITH CHECK (shop_id = ANY(public.user_shop_ids()));

CREATE POLICY "members_all_collections" ON collections FOR ALL TO authenticated
  USING (shop_id = ANY(public.user_shop_ids()))
  WITH CHECK (shop_id = ANY(public.user_shop_ids()));

CREATE POLICY "members_all_locations" ON locations FOR ALL TO authenticated
  USING (shop_id = ANY(public.user_shop_ids()))
  WITH CHECK (shop_id = ANY(public.user_shop_ids()));

CREATE POLICY "members_all_inventory_items" ON inventory_items FOR ALL TO authenticated
  USING (shop_id = ANY(public.user_shop_ids()))
  WITH CHECK (shop_id = ANY(public.user_shop_ids()));

CREATE POLICY "members_all_inventory_movements" ON inventory_movements FOR ALL TO authenticated
  USING (shop_id = ANY(public.user_shop_ids()))
  WITH CHECK (shop_id = ANY(public.user_shop_ids()));

CREATE POLICY "members_all_carts" ON carts FOR ALL TO authenticated
  USING (shop_id = ANY(public.user_shop_ids()))
  WITH CHECK (shop_id = ANY(public.user_shop_ids()));

CREATE POLICY "members_all_orders" ON orders FOR ALL TO authenticated
  USING (shop_id = ANY(public.user_shop_ids()))
  WITH CHECK (shop_id = ANY(public.user_shop_ids()));

CREATE POLICY "members_all_order_line_items" ON order_line_items FOR ALL TO authenticated
  USING (shop_id = ANY(public.user_shop_ids()))
  WITH CHECK (shop_id = ANY(public.user_shop_ids()));

CREATE POLICY "members_all_fulfillments" ON fulfillments FOR ALL TO authenticated
  USING (shop_id = ANY(public.user_shop_ids()))
  WITH CHECK (shop_id = ANY(public.user_shop_ids()));

CREATE POLICY "members_all_refunds" ON refunds FOR ALL TO authenticated
  USING (shop_id = ANY(public.user_shop_ids()))
  WITH CHECK (shop_id = ANY(public.user_shop_ids()));

CREATE POLICY "members_all_discounts" ON discounts FOR ALL TO authenticated
  USING (shop_id = ANY(public.user_shop_ids()))
  WITH CHECK (shop_id = ANY(public.user_shop_ids()));

CREATE POLICY "members_all_discount_usages" ON discount_usages FOR ALL TO authenticated
  USING (shop_id = ANY(public.user_shop_ids()))
  WITH CHECK (shop_id = ANY(public.user_shop_ids()));

CREATE POLICY "members_all_tax_rates" ON tax_rates FOR ALL TO authenticated
  USING (shop_id = ANY(public.user_shop_ids()))
  WITH CHECK (shop_id = ANY(public.user_shop_ids()));

CREATE POLICY "members_all_payment_providers" ON payment_providers FOR ALL TO authenticated
  USING (shop_id = ANY(public.user_shop_ids()))
  WITH CHECK (shop_id = ANY(public.user_shop_ids()));

CREATE POLICY "members_all_payments" ON payments FOR ALL TO authenticated
  USING (shop_id = ANY(public.user_shop_ids()))
  WITH CHECK (shop_id = ANY(public.user_shop_ids()));

CREATE POLICY "members_all_shipping_zones" ON shipping_zones FOR ALL TO authenticated
  USING (shop_id = ANY(public.user_shop_ids()))
  WITH CHECK (shop_id = ANY(public.user_shop_ids()));

CREATE POLICY "members_all_shipping_rates" ON shipping_rates FOR ALL TO authenticated
  USING (shop_id = ANY(public.user_shop_ids()))
  WITH CHECK (shop_id = ANY(public.user_shop_ids()));

CREATE POLICY "members_all_customer_groups" ON customer_groups FOR ALL TO authenticated
  USING (shop_id = ANY(public.user_shop_ids()))
  WITH CHECK (shop_id = ANY(public.user_shop_ids()));

CREATE POLICY "members_all_customer_group_members" ON customer_group_members FOR ALL TO authenticated
  USING (shop_id = ANY(public.user_shop_ids()))
  WITH CHECK (shop_id = ANY(public.user_shop_ids()));

CREATE POLICY "members_all_customer_notes" ON customer_notes FOR ALL TO authenticated
  USING (shop_id = ANY(public.user_shop_ids()))
  WITH CHECK (shop_id = ANY(public.user_shop_ids()));

CREATE POLICY "members_all_loyalty_programs" ON loyalty_programs FOR ALL TO authenticated
  USING (shop_id = ANY(public.user_shop_ids()))
  WITH CHECK (shop_id = ANY(public.user_shop_ids()));

CREATE POLICY "members_all_customer_loyalty" ON customer_loyalty FOR ALL TO authenticated
  USING (shop_id = ANY(public.user_shop_ids()))
  WITH CHECK (shop_id = ANY(public.user_shop_ids()));

-- loyalty_ledger: SELECT only — INSERT ก็ทำผ่าน service_role; UPDATE/DELETE
-- ถูก block โดย Postgres RULE (migration 0009)
CREATE POLICY "members_select_loyalty_ledger" ON loyalty_ledger FOR SELECT TO authenticated
  USING (shop_id = ANY(public.user_shop_ids()));

CREATE POLICY "members_all_loyalty_redemptions" ON loyalty_redemptions FOR ALL TO authenticated
  USING (shop_id = ANY(public.user_shop_ids()))
  WITH CHECK (shop_id = ANY(public.user_shop_ids()));

CREATE POLICY "members_all_shop_theme_settings" ON shop_theme_settings FOR ALL TO authenticated
  USING (shop_id = ANY(public.user_shop_ids()))
  WITH CHECK (shop_id = ANY(public.user_shop_ids()));

CREATE POLICY "members_all_shop_theme_assets" ON shop_theme_assets FOR ALL TO authenticated
  USING (shop_id = ANY(public.user_shop_ids()))
  WITH CHECK (shop_id = ANY(public.user_shop_ids()));

CREATE POLICY "members_all_announcement_bars" ON shop_announcement_bars FOR ALL TO authenticated
  USING (shop_id = ANY(public.user_shop_ids()))
  WITH CHECK (shop_id = ANY(public.user_shop_ids()));

CREATE POLICY "members_all_newsletter_subscribers" ON newsletter_subscribers FOR ALL TO authenticated
  USING (shop_id = ANY(public.user_shop_ids()))
  WITH CHECK (shop_id = ANY(public.user_shop_ids()));

CREATE POLICY "members_all_bulk_jobs" ON bulk_jobs FOR ALL TO authenticated
  USING (shop_id = ANY(public.user_shop_ids()))
  WITH CHECK (shop_id = ANY(public.user_shop_ids()));

CREATE POLICY "members_all_report_snapshots" ON report_snapshots_daily FOR ALL TO authenticated
  USING (shop_id = ANY(public.user_shop_ids()))
  WITH CHECK (shop_id = ANY(public.user_shop_ids()));

CREATE POLICY "members_all_report_email_subs" ON report_email_subscriptions FOR ALL TO authenticated
  USING (shop_id = ANY(public.user_shop_ids()))
  WITH CHECK (shop_id = ANY(public.user_shop_ids()));

CREATE POLICY "members_all_seo_redirects" ON seo_redirects FOR ALL TO authenticated
  USING (shop_id = ANY(public.user_shop_ids()))
  WITH CHECK (shop_id = ANY(public.user_shop_ids()));

CREATE POLICY "members_all_shop_subscriptions" ON shop_subscriptions FOR ALL TO authenticated
  USING (shop_id = ANY(public.user_shop_ids()))
  WITH CHECK (shop_id = ANY(public.user_shop_ids()));

CREATE POLICY "members_all_webhooks" ON webhooks FOR ALL TO authenticated
  USING (shop_id = ANY(public.user_shop_ids()))
  WITH CHECK (shop_id = ANY(public.user_shop_ids()));

CREATE POLICY "members_all_webhook_deliveries" ON webhook_deliveries FOR ALL TO authenticated
  USING (shop_id = ANY(public.user_shop_ids()))
  WITH CHECK (shop_id = ANY(public.user_shop_ids()));

-- audit_logs: SELECT only ผ่าน admin (INSERT ทำผ่าน service_role)
CREATE POLICY "members_select_audit_logs" ON audit_logs FOR SELECT TO authenticated
  USING (shop_id = ANY(public.user_shop_ids()));
