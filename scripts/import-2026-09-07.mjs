const DB_ID = '099b4d9e-ad73-441b-a2be-a00f347a5905'
const SOURCE = 'MANUAL_IMPORT_2026-09-07'
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
const token = process.env.CLOUDFLARE_API_TOKEN
if (!accountId || !token) throw new Error('Missing Cloudflare credentials')

const receipts = {
  '0-0020': { total: 10, receipt_date: '2026-09-07T13:01:32.000Z' },
  '0-0021': { total: 112, receipt_date: '2026-09-07T12:43:16.000Z' },
  '0-0022': { total: 60, receipt_date: '2026-09-07T14:44:20.000Z' },
  '0-0023': { total: 134, receipt_date: '2026-09-07T12:53:37.000Z' },
  '0-0024': { total: 130, receipt_date: '2026-09-07T13:15:11.000Z' },
  '0-0025': { total: 110, receipt_date: '2026-09-07T14:59:58.000Z' },
  '0-0026': { total: 101, receipt_date: '2026-09-07T13:20:32.000Z' },
  '0-0027': { total: 83, receipt_date: '2026-09-07T15:37:16.000Z' },
  '0-0028': { total: 10, receipt_date: '2026-09-07T12:08:13.000Z' },
  '0-0029': { total: 45, receipt_date: '2026-09-07T13:07:33.000Z' },
}

const lines = [
  { lp: 1, receipt: '0-0020', price: 10, delivery: '0', item: 'T-shirt', sku: '10024' },
  { lp: 2, receipt: '0-0021', price: 29, delivery: '3', item: 'Koszulka', sku: '10046' },
  { lp: 3, receipt: '0-0021', price: 29, delivery: '5', item: 'Kamizelka', sku: '10029' },
  { lp: 4, receipt: '0-0021', price: 54, delivery: '1', item: 'Spodnie', sku: '10041' },
  { lp: 5, receipt: '0-0022', price: 35, delivery: '3', item: 'T-shirt', sku: '10024' },
  { lp: 6, receipt: '0-0022', price: 25, delivery: '3', item: 'Sukienka', sku: '10035' },
  { lp: 7, receipt: '0-0023', price: 69, delivery: '1', item: 'Stanik', sku: '10032' },
  { lp: 8, receipt: '0-0023', price: 35, delivery: '1', item: 'Getry', sku: '10039' },
  { lp: 9, receipt: '0-0023', price: 30, delivery: '0', item: 'Sneakersy', sku: '10018' },
  { lp: 10, receipt: '0-0024', price: 30, delivery: '0', item: 'Sneakersy', sku: '10018' },
  { lp: 11, receipt: '0-0024', price: 45, delivery: '2', item: 'Spodnie', sku: '10041' },
  { lp: 12, receipt: '0-0024', price: 55, delivery: '3', item: 'Spodnie', sku: '10041' },
  { lp: 13, receipt: '0-0025', price: 45, delivery: '1', item: 'Bluzka', sku: '10027' },
  { lp: 14, receipt: '0-0025', price: 65, delivery: '2', item: 'Bluza', sku: '10044' },
  { lp: 15, receipt: '0-0026', price: 5, delivery: '0', item: 'T-shirt', sku: '10024' },
  { lp: 16, receipt: '0-0026', price: 35, delivery: '1', item: 'Getry', sku: '10039' },
  { lp: 17, receipt: '0-0026', price: 32, delivery: '2', item: 'Bluzka', sku: '10027' },
  { lp: 18, receipt: '0-0026', price: 29, delivery: '0', item: 'Bluzka', sku: '10027' },
  { lp: 19, receipt: '0-0027', price: 10, delivery: '0', item: 'T-shirt', sku: '10024' },
  { lp: 20, receipt: '0-0027', price: 24, delivery: '2', item: 'Koszula', sku: '10026' },
  { lp: 21, receipt: '0-0027', price: 49, delivery: '5', item: 'Dres', sku: '10043' },
  { lp: 22, receipt: '0-0028', price: 10, delivery: '2', item: 'Bluzka', sku: '10027' },
  { lp: 23, receipt: '0-0029', price: 25, delivery: '0', item: 'Biżuteria', sku: '10009' },
  { lp: 24, receipt: '0-0029', price: 20, delivery: '0', item: 'Biżuteria', sku: '10009' },
]

