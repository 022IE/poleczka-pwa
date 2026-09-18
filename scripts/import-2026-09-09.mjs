const DB_ID = '099b4d9e-ad73-441b-a2be-a00f347a5905'
const SOURCE = 'MANUAL_IMPORT_2026-09-09'
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
const token = process.env.CLOUDFLARE_API_TOKEN
if (!accountId || !token) throw new Error('Missing Cloudflare credentials')

const receipts = {
  '0-0037': { total: 109, receipt_date: '2026-09-09T11:17:26.000Z' },
  '0-0038': { total: 30, receipt_date: '2026-09-09T11:49:53.000Z' },
  '0-0039': { total: 58, receipt_date: '2026-09-09T12:21:14.000Z' },
  '0-0040': { total: 54, receipt_date: '2026-09-09T12:58:47.000Z' },
  '0-0041': { total: 30, receipt_date: '2026-09-09T13:24:36.000Z' },
  '0-0042': { total: 28, receipt_date: '2026-09-09T13:52:09.000Z' },
  '0-0043': { total: 10, receipt_date: '2026-09-09T14:26:41.000Z' },
  '0-0044': { total: 80, receipt_date: '2026-09-09T15:03:18.000Z' },
  '0-0045': { total: 28, receipt_date: '2026-09-09T15:41:55.000Z' },
}

const lines = [
  { lp: 1, receipt: '0-0037', price: 40, delivery: 0, item: 'Koszulka polo', sku: '10025' },
  { lp: 2, receipt: '0-0037', price: 69, delivery: 1, item: 'Koszula', sku: '10026' },

  { lp: 3, receipt: '0-0038', price: 10, delivery: 0, item: 'T-shirt', sku: '10024' },
  { lp: 4, receipt: '0-0038', price: 20, delivery: 0, item: 'Inna odzież', sku: '10007' },

  { lp: 5, receipt: '0-0039', price: 29, delivery: 0, item: 'Bluzka', sku: '10027' },
  { lp: 6, receipt: '0-0039', price: 29, delivery: 2, item: 'Koszula', sku: '10026' },

  { lp: 7, receipt: '0-0040', price: 24, delivery: 0, item: 'Dres', sku: '10043' },
  { lp: 8, receipt: '0-0040', price: 30, delivery: 0, item: 'Sneakersy', sku: '10018' },

  { lp: 9, receipt: '0-0041', price: 30, delivery: 0, item: 'Pasek', sku: '10006' },

  { lp: 10, receipt: '0-0042', price: 28, delivery: 1, item: 'Getry', sku: '10039' },

  { lp: 11, receipt: '0-0043', price: 10, delivery: 0, item: 'Koszulka', sku: '10046' },

  { lp: 12, receipt: '0-0044', price: 80, delivery: 0, item: 'Koszula', sku: '10026' },

  { lp: 13, receipt: '0-0045', price: 28, delivery: 2, item: 'Spodnie', sku: '10041' },
]

const payment = {
  payment_type_id: 'c0495d7c-d00c-4297-867a-f46dff06226d',
  name: 'Gotówka',
  type: 'CASH',
}

const itemIds = new Map()
let deliveryColumn = null
let hasLineNote = false

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
  return `manual-20260909-${String(lp).padStart(4, '0')}`
}

function paymentKey(receiptNumber) {
  return `manual-20260909-payment-${receiptNumber}`
}

function validatePlan() {
  const receiptNumbers = Object.keys(receipts)
  assert(receiptNumbers.length === 9, `Expected 9 receipts in plan, got ${receiptNumbers.length}`)
  assert(lines.length === 13, `Expected 13 lines in plan, got ${lines.length}`)

  const receiptTotal = Object.values(receipts).reduce((sum, r) => sum + r.total, 0)
  const linesTotal = lines.reduce((sum, l) => sum + l.price, 0)
  assert(receiptTotal === 427, `Planned receipt total mismatch: ${receiptTotal}`)
  assert(linesTotal === 427, `Planned line total mismatch: ${linesTotal}`)

  for (const receiptNumber of receiptNumbers) {
    const lineTotal = lines.filter((l) => l.receipt === receiptNumber).reduce((sum, l) => sum + l.price, 0)
    assert(lineTotal === receipts[receiptNumber].total, `Plan mismatch for ${receiptNumber}: ${lineTotal} != ${receipts[receiptNumber].total}`)
  }
}

