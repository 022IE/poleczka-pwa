const token = process.env.CLOUDFLARE_API_TOKEN
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
const databaseId = process.env.D1_DATABASE_ID
const workerName = process.env.LOYVERSE_WORKER_NAME || 'poleczka-loyverse-webhook'

if (!token || !accountId || !databaseId) throw new Error('Missing Cloudflare credentials or D1 database id')

async function api(path, { method = 'GET', body } = {}) {
  const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok || !payload?.success) {
    const message = payload?.errors?.map((x) => x?.message).filter(Boolean).join('; ') || `HTTP ${response.status}`
    throw new Error(`Cloudflare API failed: ${message}`)
  }
  return payload.result
}

async function query(sql, params = []) {
  const result = await api(`/accounts/${accountId}/d1/database/${databaseId}/query`, {
    method: 'POST',
    body: { sql, params },
  })
  const statement = Array.isArray(result) ? result[0] : result
  if (!statement || statement.success === false) throw new Error(`D1 statement failed: ${statement?.error || 'unknown'}`)
  return statement.results ?? []
}

async function tableExists(name) {
  const rows = await query("SELECT 1 AS ok FROM sqlite_master WHERE type='table' AND name=? LIMIT 1", [name])
  return rows.length === 1
}

async function columnExists(table, column) {
  const rows = await query(`PRAGMA table_info("${table.replaceAll('"', '""')}")`)
  return rows.some((row) => row.name === column)
}

const deliveries = [
  [-1, '2026-09-05', 'Dostawa niezidentyfikowana', 100, 1200.00],
  [ 0, '2026-09-05', 'Dostawa wewnętrzna',         100, 1200.00],
  [ 1, '2026-09-05', 'MAT Fortuna Targowisko',     160, 2300.00],
  [ 2, '2026-09-05', 'Talia Brzesko',              220, 1750.00],
  [ 3, '2026-09-05', 'StockHurt Skawina',           80, 1200.00],
  [ 4, '2026-09-16', 'Aneta',                       10,  100.00],
  [ 5, '2026-06-16', 'Talia Brzesko',              149,  975.00],
  [ 6, '2026-09-16', 'MAT Fortuna Targowisko',      90, 1280.00],
  [ 7, '2026-09-18', 'Karolina',                    10,  100.00],
]

