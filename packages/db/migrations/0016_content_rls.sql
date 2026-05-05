-- RLS for content tables (Phase 2L) — extends pattern จาก migration 0013

ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE pages ENABLE ROW LEVEL SECURITY;

-- ─── Public read (storefront) — เฉพาะ active + published ─────────────────────

CREATE POLICY "anon_read_articles_active"
  ON articles FOR SELECT TO anon
  USING (
    status = 'active'
    AND deleted_at IS NULL
    AND (published_at IS NULL OR published_at <= now())
  );

CREATE POLICY "anon_read_article_images"
  ON article_images FOR SELECT TO anon
  USING (deleted_at IS NULL);

CREATE POLICY "anon_read_pages_active"
  ON pages FOR SELECT TO anon
  USING (
    status = 'active'
    AND deleted_at IS NULL
    AND (published_at IS NULL OR published_at <= now())
  );

-- ─── Authenticated shop-member access ───────────────────────────────────────

CREATE POLICY "members_all_articles" ON articles FOR ALL TO authenticated
  USING (shop_id = ANY(public.user_shop_ids()))
  WITH CHECK (shop_id = ANY(public.user_shop_ids()));

CREATE POLICY "members_all_article_images" ON article_images FOR ALL TO authenticated
  USING (shop_id = ANY(public.user_shop_ids()))
  WITH CHECK (shop_id = ANY(public.user_shop_ids()));

CREATE POLICY "members_all_pages" ON pages FOR ALL TO authenticated
  USING (shop_id = ANY(public.user_shop_ids()))
  WITH CHECK (shop_id = ANY(public.user_shop_ids()));
