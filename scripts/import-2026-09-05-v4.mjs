const DB_ID = '099b4d9e-ad73-441b-a2be-a00f347a5905'
const SOURCE = 'MANUAL_IMPORT_2026-09-05'
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
const token = process.env.CLOUDFLARE_API_TOKEN
if (!accountId || !token) throw new Error('Missing Cloudflare credentials')

const receipts = {"0-0001":{"total":100.0,"payment":"Gotówka","receipt_date":"2026-09-05T13:27:33.000Z"},"0-0002":{"total":114.0,"payment":"Karta","receipt_date":"2026-09-05T11:45:41.000Z"},"0-0003":{"total":105.0,"payment":"Gotówka","receipt_date":"2026-09-05T15:40:15.000Z"},"0-0004":{"total":59.0,"payment":"Gotówka","receipt_date":"2026-09-05T13:51:48.000Z"},"0-0005":{"total":39.0,"payment":"Gotówka","receipt_date":"2026-09-05T15:19:56.000Z"},"0-0006":{"total":65.0,"payment":"Gotówka","receipt_date":"2026-09-05T11:57:30.000Z"},"0-0007":{"total":238.0,"payment":"Karta","receipt_date":"2026-09-05T13:04:33.000Z"},"0-0008":{"total":161.0,"payment":"Gotówka","receipt_date":"2026-09-05T11:22:24.000Z"},"0-0009":{"total":42.0,"payment":"Karta","receipt_date":"2026-09-05T13:42:48.000Z"},"0-0010":{"total":55.0,"payment":"Gotówka","receipt_date":"2026-09-05T12:53:04.000Z"},"0-0011":{"total":70.0,"payment":"Gotówka","receipt_date":"2026-09-05T12:09:21.000Z"},"0-0012":{"total":62.0,"payment":"Gotówka","receipt_date":"2026-09-05T11:31:07.000Z"},"0-0013":{"total":69.0,"payment":"Gotówka","receipt_date":"2026-09-05T13:02:37.000Z"},"0-0014":{"total":75.0,"payment":"Karta","receipt_date":"2026-09-05T11:21:12.000Z"},"0-0015":{"total":199.0,"payment":"Gotówka","receipt_date":"2026-09-05T11:03:12.000Z"},"0-0016":{"total":18.0,"payment":"Gotówka","receipt_date":"2026-09-05T12:59:04.000Z"},"0-0017":{"total":676.0,"payment":"Gotówka","receipt_date":"2026-09-05T12:29:56.000Z"},"0-0018":{"total":120.0,"payment":"Karta","receipt_date":"2026-09-05T12:55:36.000Z"},"0-0019":{"total":174.0,"payment":"Karta","receipt_date":"2026-09-05T14:00:54.000Z"}}
const lines = [{"lp":1,"receipt":"0-0001","item":"Koszula","delivery":"0","price":100.0,"payment":"Gotówka"},{"lp":2,"receipt":"0-0002","item":"Bluza","delivery":"2","price":69.0,"payment":"Karta"},{"lp":3,"receipt":"0-0002","item":"Spodnie","delivery":"0","price":45.0,"payment":"Karta"},{"lp":4,"receipt":"0-0003","item":"Koszula","delivery":"2","price":25.0,"payment":"Gotówka"},{"lp":5,"receipt":"0-0003","item":"Biżuteria","delivery":"0","price":20.0,"payment":"Gotówka"},{"lp":6,"receipt":"0-0003","item":"Torebka","delivery":"0","price":60.0,"payment":"Gotówka"},{"lp":7,"receipt":"0-0004","item":"Sukienka","delivery":"2","price":39.0,"payment":"Gotówka"},{"lp":8,"receipt":"0-0004","item":"Stanik","delivery":"0","price":20.0,"payment":"Gotówka"},{"lp":9,"receipt":"0-0005","item":"Bluzka","delivery":"0","price":39.0,"payment":"Gotówka"},{"lp":10,"receipt":"0-0006","item":"Bluzka","delivery":"2","price":35.0,"payment":"Gotówka"},{"lp":11,"receipt":"0-0006","item":"Sneakersy","delivery":"0","price":30.0,"payment":"Gotówka"},{"lp":12,"receipt":"0-0007","item":"Dres","delivery":"1","price":49.0,"payment":"Karta"},{"lp":13,"receipt":"0-0007","item":"Spodnie","delivery":"1","price":99.0,"payment":"Karta"},{"lp":14,"receipt":"0-0007","item":"Spodnie","delivery":"1","price":90.0,"payment":"Karta"},{"lp":15,"receipt":"0-0008","item":"Spodnie","delivery":"1","price":39.0,"payment":"Gotówka"},{"lp":16,"receipt":"0-0008","item":"Spodnie","delivery":"2","price":50.0,"payment":"Gotówka"},{"lp":17,"receipt":"0-0008","item":"Sukienka","delivery":"1","price":38.0,"payment":"Gotówka"},{"lp":18,"receipt":"0-0008","item":"Bluzka","delivery":"0","price":34.0,"payment":"Gotówka"},{"lp":19,"receipt":"0-0009","item":"Sweter","delivery":"1","price":42.0,"payment":"Karta"},{"lp":20,"receipt":"0-0010","item":"Spodnie","delivery":"1","price":55.0,"payment":"Gotówka"},{"lp":21,"receipt":"0-0011","item":"Spodnie","delivery":"0","price":35.0,"payment":"Gotówka"},{"lp":22,"receipt":"0-0011","item":"Sukienka","delivery":"2","price":35.0,"payment":"Gotówka"},{"lp":23,"receipt":"0-0012","item":"Sukienka","delivery":"0","price":30.0,"payment":"Gotówka"},{"lp":24,"receipt":"0-0012","item":"Koszulka","delivery":"0","price":32.0,"payment":"Gotówka"},{"lp":25,"receipt":"0-0013","item":"Shorty","delivery":"2","price":30.0,"payment":"Gotówka"},{"lp":26,"receipt":"0-0013","item":"Pasek","delivery":"0","price":10.0,"payment":"Gotówka"},{"lp":27,"receipt":"0-0013","item":"Koszulka","delivery":"3","price":29.0,"payment":"Gotówka"},{"lp":28,"receipt":"0-0014","item":"Kombinezon","delivery":"1","price":75.0,"payment":"Karta"},{"lp":29,"receipt":"0-0015","item":"Bluzka","delivery":"2","price":32.0,"payment":"Gotówka"},{"lp":30,"receipt":"0-0015","item":"Bluzka","delivery":"1","price":45.0,"payment":"Gotówka"},{"lp":31,"receipt":"0-0015","item":"Bluzka","delivery":"0","price":18.0,"payment":"Gotówka"},{"lp":32,"receipt":"0-0015","item":"Sukienka","delivery":"2","price":69.0,"payment":"Gotówka"},{"lp":33,"receipt":"0-0015","item":"Spodnie","delivery":"2","price":35.0,"payment":"Gotówka"},{"lp":34,"receipt":"0-0016","item":"Koszulka","delivery":"2","price":18.0,"payment":"Gotówka"},{"lp":35,"receipt":"0-0017","item":"Parasol","delivery":"0","price":25.0,"payment":"Gotówka"},{"lp":36,"receipt":"0-0017","item":"Bluza","delivery":"1","price":240.0,"payment":"Gotówka"},{"lp":37,"receipt":"0-0017","item":"Sweter","delivery":"1","price":160.0,"payment":"Gotówka"},{"lp":38,"receipt":"0-0017","item":"Koszula","delivery":"0","price":35.0,"payment":"Gotówka"},{"lp":39,"receipt":"0-0017","item":"Body","delivery":"1","price":100.0,"payment":"Gotówka"},{"lp":40,"receipt":"0-0017","item":"Torebka","delivery":"0","price":28.0,"payment":"Gotówka"},{"lp":41,"receipt":"0-0017","item":"Spódnica","delivery":"0","price":28.0,"payment":"Gotówka"},{"lp":42,"receipt":"0-0017","item":"Body","delivery":"1","price":60.0,"payment":"Gotówka"},{"lp":43,"receipt":"0-0018","item":"Biżuteria","delivery":"0","price":20.0,"payment":"Karta"},{"lp":44,"receipt":"0-0018","item":"Biżuteria","delivery":"0","price":10.0,"payment":"Karta"},{"lp":45,"receipt":"0-0018","item":"Torebka","delivery":"0","price":40.0,"payment":"Karta"},{"lp":46,"receipt":"0-0018","item":"Spodnie","delivery":"3","price":50.0,"payment":"Karta"},{"lp":47,"receipt":"0-0019","item":"Sneakersy","delivery":"2","price":150.0,"payment":"Karta"},{"lp":48,"receipt":"0-0019","item":"Getry","delivery":"0","price":24.0,"payment":"Karta"}]
const items = {"Biżuteria":["af7db71b-1628-404d-9eae-80c3f4d8f6a7","10009"],"Bluza":["11f748e5-dca5-4485-ba27-37ef3f580bb2","10044"],"Bluzka":["96a2653a-bfba-4541-81a0-6451f125fcc2","10027"],"Body":["cfdb8838-26d2-41f1-a8e4-09ebdd39023d","10033"],"Dres":["a3abf9fb-742f-4ac3-92da-18ffc40fa691","10043"],"Getry":["1d14a5d9-e2a0-44bf-9802-f8c8df68362d","10039"],"Kombinezon":["bd622b49-b0ac-4873-a957-784f5f4f46ac","10042"],"Koszula":["3615375d-7c79-4e83-8fd0-5d96c1e2bf9e","10026"],"Koszulka":["d9d3ceb5-25e5-44ca-98e3-19ff5d0756ca","10046"],"Parasol":["ae9f6608-3e9f-489c-919c-e9ba0ab4c864","10001"],"Pasek":["57e4c985-56dc-44c5-87c7-346c65f79e09","10006"],"Shorty":["da843172-eda2-4c61-bf5e-98e8ea2677be","10037"],"Sneakersy":["5123917a-14c4-4efa-b563-406ef450013e","10018"],"Spodnie":["a9bebfdb-07ba-43ca-8165-a2c008718707","10041"],"Spódnica":["64698e7c-566a-4c99-a9ac-cd5ddf56498d","10040"],"Stanik":["333fe556-65de-41a4-a7af-0dcafbce21db","10032"],"Sukienka":["38fbc83b-8dcc-451a-81a1-26a657b8f043","10035"],"Sweter":["036554d5-0ca6-4c4a-8f89-43a7f0b37b41","10028"],"Torebka":["870b02a1-690e-4101-bb46-32ee97900150","10005"]}
const payments = {
  'Gotówka': ['c0495d7c-d00c-4297-867a-f46dff06226d', 'CASH'],
  'Karta': ['42d173f3-2817-4e91-9a77-2aeac5f9a710', 'NONINTEGRATEDCARD'],
}

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