async function ensureDeliveriesTable() {
  if (!(await tableExists('deliveries'))) {
    await query(`
      CREATE TABLE deliveries (
        delivery_number INTEGER PRIMARY KEY,
        delivery_date TEXT NOT NULL,
        supplier_name TEXT NOT NULL,
        quantity INTEGER NOT NULL CHECK (quantity > 0),
        total_cost REAL NOT NULL CHECK (total_cost >= 0),
        active BOOLEAN NOT NULL DEFAULT TRUE CHECK (active IN (0, 1)),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)
  }

  if (!(await columnExists('deliveries', 'active'))) {
    await query('ALTER TABLE deliveries ADD COLUMN active BOOLEAN NOT NULL DEFAULT TRUE CHECK (active IN (0, 1))')
  }

  for (const row of deliveries) {
    await query(
      `INSERT INTO deliveries
         (delivery_number, delivery_date, supplier_name, quantity, total_cost)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(delivery_number) DO UPDATE SET
         delivery_date=excluded.delivery_date,
         supplier_name=excluded.supplier_name,
         quantity=excluded.quantity,
         total_cost=excluded.total_cost,
         updated_at=CURRENT_TIMESTAMP`,
      row,
    )
  }
}

async function ensureDeliveryColumn() {
  if (!(await columnExists('receipt_lines', 'delivery_number'))) {
    await query('ALTER TABLE receipt_lines ADD COLUMN delivery_number INTEGER REFERENCES deliveries(delivery_number)')
  }
  await query('CREATE INDEX IF NOT EXISTS idx_lines_delivery ON receipt_lines(delivery_number)')
}

async function installTriggers() {
  for (const name of ['trg_receipt_lines_delivery_insert','trg_receipt_lines_delivery_note_update','trg_deliveries_resolve_lines']) {
    await query(`DROP TRIGGER IF EXISTS ${name}`)
  }

  await query(`
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
    END
  `)

  await query(`
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
    END
  `)

  await query(`
    CREATE TRIGGER trg_deliveries_resolve_lines
    AFTER INSERT ON deliveries
    BEGIN
      UPDATE receipt_lines
      SET delivery_number = NEW.delivery_number
      WHERE TRIM(COALESCE(line_note, '')) = CAST(NEW.delivery_number AS TEXT);
    END
  `)
}

async function backfill() {
  await query(`
    UPDATE receipt_lines
    SET delivery_number = COALESCE(
      (SELECT d.delivery_number FROM deliveries d
       WHERE CAST(d.delivery_number AS TEXT) = TRIM(COALESCE(receipt_lines.line_note, ''))
       LIMIT 1),
      -1
    )
  `)
}

async function verify() {
  const seeded = await query('SELECT delivery_number, delivery_date, supplier_name, quantity, total_cost, active FROM deliveries ORDER BY delivery_number')
  if (seeded.length < deliveries.length) throw new Error('Delivery seed is incomplete')

  for (const expected of deliveries) {
    const row = seeded.find((item) => Number(item.delivery_number) === expected[0])
    if (!row) throw new Error(`Missing delivery ${expected[0]}`)
    const actual = [Number(row.delivery_number), String(row.delivery_date), String(row.supplier_name), Number(row.quantity), Number(row.total_cost)]
    if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Delivery ${expected[0]} differs from spreadsheet seed`)
  }

  const [badActive] = await query('SELECT COUNT(*) AS n FROM deliveries WHERE active IS NULL OR active NOT IN (0, 1)')
  if (Number(badActive?.n || 0) !== 0) throw new Error('Invalid deliveries.active values found')

  const [nulls] = await query('SELECT COUNT(*) AS n FROM receipt_lines WHERE delivery_number IS NULL')
  if (Number(nulls?.n || 0) !== 0) throw new Error('Some receipt_lines still have NULL delivery_number')

  const [invalid] = await query(`
    SELECT COUNT(*) AS n
    FROM receipt_lines l
    LEFT JOIN deliveries d ON d.delivery_number = l.delivery_number
    WHERE d.delivery_number IS NULL
  `)
  if (Number(invalid?.n || 0) !== 0) throw new Error('Invalid delivery_number references found')

  const [badResolved] = await query(`
    SELECT COUNT(*) AS n
    FROM receipt_lines l
    JOIN deliveries d ON CAST(d.delivery_number AS TEXT) = TRIM(COALESCE(l.line_note, ''))
    WHERE l.delivery_number <> d.delivery_number
  `)
  if (Number(badResolved?.n || 0) !== 0) throw new Error('Resolvable line_note values are not canonicalized')

  const fk = await query('PRAGMA foreign_key_check')
  if (fk.length) throw new Error('Foreign key check failed')

  const [unresolved] = await query(`
    SELECT COUNT(*) AS n
    FROM receipt_lines l
    WHERE TRIM(COALESCE(l.line_note, '')) <> ''
      AND NOT EXISTS (
        SELECT 1 FROM deliveries d
        WHERE CAST(d.delivery_number AS TEXT) = TRIM(COALESCE(l.line_note, ''))
      )
  `)

  const distribution = await query(`
    SELECT delivery_number, COUNT(*) AS lines, ROUND(SUM(total_money), 2) AS sales
    FROM receipt_lines
    GROUP BY delivery_number
    ORDER BY delivery_number
  `)

  console.log('DELIVERIES_MIGRATION_OK')
  const [activeSummary] = await query('SELECT COUNT(*) AS total, SUM(CASE WHEN active = TRUE THEN 1 ELSE 0 END) AS active FROM deliveries')
  console.log(JSON.stringify({ deliveries: seeded, activeSummary, unresolvedRawLineNotes: Number(unresolved?.n || 0), distribution }, null, 2))
}

async function auditLiveWorker() {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${workerName}/content/v2`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  if (!response.ok) {
    console.log(`LIVE_WORKER_AUDIT_SKIPPED HTTP ${response.status}`)
    return
  }
  const content = await response.text()
  const matches = [...content.matchAll(/line_note/g)].length
  console.log(`LIVE_WORKER_AUDIT line_note_occurrences=${matches}`)
  for (const line of content.split(/\r?\n/).filter((line) => line.includes('line_note')).slice(0, 20)) {
    console.log(`LIVE_WORKER line_note: ${line.trim().slice(0, 400)}`)
  }
  console.log('LIVE_WORKER_COMPATIBILITY: raw line_note writes remain supported by D1 triggers; canonical reads use delivery_number.')
}

async function main() {
  if (!(await tableExists('receipt_lines'))) throw new Error('receipt_lines table is missing')
  await ensureDeliveriesTable()
  await ensureDeliveryColumn()
  await installTriggers()
  await backfill()
  await verify()
  await auditLiveWorker()
}

await main()