const payment = {
  payment_type_id: 'c0495d7c-d00c-4297-867a-f46dff06226d',
  name: 'Gotówka',
  type: 'CASH',
}

const itemIds = new Map()

async function query(sql, params = []) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${DB_ID}/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sql, params }),
  })
  const payload = await response.json()
  if (!response.ok || !payload.success) {
    const message = payload?.errors?.map((e) => e?.message).filter(Boolean).join('; ') || `HTTP ${response.status}`
    throw new Error(message)
  }
  return payload.result?.[0]?.results ?? []
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function lineId(lp) {
  return `manual-20260907-${String(lp).padStart(4, '0')}`
}

function paymentKey(receiptNumber) {
  return `manual-20260907-payment-${receiptNumber}`
}

function validatePlan() {
  const receiptNumbers = Object.keys(receipts)
  assert(receiptNumbers.length === 10, `Expected 10 receipts in plan, got ${receiptNumbers.length}`)
  assert(lines.length === 24, `Expected 24 lines in plan, got ${lines.length}`)

  const receiptTotal = Object.values(receipts).reduce((sum, r) => sum + r.total, 0)
  const linesTotal = lines.reduce((sum, l) => sum + l.price, 0)
  assert(receiptTotal === 795, `Planned receipt total mismatch: ${receiptTotal}`)
  assert(linesTotal === 795, `Planned line total mismatch: ${linesTotal}`)

  for (const receiptNumber of receiptNumbers) {
    const lineTotal = lines.filter((l) => l.receipt === receiptNumber).reduce((sum, l) => sum + l.price, 0)
    assert(lineTotal === receipts[receiptNumber].total, `Plan mismatch for ${receiptNumber}: ${lineTotal} != ${receipts[receiptNumber].total}`)
  }
}

async function rollback() {
  const receiptIds = Object.keys(receipts)
  const placeholders = receiptIds.map(() => '?').join(',')
  await query(`DELETE FROM receipt_payments WHERE payment_key LIKE 'manual-20260907-payment-%'`)
  await query(`DELETE FROM receipt_lines WHERE line_id LIKE 'manual-20260907-%'`)
  await query(`DELETE FROM receipts WHERE source=? AND receipt_number IN (${placeholders})`, [SOURCE, ...receiptIds])
}

async function preflight() {
  validatePlan()

  const ids = Object.keys(receipts)
  const placeholders = ids.map(() => '?').join(',')
  const collisions = await query(`SELECT COUNT(*) AS n FROM receipts WHERE receipt_number IN (${placeholders})`, ids)
  assert(Number(collisions[0]?.n ?? -1) === 0, `Receipt collision count is ${collisions[0]?.n}`)

  const plannedLineIds = lines.map((line) => lineId(line.lp))
  const linePlaceholders = plannedLineIds.map(() => '?').join(',')
  const lineCollisions = await query(`SELECT COUNT(*) AS n FROM receipt_lines WHERE line_id IN (${linePlaceholders})`, plannedLineIds)
  assert(Number(lineCollisions[0]?.n ?? -1) === 0, `Line collision count is ${lineCollisions[0]?.n}`)

  const paymentKeys = ids.map(paymentKey)
  const payPlaceholders = paymentKeys.map(() => '?').join(',')
  const payCollisions = await query(`SELECT COUNT(*) AS n FROM receipt_payments WHERE payment_key IN (${payPlaceholders})`, paymentKeys)
  assert(Number(payCollisions[0]?.n ?? -1) === 0, `Payment collision count is ${payCollisions[0]?.n}`)

  const fk = await query('PRAGMA foreign_key_check')
  assert(fk.length === 0, `Foreign-key errors before import: ${fk.length}`)

  const uniqueItems = [...new Map(lines.map((line) => [line.item, line])).values()]
  for (const line of uniqueItems) {
    const itemRows = await query(
      `SELECT item_id,item_name FROM items WHERE lower(trim(item_name))=lower(?) AND deleted_at IS NULL`,
      [line.item],
    )
    assert(itemRows.length === 1, `Active item mapping for ${line.item}: expected 1, got ${itemRows.length}`)
    const itemId = itemRows[0].item_id
    itemIds.set(line.item, itemId)

    const skuRows = await query(
      `SELECT COUNT(*) AS n FROM receipt_lines WHERE item_id=? AND sku=?`,
      [itemId, line.sku],
    )
    assert(Number(skuRows[0]?.n ?? 0) > 0, `Historical SKU mapping missing: ${line.item} -> ${line.sku}`)
  }

  console.log(`PRECHECK_OK receipts=0 collisions, lines=0 collisions, payments=0 collisions, item mappings=${uniqueItems.length}/${uniqueItems.length}, SKU history=${uniqueItems.length}/${uniqueItems.length}, FK=0`)
}