async function detectDeliverySchema() {
  const cols = await query('PRAGMA table_info(receipt_lines)')
  const names = new Set(cols.map((c) => String(c.name)))
  hasLineNote = names.has('line_note')
  if (names.has('delivery_number')) deliveryColumn = 'delivery_number'
  else if (hasLineNote) deliveryColumn = 'line_note'
  else throw new Error('Neither delivery_number nor line_note exists in receipt_lines')

  if (deliveryColumn === 'delivery_number') {
    const deliveryCols = await query('PRAGMA table_info(deliveries)')
    assert(deliveryCols.length > 0, 'deliveries table is missing after delivery_number migration')
    const deliveryColNames = new Set(deliveryCols.map((c) => String(c.name)))
    assert(deliveryColNames.has('delivery_number'), 'deliveries.delivery_number column is missing')

    for (const number of [0, 1, 2]) {
      const rows = await query('SELECT COUNT(*) AS n FROM deliveries WHERE delivery_number=?', [number])
      assert(Number(rows[0]?.n ?? 0) === 1, `Delivery ${number} missing or duplicated in deliveries`)
    }
  }

  console.log(`DELIVERY_SCHEMA_OK column=${deliveryColumn}`)
}

async function rollback() {
  const receiptIds = Object.keys(receipts)
  const placeholders = receiptIds.map(() => '?').join(',')
  await query(`DELETE FROM receipt_payments WHERE payment_key LIKE 'manual-20260909-payment-%'`)
  await query(`DELETE FROM receipt_lines WHERE line_id LIKE 'manual-20260909-%'`)
  await query(`DELETE FROM receipts WHERE source=? AND receipt_number IN (${placeholders})`, [SOURCE, ...receiptIds])
}

