import crypto from 'node:crypto'
import Cloudflare from 'cloudflare'

const token = process.env.CLOUDFLARE_API_TOKEN
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
const sourceDatabaseId = process.env.SOURCE_D1_DATABASE_ID
const targetDatabaseId = process.env.TARGET_D1_DATABASE_ID
const workerName = process.env.LOYVERSE_WORKER_NAME || 'poleczka-loyverse-webhook'

if (!token || !accountId || !sourceDatabaseId || !targetDatabaseId) {
  throw new Error('Missing Cloudflare credentials or D1 database ids')
}

if (sourceDatabaseId === targetDatabaseId) {
  throw new Error('Source and target D1 databases must be different')
}

const client = new Cloudflare({ apiToken: token })
const tables = [
  'categories',
  'items',
  'receipts',
  'receipt_lines',
  'receipt_payments',
  'webhook_events',
]

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

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
    throw new Error(`D1 statement failed: ${statement?.error || 'unknown error'}`)
  }

  return statement.results ?? []
}

async function listUserTables(databaseId) {
  return d1Query(
    databaseId,
    `SELECT name FROM sqlite_master
     WHERE type = 'table'
       AND name NOT LIKE 'sqlite_%'
       AND name <> '_cf_KV'
     ORDER BY name`,
  )
}

async function tableInfo(databaseId, table) {
  return d1Query(databaseId, `PRAGMA table_info(${quoteIdentifier(table)})`)
}

async function verifySchemas() {
  const expected = [...tables].sort()
  for (const [label, id] of [['source', sourceDatabaseId], ['target', targetDatabaseId]]) {
    const found = (await listUserTables(id)).map((row) => row.name).sort()
    if (JSON.stringify(found) !== JSON.stringify(expected)) {
      throw new Error(`Unexpected ${label} schema: ${found.join(', ')}`)
    }

    for (const table of tables) {
      const info = await tableInfo(id, table)
      if (info.length === 0) throw new Error(`Missing ${label} table definition for ${table}`)
    }
  }

  console.log('Schema preflight passed for source and target.')
}

async function fetchAllRows(databaseId, table) {
  const info = await tableInfo(databaseId, table)
  const columns = info.map((row) => row.name)
  const pk = info
    .filter((row) => Number(row.pk) > 0)
    .sort((a, b) => Number(a.pk) - Number(b.pk))
    .map((row) => row.name)
  if (pk.length === 0) throw new Error(`Table ${table} has no primary key`)

  const orderSql = pk.map(quoteIdentifier).join(', ')
  const rows = []
  const pageSize = 100

  for (let offset = 0; ; offset += pageSize) {
    const page = await d1Query(
      databaseId,
      `SELECT * FROM ${quoteIdentifier(table)} ORDER BY ${orderSql} LIMIT ? OFFSET ?`,
      [pageSize, offset],
    )
    rows.push(...page)
    if (page.length < pageSize) break
  }

  return { info, columns, pk, rows }
}

async function upsertRows(table, columns, pk, rows) {
  if (rows.length === 0) return

  const nonPk = columns.filter((column) => !pk.includes(column))
  const columnSql = columns.map(quoteIdentifier).join(', ')
  const conflictSql = pk.map(quoteIdentifier).join(', ')
  const updateSql = nonPk.length
    ? `DO UPDATE SET ${nonPk.map((column) => `${quoteIdentifier(column)} = excluded.${quoteIdentifier(column)}`).join(', ')}`
    : 'DO NOTHING'
  const maxParams = 80
  const rowsPerInsert = Math.max(1, Math.floor(maxParams / columns.length))

  for (let offset = 0; offset < rows.length; offset += rowsPerInsert) {
    const chunk = rows.slice(offset, offset + rowsPerInsert)
    const single = `(${columns.map(() => '?').join(',')})`
    const valuesSql = chunk.map(() => single).join(',')
    const params = chunk.flatMap((row) => columns.map((column) => row[column] ?? null))

    await d1Query(
      targetDatabaseId,
      `INSERT INTO ${quoteIdentifier(table)} (${columnSql}) VALUES ${valuesSql}
       ON CONFLICT (${conflictSql}) ${updateSql}`,
      params,
    )
  }
}

async function syncOnce() {
  for (const table of tables) {
    const { columns, pk, rows } = await fetchAllRows(sourceDatabaseId, table)
    await upsertRows(table, columns, pk, rows)
  }
}

async function tableDigest(databaseId, table) {
  const { columns, pk, rows } = await fetchAllRows(databaseId, table)
  const hash = crypto.createHash('sha256')
  for (const row of rows) {
    hash.update(JSON.stringify(columns.map((column) => row[column] ?? null)))
    hash.update('\n')
  }
  return { count: rows.length, digest: hash.digest('hex'), pk }
}

async function compareDatabases() {
  for (const table of tables) {
    const source = await tableDigest(sourceDatabaseId, table)
    const target = await tableDigest(targetDatabaseId, table)
    if (source.count !== target.count || source.digest !== target.digest) return false
  }
  return true
}

async function verifyForeignKeys() {
  const errors = await d1Query(targetDatabaseId, 'PRAGMA foreign_key_check')
  if (errors.length !== 0) throw new Error('Foreign key verification failed on target database')
}