async function doImport() {
  const syncedAt = new Date().toISOString()

  for (const [receiptNumber, receipt] of Object.entries(receipts)) {
    await query(
      `INSERT INTO receipts (
        receipt_number, receipt_type, refund_for, source, receipt_date,
        created_at, updated_at, cancelled_at, store_id, pos_device_id,
        total_money, total_discount, total_tax, tip, surcharge, synced_at
      ) VALUES (?, 'SALE', NULL, ?, ?, NULL, NULL, NULL, NULL, NULL, ?, 0, NULL, NULL, NULL, ?)`,
      [receiptNumber, SOURCE, receipt.receipt_date, receipt.total, syncedAt],
    )
  }

  for (const line of lines) {
    const itemId = itemIds.get(line.item)
    await query(
      `INSERT INTO receipt_lines (
        line_id, receipt_number, item_id, variant_id, item_name, variant_name,
        sku, quantity, price, gross_total_money, total_money,
        cost, cost_total, total_discount, line_note
      ) VALUES (?, ?, ?, NULL, ?, NULL, ?, 1, ?, ?, ?, 0, 0, 0, ?)`,
      [lineId(line.lp), line.receipt, itemId, line.item, line.sku, line.price, line.price, line.price, line.delivery],
    )
  }

  for (const [receiptNumber, receipt] of Object.entries(receipts)) {
    await query(
      `INSERT INTO receipt_payments (
        payment_key, receipt_number, payment_type_id, name, type, money_amount, paid_at
      ) VALUES (?, ?, ?, ?, ?, ?, NULL)`,
      [paymentKey(receiptNumber), receiptNumber, payment.payment_type_id, payment.name, payment.type, receipt.total],
    )
  }
}

