import crypto from 'node:crypto'

const token = process.env.CLOUDFLARE_API_TOKEN
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
const sourceDatabaseId = process.env.SOURCE_D1_DATABASE_ID
const targetDatabaseId = process.env.TARGET_D1_DATABASE_ID

if (!token || !accountId || !sourceDatabaseId || !targetDatabaseId) {
  throw new Error('Missing Cloudflare credentials or D1 database ids')
}

const expectedTables = [
  'categories',
  'items',
  'receipts',
  'receipt_lines',
  'receipt_payments',
  'webhook_events',
]

const tableOrder = [
  'categories',
  'items',
  'receipts',
  'receipt_lines',
  'receipt_payments',
  'webhook_events',
]

function quoteIdentifier(value) {
  return `"${String(value).replaceAll('"', '""')}"`
}

async function d1Query(databaseId, sql, params = []) {
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
  if (!response.ok || !payload || payload.success === false) {
    const safeError = payload?.errors?.map((item) => item?.message).filter(Boolean).join('; ') || `HTTP ${response.status}`
    throw new Error(`D1 query failed: ${safeError}`)
  }

  const statement = Array.isArray(payload.result) ? payload.result[0] : payload.result
  if (!statement || statement.success === false) {
    const safeError = statement?.error || 'Unknown D1 statement error'
    throw new Error(`D1 statement failed: ${safeError}`)
  }

  return statement.results ?? []
}

async function listUserTables(databaseId) {
  return d1Query(
    databaseId,
    `SELECT name, sql FROM sqlite_master
     WHERE type = 'table'
       AND name NOT LIKE 'sqlite_%'
       AND name <> '_cf_KV'
     ORDER BY name`,
  )
}

async function sourceSchema() {
  const tables = await listUserTables(sourceDatabaseId)
  const names = tables.map((row) => row.name).sort()
  const expected = [...expectedTables].sort()

  if (JSON.stringify(names) !== JSON.stringify(expected)) {
    throw new Error(`Unexpected source schema. Found tables: ${names.join(', ')}`)
  }

  const indexes = await d1Query(
    sourceDatabaseId,
    `SELECT name, tbl_name, sql FROM sqlite_master
     WHERE type = 'index'
       AND sql IS NOT NULL
       AND tbl_name IN (${expectedTables.map(() => '?').join(',')})
     ORDER BY name`,
    expectedTables,
  )

  return { tables, indexes }
}

async function tableInfo(databaseId, table) {
  return d1Query(databaseId, `PRAGMA table_info(${quoteIdentifier(table)})`)
}

async function tableCount(databaseId, table) {
  const rows = await d1Query(databaseId, `SELECT COUNT(*) AS count FROM ${quoteIdentifier(table)}`)
  return Number(rows[0]?.count ?? 0)
}

async function insertRows(table, columns, rows) {
  if (rows.length === 0) return

  const maxParams = 80
  const rowsPerInsert = Math.max(1, Math.floor(maxParams / columns.length))
  const columnSql = columns.map(quoteIdentifier).join(', ')

  for (let offset = 0; offset < rows.length; offset += rowsPerInsert) {
    const chunk = rows.slice(offset, offset + rowsPerInsert)
    const rowPlaceholder = `(${columns.map(() => '?').join(',')})`
    const valuesSql = chunk.map(() => rowPlaceholder).join(',')
    const params = chunk.flatMap((row) => columns.map((column) => row[column] ?? null))

    await d1Query(
      targetDatabaseId,
      `INSERT INTO ${quoteIdentifier(table)} (${columnSql}) VALUES ${valuesSql}`,
      params,
    )
  }
}

async function copyTable(table) {
  const info = await tableInfo(sourceDatabaseId, table)
  const columns = info.map((row) => row.name)
  if (columns.length === 0) throw new Error(`No columns found for ${table}`)

  const total = await tableCount(sourceDatabaseId, table)
  const pageSize = 100

  for (let offset = 0; offset < total; offset += pageSize) {
    const rows = await d1Query(
      sourceDatabaseId,
      `SELECT * FROM ${quoteIdentifier(table)} LIMIT ? OFFSET ?`,
      [pageSize, offset],
    )
    await insertRows(table, columns, rows)
  }
}

async function tableDigest(databaseId, table) {
  const info = await tableInfo(databaseId, table)
  const columns = info.map((row) => row.name)
  const pkColumns = info
    .filter((row) => Number(row.pk) > 0)
    .sort((a, b) => Number(a.pk) - Number(b.pk))
    .map((row) => row.name)
  const orderColumns = pkColumns.length ? pkColumns : columns
  const orderSql = orderColumns.map(quoteIdentifier).join(', ')
  const total = await tableCount(databaseId, table)
  const hash = crypto.createHash('sha256')
  const pageSize = 100

  for (let offset = 0; offset < total; offset += pageSize) {
    const rows = await d1Query(
      databaseId,
      `SELECT * FROM ${quoteIdentifier(table)} ORDER BY ${orderSql} LIMIT ? OFFSET ?`,
      [pageSize, offset],
    )

    for (const row of rows) {
      hash.update(JSON.stringify(columns.map((column) => row[column] ?? null)))
      hash.update('\n')
    }
  }

  return { count: total, digest: hash.digest('hex') }
}

async function main() {
  if (sourceDatabaseId === targetDatabaseId) {
    throw new Error('Source and target D1 databases must be different')
  }

  const existingTargetTables = await listUserTables(targetDatabaseId)
  if (existingTargetTables.length !== 0) {
    throw new Error(`Target database is not empty. Existing tables: ${existingTargetTables.map((row) => row.name).join(', ')}`)
  }

  const schema = await sourceSchema()
  const tableSqlByName = new Map(schema.tables.map((row) => [row.name, row.sql]))

  console.log('Preflight passed. Target is empty and source schema is recognized.')

  for (const table of tableOrder) {
    const sql = tableSqlByName.get(table)
    if (!sql) throw new Error(`Missing CREATE TABLE statement for ${table}`)
    await d1Query(targetDatabaseId, sql)
  }

  console.log('Target schema created.')

  for (const table of tableOrder) {
    await copyTable(table)
    console.log(`Copied ${table}.`)
  }

  for (const index of schema.indexes) {
    await d1Query(targetDatabaseId, index.sql)
  }

  console.log('Indexes created.')

  for (const table of tableOrder) {
    const source = await tableDigest(sourceDatabaseId, table)
    const target = await tableDigest(targetDatabaseId, table)

    if (source.count !== target.count || source.digest !== target.digest) {
      throw new Error(`Verification failed for ${table}`)
    }

    console.log(`Verified ${table}.`)
  }

  const foreignKeyErrors = await d1Query(targetDatabaseId, 'PRAGMA foreign_key_check')
  if (foreignKeyErrors.length !== 0) {
    throw new Error('Foreign key verification failed on target database')
  }

  console.log('Migration completed successfully. Source was read-only; target data matches source.')
}

await main()
