-- RLS for galleries (Phase 4e) — same pattern as articles/pages

ALTER TABLE galleries ENABLE ROW LEVEL SECURITY;
ALTER TABLE gallery_images ENABLE ROW LEVEL SECURITY;

-- Public read: เฉพาะ active + ไม่ deleted + (publishedAt null หรือผ่านมาแล้ว)
CREATE POLICY "anon_read_galleries_active"
  ON galleries FOR SELECT TO anon
  USING (
    status = 'active'
    AND deleted_at IS NULL
    AND (published_at IS NULL OR published_at <= now())
  );

CREATE POLICY "anon_read_gallery_images"
  ON gallery_images FOR SELECT TO anon
  USING (deleted_at IS NULL);

-- Authenticated shop members
CREATE POLICY "members_all_galleries" ON galleries FOR ALL TO authenticated
  USING (shop_id = ANY(public.user_shop_ids()))
  WITH CHECK (shop_id = ANY(public.user_shop_ids()));

CREATE POLICY "members_all_gallery_images" ON gallery_images FOR ALL TO authenticated
  USING (shop_id = ANY(public.user_shop_ids()))
  WITH CHECK (shop_id = ANY(public.user_shop_ids()));
