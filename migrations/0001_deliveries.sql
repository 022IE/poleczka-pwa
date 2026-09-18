-- 0001_deliveries.sql
-- DOSTAWY: canonical delivery relation for receipt_lines.
-- Raw Loyverse note stays in receipt_lines.line_note for audit/diagnostics.
-- Operational rollout is performed by scripts/migrate-deliveries-2026-09-18.mjs.

CREATE TABLE deliveries (
  delivery_number INTEGER PRIMARY KEY,
  delivery_date TEXT NOT NULL,
  supplier_name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  total_cost REAL NOT NULL CHECK (total_cost >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO deliveries (delivery_number, delivery_date, supplier_name, quantity, total_cost) VALUES
  (-1, '2026-09-05', 'Dostawa niezidentyfikowana', 100, 1200.00),
  ( 0, '2026-09-05', 'Dostawa wewnętrzna',         100, 1200.00),
  ( 1, '2026-09-05', 'MAT Fortuna Targowisko',     160, 2300.00),
  ( 2, '2026-09-05', 'Talia Brzesko',              220, 1750.00),
  ( 3, '2026-09-05', 'StockHurt Skawina',           80, 1200.00),
  ( 4, '2026-09-16', 'Aneta',                       10,  100.00),
  ( 5, '2026-06-16', 'Talia Brzesko',              149,  975.00),
  ( 6, '2026-09-16', 'MAT Fortuna Targowisko',      90, 1280.00),
  ( 7, '2026-09-18', 'Karolina',                    10,  100.00);

ALTER TABLE receipt_lines
  ADD COLUMN delivery_number INTEGER REFERENCES deliveries(delivery_number);

CREATE INDEX idx_lines_delivery ON receipt_lines(delivery_number);

UPDATE receipt_lines
SET delivery_number = COALESCE(
  (SELECT d.delivery_number
   FROM deliveries d
   WHERE CAST(d.delivery_number AS TEXT) = TRIM(COALESCE(receipt_lines.line_note, ''))
   LIMIT 1),
  -1
);

CREATE TRIGGER trg_receipt_lines_delivery_insert
AFTER INSERT ON receipt_lines
BEGIN
  UPDATE receipt_lines
  SET delivery_number = COALESCE(
    (SELECT d.delivery_number FROM deliveries d
     WHERE CAST(d.delivery_number AS TEXT) = TRIM(COALESCE(NEW.line_note, ''))
     LIMIT 1),
    -1
  )
  WHERE line_id = NEW.line_id;
END;

CREATE TRIGGER trg_receipt_lines_delivery_note_update
AFTER UPDATE OF line_note ON receipt_lines
BEGIN
  UPDATE receipt_lines
  SET delivery_number = COALESCE(
    (SELECT d.delivery_number FROM deliveries d
     WHERE CAST(d.delivery_number AS TEXT) = TRIM(COALESCE(NEW.line_note, ''))
     LIMIT 1),
    -1
  )
  WHERE line_id = NEW.line_id;
END;

CREATE TRIGGER trg_deliveries_resolve_lines
AFTER INSERT ON deliveries
BEGIN
  UPDATE receipt_lines
  SET delivery_number = NEW.delivery_number
  WHERE TRIM(COALESCE(line_note, '')) = CAST(NEW.delivery_number AS TEXT);
END;
