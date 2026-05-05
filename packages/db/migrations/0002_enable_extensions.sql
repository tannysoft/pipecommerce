-- Postgres extensions ที่จำเป็นสำหรับ search engine ของ products
-- (ดู docs/ARCHITECTURE.md#search--faceted-filter)
--
-- pg_trgm  — trigram similarity index, รองรับ fuzzy match ภาษาไทย
-- unaccent — strip accents (ใช้ร่วมกับ trgm สำหรับ EN/TH content)
--
-- IF NOT EXISTS เพื่อให้ idempotent — environment ที่ enable แล้วรันได้

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- IMMUTABLE wrapper สำหรับ products.search_vector (GENERATED column)
--
-- Postgres ปฏิเสธ array_to_string + to_tsvector ใน GENERATED expression
-- ตรงๆ เพราะ catalog mark เป็น STABLE จาก polymorphic type system
-- (แม้ปฏิบัติจะ immutable). ห่อด้วย IMMUTABLE wrapper = escape hatch
-- ที่ Postgres documented ไว้
CREATE OR REPLACE FUNCTION public.compute_product_search_vector(
  in_title text,
  in_tags text[],
  in_description text
) RETURNS tsvector
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT
    setweight(to_tsvector('simple', coalesce(in_title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(array_to_string(in_tags, ' '), '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(regexp_replace(left(in_description, 4000), '<[^>]+>', ' ', 'g'), '')), 'C')
$$;
