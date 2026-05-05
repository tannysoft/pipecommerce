-- loyalty_ledger ต้องเป็น APPEND-ONLY (ดู ADR-016)
--
-- Postgres RULE = INSTEAD NOTHING ป้องกัน UPDATE/DELETE ทั้งหมด
-- รวม service role ปกติ — ต้องใช้ raw SQL พิเศษ (DROP RULE) ก่อนถ้า
-- ต้องการแก้จริงๆ
--
-- ทำไมไม่ใช้ trigger: trigger ทำงาน per-row ช้ากว่า. RULE rewrite query
-- ทั้งหมดเป็น no-op ที่ planner level — performance impact = 0
--
-- ห้าม truncate ไม่ block ด้วย rule (truncate bypass rule) — pgTAP test
-- ต้องครอบคลุมทั้ง 3 operations (UPDATE, DELETE, TRUNCATE)

CREATE OR REPLACE RULE loyalty_ledger_no_update AS
  ON UPDATE TO loyalty_ledger DO INSTEAD NOTHING;

CREATE OR REPLACE RULE loyalty_ledger_no_delete AS
  ON DELETE TO loyalty_ledger DO INSTEAD NOTHING;