async function preflight() {
  validatePlan()
  await detectDeliverySchema()

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

    if (deliveryColumn === 'delivery_number' && hasLineNote) {
      await query(
        `INSERT INTO receipt_lines (
          line_id, receipt_number, item_id, variant_id, item_name, variant_name,
          sku, quantity, price, gross_total_money, total_money,
          cost, cost_total, total_discount, line_note, delivery_number
        ) VALUES (?, ?, ?, NULL, ?, NULL, ?, 1, ?, ?, ?, 0, 0, 0, ?, ?)`,
        [
          lineId(line.lp), line.receipt, itemId, line.item, line.sku,
          line.price, line.price, line.price, String(line.delivery), line.delivery,
        ],
      )
    } else {
      const sql = `INSERT INTO receipt_lines (
        line_id, receipt_number, item_id, variant_id, item_name, variant_name,
        sku, quantity, price, gross_total_money, total_money,
        cost, cost_total, total_discount, ${deliveryColumn}
      ) VALUES (?, ?, ?, NULL, ?, NULL, ?, 1, ?, ?, ?, 0, 0, 0, ?)`
      await query(sql, [
        lineId(line.lp), line.receipt, itemId, line.item, line.sku,
        line.price, line.price, line.price, line.delivery,
      ])
    }
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
       (SELECT COUNT(*) FROM receipt_lines WHERE line_id LIKE 'manual-20260909-%') AS lines_count,
       (SELECT ROUND(SUM(total_money),2) FROM receipt_lines WHERE line_id LIKE 'manual-20260909-%') AS lines_total,
       (SELECT COUNT(*) FROM receipt_payments WHERE payment_key LIKE 'manual-20260909-payment-%') AS payments_count,
       (SELECT ROUND(SUM(money_amount),2) FROM receipt_payments WHERE payment_key LIKE 'manual-20260909-payment-%') AS payments_total`,
    [SOURCE, SOURCE],
  ))[0]

  assert(Number(summary.receipts_count) === 9, `Expected 9 receipts, got ${summary.receipts_count}`)
  assert(Number(summary.lines_count) === 13, `Expected 13 lines, got ${summary.lines_count}`)
  assert(Number(summary.payments_count) === 9, `Expected 9 payments, got ${summary.payments_count}`)
  assert(Number(summary.receipts_total) === 427, `Receipt total mismatch: ${summary.receipts_total}`)
  assert(Number(summary.lines_total) === 427, `Line total mismatch: ${summary.lines_total}`)
  assert(Number(summary.payments_total) === 427, `Payment total mismatch: ${summary.payments_total}`)

  const detail = (await query(
    `SELECT
       SUM(CASE WHEN total_discount=0 THEN 0 ELSE 1 END) AS bad_receipt_discount,
       (SELECT SUM(CASE WHEN total_discount=0 THEN 0 ELSE 1 END) FROM receipt_lines WHERE line_id LIKE 'manual-20260909-%') AS bad_line_discount,
       (SELECT SUM(CASE WHEN cost=0 AND cost_total=0 THEN 0 ELSE 1 END) FROM receipt_lines WHERE line_id LIKE 'manual-20260909-%') AS bad_cost,
       (SELECT SUM(CASE WHEN item_id IS NOT NULL THEN 0 ELSE 1 END) FROM receipt_lines WHERE line_id LIKE 'manual-20260909-%') AS missing_item_id,
       (SELECT SUM(CASE WHEN sku IS NOT NULL AND trim(sku)<>'' THEN 0 ELSE 1 END) FROM receipt_lines WHERE line_id LIKE 'manual-20260909-%') AS missing_sku
     FROM receipts WHERE source=?`,
    [SOURCE],
  ))[0]

  assert(Number(detail.bad_receipt_discount) === 0, 'Non-zero receipt discount found')
  assert(Number(detail.bad_line_discount) === 0, 'Non-zero line discount found')
  assert(Number(detail.bad_cost) === 0, 'Non-zero cost found')
  assert(Number(detail.missing_item_id) === 0, 'Missing item_id found')
  assert(Number(detail.missing_sku) === 0, 'Missing SKU found')

  const deliveryValidation = (await query(
    `SELECT COUNT(*) AS n FROM receipt_lines
     WHERE line_id LIKE 'manual-20260909-%'
       AND (${deliveryColumn} IS NULL OR ${deliveryColumn} NOT IN (0,1,2))`,
  ))[0]
  assert(Number(deliveryValidation.n) === 0, `Invalid delivery values: ${deliveryValidation.n}`)

  if (deliveryColumn === 'delivery_number' && hasLineNote) {
    const rawDeliveryMismatch = (await query(
      `SELECT COUNT(*) AS n FROM receipt_lines
       WHERE line_id LIKE 'manual-20260909-%'
         AND TRIM(COALESCE(line_note,'')) <> CAST(delivery_number AS TEXT)`,
    ))[0]
    assert(Number(rawDeliveryMismatch.n) === 0, `line_note/delivery_number mismatches: ${rawDeliveryMismatch.n}`)
  }

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
     WHERE l.line_id LIKE 'manual-20260909-%'
       AND lower(trim(l.item_name))<>lower(trim(i.item_name))`,
  ))[0]
  assert(Number(itemMismatch.n) === 0, `Item-name linkage mismatches: ${itemMismatch.n}`)

  const skuMismatch = (await query(
    `SELECT COUNT(*) AS n
     FROM receipt_lines l
     WHERE l.line_id LIKE 'manual-20260909-%'
       AND NOT EXISTS (
         SELECT 1 FROM receipt_lines h
         WHERE h.item_id=l.item_id AND h.sku=l.sku AND h.line_id NOT LIKE 'manual-20260909-%'
       )`,
  ))[0]
  assert(Number(skuMismatch.n) === 0, `SKU-history mismatches after import: ${skuMismatch.n}`)

  const times = (await query(
    `SELECT COUNT(*) AS n FROM receipts
     WHERE source=? AND (
       date(receipt_date,'+2 hours')<>'2026-09-09'
       OR time(receipt_date,'+2 hours')<'13:00:00'
       OR time(receipt_date,'+2 hours')>='18:00:00'
     )`,
    [SOURCE],
  ))[0]
  assert(Number(times.n) === 0, `Receipt date/time outside 09.09.2026 13:00-18:00 PL: ${times.n}`)

  const paymentShape = (await query(
    `SELECT COUNT(*) AS n FROM receipt_payments
     WHERE payment_key LIKE 'manual-20260909-payment-%'
       AND (payment_type_id<>? OR name<>'Gotówka' OR type<>'CASH')`,
    [payment.payment_type_id],
  ))[0]
  assert(Number(paymentShape.n) === 0, `Non-cash or wrong payment mapping rows: ${paymentShape.n}`)

  const fk = await query('PRAGMA foreign_key_check')
  assert(fk.length === 0, `Foreign-key errors after import: ${fk.length}`)

  const paymentsSummary = await query(
    `SELECT name,COUNT(*) AS receipts,ROUND(SUM(money_amount),2) AS amount
     FROM receipt_payments WHERE payment_key LIKE 'manual-20260909-payment-%'
     GROUP BY name ORDER BY name`,
  )

  const deliverySummary = await query(
    `SELECT CAST(${deliveryColumn} AS TEXT) AS delivery,COUNT(*) AS lines,ROUND(SUM(total_money),2) AS amount
     FROM receipt_lines WHERE line_id LIKE 'manual-20260909-%'
     GROUP BY ${deliveryColumn} ORDER BY ${deliveryColumn}`,
  )

  const expectedDelivery = {
    '0': [9, 273],
    '1': [2, 97],
    '2': [2, 57],
  }
  for (const row of deliverySummary) {
    const expected = expectedDelivery[String(row.delivery)]
    assert(expected, `Unexpected delivery in summary: ${row.delivery}`)
    assert(Number(row.lines) === expected[0], `Delivery ${row.delivery} line count mismatch: ${row.lines}`)
    assert(Number(row.amount) === expected[1], `Delivery ${row.delivery} amount mismatch: ${row.amount}`)
  }
  assert(deliverySummary.length === Object.keys(expectedDelivery).length, `Delivery groups mismatch: ${deliverySummary.length}`)

  console.log('VERIFY_OK', JSON.stringify({
    deliveryColumn,
    receipts: Number(summary.receipts_count),
    lines: Number(summary.lines_count),
    payments: Number(summary.payments_count),
    total: Number(summary.receipts_total),
    missing_item_id: Number(detail.missing_item_id),
    missing_sku: Number(detail.missing_sku),
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