async function verify() {
  const summary = (await query(
    `SELECT
       (SELECT COUNT(*) FROM receipts WHERE source=?) AS receipts_count,
       (SELECT ROUND(SUM(total_money),2) FROM receipts WHERE source=?) AS receipts_total,
       (SELECT COUNT(*) FROM receipt_lines WHERE line_id LIKE 'manual-20260907-%') AS lines_count,
       (SELECT ROUND(SUM(total_money),2) FROM receipt_lines WHERE line_id LIKE 'manual-20260907-%') AS lines_total,
       (SELECT COUNT(*) FROM receipt_payments WHERE payment_key LIKE 'manual-20260907-payment-%') AS payments_count,
       (SELECT ROUND(SUM(money_amount),2) FROM receipt_payments WHERE payment_key LIKE 'manual-20260907-payment-%') AS payments_total`,
    [SOURCE, SOURCE],
  ))[0]

  assert(Number(summary.receipts_count) === 10, `Expected 10 receipts, got ${summary.receipts_count}`)
  assert(Number(summary.lines_count) === 24, `Expected 24 lines, got ${summary.lines_count}`)
  assert(Number(summary.payments_count) === 10, `Expected 10 payments, got ${summary.payments_count}`)
  assert(Number(summary.receipts_total) === 795, `Receipt total mismatch: ${summary.receipts_total}`)
  assert(Number(summary.lines_total) === 795, `Line total mismatch: ${summary.lines_total}`)
  assert(Number(summary.payments_total) === 795, `Payment total mismatch: ${summary.payments_total}`)

  const detail = (await query(
    `SELECT
       SUM(CASE WHEN total_discount=0 THEN 0 ELSE 1 END) AS bad_receipt_discount,
       (SELECT SUM(CASE WHEN total_discount=0 THEN 0 ELSE 1 END) FROM receipt_lines WHERE line_id LIKE 'manual-20260907-%') AS bad_line_discount,
       (SELECT SUM(CASE WHEN cost=0 AND cost_total=0 THEN 0 ELSE 1 END) FROM receipt_lines WHERE line_id LIKE 'manual-20260907-%') AS bad_cost,
       (SELECT SUM(CASE WHEN item_id IS NOT NULL THEN 0 ELSE 1 END) FROM receipt_lines WHERE line_id LIKE 'manual-20260907-%') AS missing_item_id,
       (SELECT SUM(CASE WHEN sku IS NOT NULL AND trim(sku)<>'' THEN 0 ELSE 1 END) FROM receipt_lines WHERE line_id LIKE 'manual-20260907-%') AS missing_sku,
       (SELECT SUM(CASE WHEN line_note IS NOT NULL AND trim(line_note)<>'' AND trim(line_note)<>'-1' THEN 0 ELSE 1 END) FROM receipt_lines WHERE line_id LIKE 'manual-20260907-%') AS bad_line_note
     FROM receipts WHERE source=?`,
    [SOURCE],
  ))[0]

  assert(Number(detail.bad_receipt_discount) === 0, 'Non-zero receipt discount found')
  assert(Number(detail.bad_line_discount) === 0, 'Non-zero line discount found')
  assert(Number(detail.bad_cost) === 0, 'Non-zero cost found')
  assert(Number(detail.missing_item_id) === 0, 'Missing item_id found')
  assert(Number(detail.missing_sku) === 0, 'Missing SKU found')
  assert(Number(detail.bad_line_note) === 0, 'Invalid line_note found')

  const lineMismatch = (await query(
    `SELECT COUNT(*) AS n FROM (
       SELECT r.receipt_number
       FROM receipts r
       LEFT JOIN receipt_lines l ON l.receipt_number=r.receipt_number
       WHERE r.source=?
       GROUP BY r.receipt_number,r.total_money
       HAVING ABS(COALESCE(SUM(l.total_money),0)-r.total_money)>0.001
     )`,
    [SOURCE],
  ))[0]
  assert(Number(lineMismatch.n) === 0, `Receipt/line total mismatches: ${lineMismatch.n}`)

  const paymentMismatch = (await query(
    `SELECT COUNT(*) AS n FROM (
       SELECT r.receipt_number
       FROM receipts r
       LEFT JOIN receipt_payments p ON p.receipt_number=r.receipt_number
       WHERE r.source=?
       GROUP BY r.receipt_number,r.total_money
       HAVING ABS(COALESCE(SUM(p.money_amount),0)-r.total_money)>0.001
     )`,
    [SOURCE],
  ))[0]
  assert(Number(paymentMismatch.n) === 0, `Receipt/payment total mismatches: ${paymentMismatch.n}`)

  const itemMismatch = (await query(
    `SELECT COUNT(*) AS n
     FROM receipt_lines l JOIN items i ON i.item_id=l.item_id
     WHERE l.line_id LIKE 'manual-20260907-%'
       AND lower(trim(l.item_name))<>lower(trim(i.item_name))`,
  ))[0]
  assert(Number(itemMismatch.n) === 0, `Item-name linkage mismatches: ${itemMismatch.n}`)

  const skuMismatch = (await query(
    `SELECT COUNT(*) AS n
     FROM receipt_lines l
     WHERE l.line_id LIKE 'manual-20260907-%'
       AND NOT EXISTS (
         SELECT 1 FROM receipt_lines h
         WHERE h.item_id=l.item_id AND h.sku=l.sku AND h.line_id NOT LIKE 'manual-20260907-%'
       )`,
  ))[0]
  assert(Number(skuMismatch.n) === 0, `SKU-history mismatches after import: ${skuMismatch.n}`)

  const times = (await query(
    `SELECT COUNT(*) AS n FROM receipts
     WHERE source=? AND (
       date(receipt_date,'+2 hours')<>'2026-09-07'
       OR time(receipt_date,'+2 hours')<'13:00:00'
       OR time(receipt_date,'+2 hours')>='18:00:00'
     )`,
    [SOURCE],
  ))[0]
  assert(Number(times.n) === 0, `Receipt date/time outside 07.09.2026 13:00-18:00 PL: ${times.n}`)

  const paymentShape = (await query(
    `SELECT COUNT(*) AS n FROM receipt_payments
     WHERE payment_key LIKE 'manual-20260907-payment-%'
       AND (payment_type_id<>? OR name<>'Gotówka' OR type<>'CASH')`,
    [payment.payment_type_id],
  ))[0]
  assert(Number(paymentShape.n) === 0, `Non-cash or wrong payment mapping rows: ${paymentShape.n}`)

  const fk = await query('PRAGMA foreign_key_check')
  assert(fk.length === 0, `Foreign-key errors after import: ${fk.length}`)

  const paymentsSummary = await query(
    `SELECT name,COUNT(*) AS receipts,ROUND(SUM(money_amount),2) AS amount
     FROM receipt_payments WHERE payment_key LIKE 'manual-20260907-payment-%'
     GROUP BY name ORDER BY name`,
  )
  const deliverySummary = await query(
    `SELECT line_note,COUNT(*) AS lines,ROUND(SUM(total_money),2) AS amount
     FROM receipt_lines WHERE line_id LIKE 'manual-20260907-%'
     GROUP BY line_note ORDER BY line_note`,
  )

  const expectedDelivery = {
    '0': [8, 159],
    '1': [5, 238],
    '2': [5, 176],
    '3': [4, 144],
    '5': [2, 78],
  }
  for (const row of deliverySummary) {
    const expected = expectedDelivery[String(row.line_note)]
    assert(expected, `Unexpected delivery in summary: ${row.line_note}`)
    assert(Number(row.lines) === expected[0], `Delivery ${row.line_note} line count mismatch: ${row.lines}`)
    assert(Number(row.amount) === expected[1], `Delivery ${row.line_note} amount mismatch: ${row.amount}`)
  }
  assert(deliverySummary.length === Object.keys(expectedDelivery).length, `Delivery groups mismatch: ${deliverySummary.length}`)

  console.log('VERIFY_OK', JSON.stringify({
    receipts: Number(summary.receipts_count),
    lines: Number(summary.lines_count),
    payments: Number(summary.payments_count),
    total: Number(summary.receipts_total),
    missing_item_id: Number(detail.missing_item_id),
    missing_sku: Number(detail.missing_sku),
    bad_line_note: Number(detail.bad_line_note),
    fk_errors: fk.length,
    paymentsSummary,
    deliverySummary,
  }))
}

let importStarted = false
try {
  await preflight()
  importStarted = true
  await doImport()
  await verify()
} catch (error) {
  console.error('IMPORT_FAILED', error?.message || error)
  if (importStarted) {
    try {
      await rollback()
      console.error('ROLLBACK_OK')
    } catch (rollbackError) {
      console.error('ROLLBACK_FAILED', rollbackError?.message || rollbackError)
    }
  } else {
    console.error('ROLLBACK_SKIPPED_PRECHECK_FAILED')
  }
  process.exit(1)
}
