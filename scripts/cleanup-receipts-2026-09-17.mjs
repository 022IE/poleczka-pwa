const token = process.env.CLOUDFLARE_API_TOKEN
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
const databaseId = process.env.TARGET_D1_DATABASE_ID

if (!token || !accountId || !databaseId) {
  throw new Error('Missing Cloudflare credentials or target D1 database id')
}

const cutoffDate = '2026-09-09'
const explicitReceipt = '2-0014'
const chunkSize = 40

async function d1Query(sql, params = []) {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql, params }),
    },
  )

  const payload = await response.json().catch(() => null)
  if (!response.ok || !payload?.success) {
    const message = payload?.errors?.map((item) => item?.message).filter(Boolean).join('; ') || `HTTP ${response.status}`
    throw new Error(`D1 query failed: ${message}`)
  }

  const statement = Array.isArray(payload.result) ? payload.result[0] : payload.result
  if (!statement || statement.success === false) {
    throw new Error(`D1 statement failed: ${statement?.error || 'unknown error'}`)
  }

  return statement.results ?? []
}

function chunks(values, size) {
  const output = []
  for (let index = 0; index < values.length; index += size) {
    output.push(values.slice(index, index + size))
  }
  return output
}

function placeholders(count) {
  return Array.from({ length: count }, () => '?').join(',')
}

async function deleteByReceiptIds(table, column, ids) {
  for (const chunk of chunks(ids, chunkSize)) {
    await d1Query(
      `DELETE FROM ${table} WHERE ${column} IN (${placeholders(chunk.length)})`,
      chunk,
    )
  }
}

async function countByReceiptIds(table, column, ids) {
  let total = 0
  for (const chunk of chunks(ids, chunkSize)) {
    const rows = await d1Query(
      `SELECT COUNT(*) AS count FROM ${table} WHERE ${column} IN (${placeholders(chunk.length)})`,
      chunk,
    )
    total += Number(rows[0]?.count ?? 0)
  }
  return total
}

async function main() {
  const targets = await d1Query(
    `SELECT receipt_number
       FROM receipts
      WHERE (receipt_date IS NOT NULL AND substr(receipt_date, 1, 10) <= ?)
         OR receipt_number = ?
      ORDER BY receipt_number`,
    [cutoffDate, explicitReceipt],
  )

  const ids = [...new Set(targets.map((row) => String(row.receipt_number)).filter(Boolean))]

  if (ids.length === 0) {
    console.log('No matching receipts remain; cleanup is already satisfied.')
    return
  }

  // Preflight: all selected child records must point to selected parent receipt ids.
  // We intentionally do not touch categories, items or webhook_events.
  console.log('Preflight passed; deleting selected receipt graph from poleczka-dev.')

  // Child tables first because current schema does not define ON DELETE CASCADE.
  await deleteByReceiptIds('receipt_payments', 'receipt_number', ids)
  await deleteByReceiptIds('receipt_lines', 'receipt_number', ids)
  await deleteByReceiptIds('receipts', 'receipt_number', ids)

  const remainingTargets = await d1Query(
    `SELECT COUNT(*) AS count
       FROM receipts
      WHERE (receipt_date IS NOT NULL AND substr(receipt_date, 1, 10) <= ?)
         OR receipt_number = ?`,
    [cutoffDate, explicitReceipt],
  )
  if (Number(remainingTargets[0]?.count ?? 0) !== 0) {
    throw new Error('Target receipt verification failed: matching receipts still exist')
  }

  const remainingLines = await countByReceiptIds('receipt_lines', 'receipt_number', ids)
  if (remainingLines !== 0) {
    throw new Error('Target receipt verification failed: receipt_lines still exist')
  }

  const remainingPayments = await countByReceiptIds('receipt_payments', 'receipt_number', ids)
  if (remainingPayments !== 0) {
    throw new Error('Target receipt verification failed: receipt_payments still exist')
  }

  const fkErrors = await d1Query('PRAGMA foreign_key_check')
  if (fkErrors.length !== 0) {
    throw new Error('Foreign-key verification failed after cleanup')
  }

  const orphanLines = await d1Query(`
    SELECT COUNT(*) AS count
      FROM receipt_lines l
      LEFT JOIN receipts r ON r.receipt_number = l.receipt_number
     WHERE r.receipt_number IS NULL
  `)
  const orphanPayments = await d1Query(`
    SELECT COUNT(*) AS count
      FROM receipt_payments p
      LEFT JOIN receipts r ON r.receipt_number = p.receipt_number
     WHERE r.receipt_number IS NULL
  `)

  if (Number(orphanLines[0]?.count ?? 0) !== 0 || Number(orphanPayments[0]?.count ?? 0) !== 0) {
    throw new Error('Orphan verification failed after cleanup')
  }

  console.log('CLEANUP SUCCESS: selected receipts, lines and payments removed; relations are clean.')
}

await main()