async function rollback() {
  const receiptIds = Object.keys(receipts)
  const placeholders = receiptIds.map(() => '?').join(',')
  await query(`DELETE FROM receipt_payments WHERE payment_key LIKE 'manual-20260905-payment-%'`)
  await query(`DELETE FROM receipt_lines WHERE line_id LIKE 'manual-20260905-%'`)
  await query(`DELETE FROM receipts WHERE source=? AND receipt_number IN (${placeholders})`, [SOURCE, ...receiptIds])
}

async function preflight() {
  const ids = Object.keys(receipts)
  const placeholders = ids.map(() => '?').join(',')
  const collisions = await query(`SELECT COUNT(*) AS n FROM receipts WHERE receipt_number IN (${placeholders})`, ids)
  assert(Number(collisions[0]?.n ?? -1) === 0, `Receipt collision count is ${collisions[0]?.n}`)

  const fk = await query('PRAGMA foreign_key_check')
  assert(fk.length === 0, `Foreign-key errors before import: ${fk.length}`)

  for (const [name, [itemId]] of Object.entries(items)) {
    const rows = await query(
      `SELECT COUNT(*) AS n FROM items WHERE item_id=? AND lower(trim(item_name))=lower(?) AND deleted_at IS NULL`,
      [itemId, name],
    )
    assert(Number(rows[0]?.n ?? 0) === 1, `Item mapping mismatch: ${name}`)
  }

  const plannedLineIds = lines.map((line) => `manual-20260905-${String(line.lp).padStart(4,'0')}`)
  const linePlaceholders = plannedLineIds.map(() => '?').join(',')
  const lineCollisions = await query(`SELECT COUNT(*) AS n FROM receipt_lines WHERE line_id IN (${linePlaceholders})`, plannedLineIds)
  assert(Number(lineCollisions[0]?.n ?? -1) === 0, `Line collision count is ${lineCollisions[0]?.n}`)

  const paymentKeys = ids.map((id) => `manual-20260905-payment-${id}`)
  const payPlaceholders = paymentKeys.map(() => '?').join(',')
  const payCollisions = await query(`SELECT COUNT(*) AS n FROM receipt_payments WHERE payment_key IN (${payPlaceholders})`, paymentKeys)
  assert(Number(payCollisions[0]?.n ?? -1) === 0, `Payment collision count is ${payCollisions[0]?.n}`)

  console.log('PRECHECK_OK receipts=0 collisions, lines=0 collisions, payments=0 collisions, item mappings=19/19, FK=0')
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
    const [itemId, sku] = items[line.item]
    await query(
      `INSERT INTO receipt_lines (
        line_id, receipt_number, item_id, variant_id, item_name, variant_name,
        sku, quantity, price, gross_total_money, total_money,
        cost, cost_total, total_discount, line_note
      ) VALUES (?, ?, ?, NULL, ?, NULL, ?, 1, ?, ?, ?, 0, 0, 0, ?)`,
      [
        `manual-20260905-${String(line.lp).padStart(4,'0')}`,
        line.receipt, itemId, line.item, sku,
        line.price, line.price, line.price, line.delivery,
      ],
    )
  }

  for (const [receiptNumber, receipt] of Object.entries(receipts)) {
    const [paymentTypeId, type] = payments[receipt.payment]
    await query(
      `INSERT INTO receipt_payments (
        payment_key, receipt_number, payment_type_id, name, type, money_amount, paid_at
      ) VALUES (?, ?, ?, ?, ?, ?, NULL)`,
      [`manual-20260905-payment-${receiptNumber}`, receiptNumber, paymentTypeId, receipt.payment, type, receipt.total],
    )
  }
}