async function syncUntilEqual(label, attempts = 5) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await syncOnce()
      await verifyForeignKeys()
      if (await compareDatabases()) {
        console.log(`${label}: source and target match exactly.`)
        return
      }
    } catch (error) {
      if (attempt === attempts) throw error
    }
    if (attempt < attempts) await sleep(1500)
  }
  throw new Error(`${label}: databases did not converge after ${attempts} attempts`)
}

function d1BindingId(binding) {
  return binding?.database_id ?? binding?.id ?? null
}

function hasTargetD1(bindings) {
  const matches = (bindings ?? []).filter((binding) => binding?.name === 'DB' && binding?.type === 'd1')
  return matches.length === 1 && d1BindingId(matches[0]) === targetDatabaseId
}

async function listVersions() {
  const items = []
  for await (const version of client.workers.scripts.versions.list(workerName, {
    account_id: accountId,
    deployable: true,
  })) {
    items.push(version)
  }
  return items
}

async function getVersionBindings(versionId) {
  const version = await client.workers.scripts.versions.get(versionId, {
    account_id: accountId,
    script_name: workerName,
  })
  return version?.resources?.bindings ?? []
}

async function activeVersionIds() {
  const result = await client.workers.scripts.deployments.list(workerName, { account_id: accountId })
  const deployment = result?.deployments?.[0]
  if (!deployment) throw new Error('No active Worker deployment found')
  return (deployment.versions ?? []).filter((item) => Number(item.percentage) > 0).map((item) => item.version_id)
}

async function activeDeploymentUsesTarget() {
  const ids = await activeVersionIds()
  if (ids.length === 0) return false
  for (const id of ids) {
    if (!hasTargetD1(await getVersionBindings(id))) return false
  }
  return true
}

async function switchWorkerBinding() {
  const current = await client.workers.scripts.scriptAndVersionSettings.get(workerName, {
    account_id: accountId,
  })
  const bindings = current?.bindings ?? []
  const currentDb = bindings.filter((binding) => binding?.name === 'DB' && binding?.type === 'd1')
  if (currentDb.length !== 1) throw new Error(`Expected exactly one DB D1 binding, found ${currentDb.length}`)

  if (d1BindingId(currentDb[0]) === targetDatabaseId && await activeDeploymentUsesTarget()) {
    console.log('Worker is already fully deployed on poleczka-dev.')
    return
  }

  if (d1BindingId(currentDb[0]) !== sourceDatabaseId) {
    throw new Error('Worker DB binding points to an unexpected database; aborting cutover')
  }

  const beforeVersions = await listVersions()
  const beforeIds = new Set(beforeVersions.map((version) => version.id).filter(Boolean))
  const nextBindings = bindings.map((binding) => {
    if (!binding?.name) throw new Error('Encountered unnamed Worker binding')
    if (binding.name === 'DB' && binding.type === 'd1') {
      return { name: 'DB', type: 'd1', database_id: targetDatabaseId }
    }
    return { name: binding.name, type: 'inherit', version_id: 'latest' }
  })

  await client.workers.scripts.scriptAndVersionSettings.edit(workerName, {
    account_id: accountId,
    settings: {
      bindings: nextBindings,
      annotations: {
        'workers/message': 'Półeczka PWA: switch D1 binding to poleczka-dev',
      },
    },
  })

  const afterVersions = await listVersions()
  let candidate = afterVersions.find((version) => version.id && !beforeIds.has(version.id))
  if (!candidate) candidate = afterVersions[0]
  if (!candidate?.id) throw new Error('Unable to identify Worker version created by settings update')

  const candidateBindings = await getVersionBindings(candidate.id)
  if (!hasTargetD1(candidateBindings)) {
    throw new Error('New Worker version does not contain the expected poleczka-dev binding')
  }

  if (!(await activeDeploymentUsesTarget())) {
    await client.workers.scripts.deployments.create(workerName, {
      account_id: accountId,
      strategy: 'percentage',
      versions: [{ percentage: 100, version_id: candidate.id }],
      annotations: {
        'workers/message': 'Półeczka PWA: activate poleczka-dev',
      },
    })
  }

  if (!(await activeDeploymentUsesTarget())) {
    throw new Error('Active Worker deployment still does not use poleczka-dev')
  }

  const finalSettings = await client.workers.scripts.scriptAndVersionSettings.get(workerName, {
    account_id: accountId,
  })
  if (!hasTargetD1(finalSettings?.bindings ?? [])) {
    throw new Error('Worker settings verification failed after cutover')
  }

  console.log('Live Worker deployment now uses poleczka-dev for DB.')
}

async function verifySourceStableAndFinalSync() {
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    await syncUntilEqual(`Post-cutover sync ${attempt}`, 3)
    const before = await Promise.all(tables.map((table) => tableDigest(sourceDatabaseId, table)))
    await sleep(2500)
    const after = await Promise.all(tables.map((table) => tableDigest(sourceDatabaseId, table)))
    const stable = before.every((value, index) => value.count === after[index].count && value.digest === after[index].digest)
    if (stable) {
      if (!(await compareDatabases())) {
        await syncUntilEqual('Final convergence', 3)
      }
      await verifyForeignKeys()
      console.log('Source is stable, target matches it exactly, and foreign keys are clean.')
      return
    }
  }
  throw new Error('Source continued changing after Worker cutover; manual review required')
}

async function main() {
  await verifySchemas()
  await syncUntilEqual('Pre-cutover sync')
  await switchWorkerBinding()
  await verifySourceStableAndFinalSync()
  console.log('FINAL CUTOVER SUCCESS: poleczka-dev is the live authoritative D1 database.')
}

await main()
