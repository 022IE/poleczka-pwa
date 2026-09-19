const token = process.env.CLOUDFLARE_API_TOKEN
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
const databaseId = process.env.D1_DATABASE_ID

if (!token || !accountId || !databaseId) {
  throw new Error('Missing Cloudflare credentials or D1 database id')
}

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
  if (!statement || statement.success === false) {
    throw new Error(`D1 statement failed: ${statement?.error || 'unknown'}`)
  }
  return statement.results ?? []
}

async function columnExists(table, column) {
  const rows = await query(`PRAGMA table_info("${table.replaceAll('"', '""')}")`)
  return rows.some((row) => row.name === column)
}

async function main() {
  if (!(await columnExists('deliveries', 'weight_kg'))) {
    await query(`
      ALTER TABLE deliveries
      ADD COLUMN weight_kg REAL
      CHECK (weight_kg IS NULL OR (weight_kg > 0 AND weight_kg <= 999.9))
    `)
  }

  if (!(await columnExists('deliveries', 'weight_kg'))) {
    throw new Error('deliveries.weight_kg was not created')
  }

  const [invalid] = await query(`
    SELECT COUNT(*) AS n
    FROM deliveries
    WHERE weight_kg IS NOT NULL
      AND (weight_kg <= 0 OR weight_kg > 999.9)
  `)
  if (Number(invalid?.n || 0) !== 0) {
    throw new Error('Invalid deliveries.weight_kg values found')
  }

  const [summary] = await query(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN weight_kg IS NULL THEN 1 ELSE 0 END) AS missing_weight,
      SUM(CASE WHEN weight_kg IS NOT NULL THEN 1 ELSE 0 END) AS with_weight
    FROM deliveries
  `)

  console.log('DELIVERIES_WEIGHT_MIGRATION_OK')
  console.log(JSON.stringify({ summary }, null, 2))
}

await main()