async function verify() {
  const summary = (await query(
    `SELECT
       (SELECT COUNT(*) FROM receipts WHERE source=?) AS receipts_count,
       (SELECT ROUND(SUM(total_money),2) FROM receipts WHERE source=?) AS receipts_total,
       (SELECT COUNT(*) FROM receipt_lines WHERE line_id LIKE 'manual-20260905-%') AS lines_count,
       (SELECT ROUND(SUM(total_money),2) FROM receipt_lines WHERE line_id LIKE 'manual-20260905-%') AS lines_total,
       (SELECT COUNT(*) FROM receipt_payments WHERE payment_key LIKE 'manual-20260905-payment-%') AS payments_count,
       (SELECT ROUND(SUM(money_amount),2) FROM receipt_payments WHERE payment_key LIKE 'manual-20260905-payment-%') AS payments_total`,
    [SOURCE, SOURCE],
  ))[0]

  assert(Number(summary.receipts_count) === 19, `Expected 19 receipts, got ${summary.receipts_count}`)
  assert(Number(summary.lines_count) === 48, `Expected 48 lines, got ${summary.lines_count}`)
  assert(Number(summary.payments_count) === 19, `Expected 19 payments, got ${summary.payments_count}`)
  assert(Number(summary.receipts_total) === 2441, `Receipt total mismatch: ${summary.receipts_total}`)
  assert(Number(summary.lines_total) === 2441, `Line total mismatch: ${summary.lines_total}`)
  assert(Number(summary.payments_total) === 2441, `Payment total mismatch: ${summary.payments_total}`)

  const detail = (await query(
    `SELECT
       SUM(CASE WHEN total_discount=0 THEN 0 ELSE 1 END) AS bad_receipt_discount,
       (SELECT SUM(CASE WHEN total_discount=0 THEN 0 ELSE 1 END) FROM receipt_lines WHERE line_id LIKE 'manual-20260905-%') AS bad_line_discount,
       (SELECT SUM(CASE WHEN cost=0 AND cost_total=0 THEN 0 ELSE 1 END) FROM receipt_lines WHERE line_id LIKE 'manual-20260905-%') AS bad_cost,
       (SELECT SUM(CASE WHEN item_id IS NOT NULL THEN 0 ELSE 1 END) FROM receipt_lines WHERE line_id LIKE 'manual-20260905-%') AS missing_item_id,
       (SELECT SUM(CASE WHEN sku IS NOT NULL AND trim(sku)<>'' THEN 0 ELSE 1 END) FROM receipt_lines WHERE line_id LIKE 'manual-20260905-%') AS missing_sku
     FROM receipts WHERE source=?`,
    [SOURCE],
  ))[0]

  assert(Number(detail.bad_receipt_discount) === 0, 'Non-zero receipt discount found')
  assert(Number(detail.bad_line_discount) === 0, 'Non-zero line discount found')
  assert(Number(detail.bad_cost) === 0, 'Non-zero cost found')
  assert(Number(detail.missing_item_id) === 0, 'Missing item_id found')
  assert(Number(detail.missing_sku) === 0, 'Missing SKU found')

  const parasol = (await query(
    `SELECT COUNT(*) AS n FROM receipt_lines WHERE line_id LIKE 'manual-20260905-%' AND item_name='Parasol' AND sku='10001'`,
  ))[0]
  assert(Number(parasol.n) === 1, `Parasol SKU check failed: ${parasol.n}`)

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
     WHERE l.line_id LIKE 'manual-20260905-%'
       AND lower(trim(l.item_name))<>lower(trim(i.item_name))`,
  ))[0]
  assert(Number(itemMismatch.n) === 0, `Item-name linkage mismatches: ${itemMismatch.n}`)

  const times = (await query(
    `SELECT COUNT(*) AS n FROM receipts
     WHERE source=? AND (
       time(receipt_date,'+2 hours')<'13:00:00'
       OR time(receipt_date,'+2 hours')>='18:00:00'
     )`,
    [SOURCE],
  ))[0]
  assert(Number(times.n) === 0, `Receipt times outside 13:00-18:00 PL: ${times.n}`)

  const fk = await query('PRAGMA foreign_key_check')
  assert(fk.length === 0, `Foreign-key errors after import: ${fk.length}`)

  const paymentsSummary = await query(
    `SELECT name,COUNT(*) AS receipts,ROUND(SUM(money_amount),2) AS amount
     FROM receipt_payments WHERE payment_key LIKE 'manual-20260905-payment-%'
     GROUP BY name ORDER BY name`,
  )
  const deliverySummary = await query(
    `SELECT line_note,COUNT(*) AS lines,ROUND(SUM(total_money),2) AS amount
     FROM receipt_lines WHERE line_id LIKE 'manual-20260905-%'
     GROUP BY line_note ORDER BY line_note`,
  )

  console.log('VERIFY_OK', JSON.stringify({
    receipts: Number(summary.receipts_count),
    lines: Number(summary.lines_count),
    payments: Number(summary.payments_count),
    total: Number(summary.receipts_total),
    missing_item_id: Number(detail.missing_item_id),
    missing_sku: Number(detail.missing_sku),
    parasol_sku_10001: Number(parasol.n),
    fk_errors: fk.length,
    paymentsSummary,
    deliverySummary,
  }))
}

try {
  await preflight()
  await doImport()
  await verify()
} catch (error) {
  console.error('IMPORT_FAILED', error?.message || error)
  try {
    await rollback()
    console.error('ROLLBACK_OK')
  } catch (rollbackError) {
    console.error('ROLLBACK_FAILED', rollbackError?.message || rollbackError)
  }
  process.exit(1)
}
