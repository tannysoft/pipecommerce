-- IMMUTABLE wrapper สำหรับ articles.search_vector (GENERATED column)
-- Pattern เดียวกับ compute_product_search_vector ใน migration 0002
--
-- body ตัดที่ 8000 chars (ยาวกว่า products เพราะ articles ยาวกว่า)
-- title weight A, tags weight B, body weight C

CREATE OR REPLACE FUNCTION public.compute_article_search_vector(
  in_title text,
  in_tags text[],
  in_body text
) RETURNS tsvector
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT
    setweight(to_tsvector('simple', coalesce(in_title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(array_to_string(in_tags, ' '), '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(regexp_replace(left(in_body, 8000), '<[^>]+>', ' ', 'g'), '')), 'C')
$$;
