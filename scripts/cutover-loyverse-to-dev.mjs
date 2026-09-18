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
if (sourceDatabaseId === targetDatabaseId) throw new Error('Source and target D1 databases must differ')

const client = new Cloudflare({ apiToken: token })
const tables = ['categories', 'items', 'receipts', 'receipt_lines', 'receipt_payments', 'webhook_events']
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const quoteIdentifier = (value) => `"${String(value).replaceAll('"', '""')}"`

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
    const message = payload?.errors?.map((item) => item?.message).filter(Boolean).join('; ') || `HTTP ${response.status}`
    throw new Error(`Cloudflare API failed: ${message}`)
  }
  return payload.result
}

async function d1Query(databaseId, sql, params = []) {
  const result = await api(`/accounts/${accountId}/d1/database/${databaseId}/query`, {
    method: 'POST',
    body: { sql, params },
  })
  const statement = Array.isArray(result) ? result[0] : result
  if (!statement || statement.success === false) throw new Error(`D1 statement failed: ${statement?.error || 'unknown error'}`)
  return statement.results ?? []
}

async function tableInfo(databaseId, table) {
  return d1Query(databaseId, `PRAGMA table_info(${quoteIdentifier(table)})`)
}

async function listUserTables(databaseId) {
  return d1Query(databaseId, `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name <> '_cf_KV' ORDER BY name`)
}

async function verifySchemas() {
  const expected = [...tables].sort()
  for (const [label, id] of [['source', sourceDatabaseId], ['target', targetDatabaseId]]) {
    const found = (await listUserTables(id)).map((row) => row.name).sort()
    if (JSON.stringify(found) !== JSON.stringify(expected)) throw new Error(`Unexpected ${label} schema: ${found.join(', ')}`)
    for (const table of tables) {
      if ((await tableInfo(id, table)).length === 0) throw new Error(`Missing ${label} table ${table}`)
    }
  }
  console.log('Schema preflight passed.')
}

async function fetchAllRows(databaseId, table) {
  const info = await tableInfo(databaseId, table)
  const columns = info.map((row) => row.name)
  const pk = info.filter((row) => Number(row.pk) > 0).sort((a, b) => Number(a.pk) - Number(b.pk)).map((row) => row.name)
  if (!pk.length) throw new Error(`Table ${table} has no primary key`)
  const orderSql = pk.map(quoteIdentifier).join(', ')
  const rows = []
  for (let offset = 0; ; offset += 100) {
    const page = await d1Query(databaseId, `SELECT * FROM ${quoteIdentifier(table)} ORDER BY ${orderSql} LIMIT 100 OFFSET ?`, [offset])
    rows.push(...page)
    if (page.length < 100) break
  }
  return { columns, pk, rows }
}

async function upsertRows(table, columns, pk, rows) {
  if (!rows.length) return
  const nonPk = columns.filter((column) => !pk.includes(column))
  const conflictSql = pk.map(quoteIdentifier).join(', ')
  const updateSql = nonPk.length
    ? `DO UPDATE SET ${nonPk.map((column) => `${quoteIdentifier(column)}=excluded.${quoteIdentifier(column)}`).join(', ')}`
    : 'DO NOTHING'
  const rowsPerInsert = Math.max(1, Math.floor(80 / columns.length))

  for (let offset = 0; offset < rows.length; offset += rowsPerInsert) {
    const chunk = rows.slice(offset, offset + rowsPerInsert)
    const placeholder = `(${columns.map(() => '?').join(',')})`
    await d1Query(
      targetDatabaseId,
      `INSERT INTO ${quoteIdentifier(table)} (${columns.map(quoteIdentifier).join(',')}) VALUES ${chunk.map(() => placeholder).join(',')}
       ON CONFLICT (${conflictSql}) ${updateSql}`,
      chunk.flatMap((row) => columns.map((column) => row[column] ?? null)),
    )
  }
}

async function syncOnce() {
  for (const table of tables) {
    const { columns, pk, rows } = await fetchAllRows(sourceDatabaseId, table)
    await upsertRows(table, columns, pk, rows)
  }
}

async function assertNoTargetOnlyRows() {
  for (const table of tables) {
    const source = await fetchAllRows(sourceDatabaseId, table)
    const target = await fetchAllRows(targetDatabaseId, table)
    const keyOf = (row) => JSON.stringify(source.pk.map((column) => row[column] ?? null))
    const sourceKeys = new Set(source.rows.map(keyOf))
    const extras = target.rows.filter((row) => !sourceKeys.has(keyOf(row)))
    if (extras.length) throw new Error(`Target contains ${extras.length} row(s) in ${table} that are absent from source`)
  }
}

async function tableDigest(databaseId, table) {
  const { columns, rows } = await fetchAllRows(databaseId, table)
  const hash = crypto.createHash('sha256')
  for (const row of rows) {
    hash.update(JSON.stringify(columns.map((column) => row[column] ?? null)))
    hash.update('\n')
  }
  return { count: rows.length, digest: hash.digest('hex') }
}

async function compareDatabases() {
  for (const table of tables) {
    const [source, target] = await Promise.all([tableDigest(sourceDatabaseId, table), tableDigest(targetDatabaseId, table)])
    if (source.count !== target.count || source.digest !== target.digest) return false
  }
  return true
}

async function verifyForeignKeys() {
  if ((await d1Query(targetDatabaseId, 'PRAGMA foreign_key_check')).length) throw new Error('Target foreign-key check failed')
}

function d1BindingId(binding) {
  return binding?.database_id ?? binding?.id ?? null
}

function hasTargetD1(bindings) {
  const matches = (bindings ?? []).filter((binding) => binding?.name === 'DB' && binding?.type === 'd1')
  return matches.length === 1 && d1BindingId(matches[0]) === targetDatabaseId
}

async function getVersions() {
  const result = await api(`/accounts/${accountId}/workers/scripts/${workerName}/versions?deployable=true`)
  return result?.items ?? []
}

async function getVersionBindings(versionId) {
  const result = await api(`/accounts/${accountId}/workers/scripts/${workerName}/versions/${versionId}`)
  return result?.resources?.bindings ?? []
}

async function getActiveDeployment() {
  const result = await api(`/accounts/${accountId}/workers/scripts/${workerName}/deployments`)
  const deployment = result?.deployments?.[0]
  if (!deployment) throw new Error('No active Worker deployment found')
  return deployment
}

async function activeDeploymentUsesTarget() {
  const deployment = await getActiveDeployment()
  const active = (deployment.versions ?? []).filter((item) => Number(item.percentage) > 0)
  if (!active.length) return false
  for (const item of active) {
    if (!hasTargetD1(await getVersionBindings(item.version_id))) return false
  }
  return true
}

async function switchWorkerBinding() {
  const current = await client.workers.scripts.scriptAndVersionSettings.get(workerName, { account_id: accountId })
  const bindings = current?.bindings ?? []
  const currentDb = bindings.filter((binding) => binding?.name === 'DB' && binding?.type === 'd1')
  if (currentDb.length !== 1) throw new Error(`Expected one DB D1 binding, found ${currentDb.length}`)

  if (d1BindingId(currentDb[0]) === targetDatabaseId && await activeDeploymentUsesTarget()) {
    console.log('Worker is already live on poleczka-dev.')
    return
  }

  let candidateId = null
  if (d1BindingId(currentDb[0]) === sourceDatabaseId) {
    const before = new Set((await getVersions()).map((item) => item.id).filter(Boolean))
    const nextBindings = bindings.map((binding) => {
      if (!binding?.name) throw new Error('Encountered unnamed Worker binding')
      return binding.name === 'DB' && binding.type === 'd1'
        ? { name: 'DB', type: 'd1', database_id: targetDatabaseId }
        : { name: binding.name, type: 'inherit', version_id: 'latest' }
    })

    await client.workers.scripts.scriptAndVersionSettings.edit(workerName, {
      account_id: accountId,
      settings: {
        bindings: nextBindings,
        annotations: { 'workers/message': 'Półeczka PWA: switch D1 binding to poleczka-dev' },
      },
    })

    const versions = await getVersions()
    candidateId = versions.find((item) => item.id && !before.has(item.id))?.id ?? versions[0]?.id ?? null
  } else if (d1BindingId(currentDb[0]) === targetDatabaseId) {
    candidateId = (await getVersions()).find(async () => true)?.id ?? null
  } else {
    throw new Error('Worker DB binding points to an unexpected database')
  }

  if (!candidateId) throw new Error('Unable to identify deployable Worker version')
  if (!hasTargetD1(await getVersionBindings(candidateId))) {
    const versions = await getVersions()
    candidateId = null
    for (const version of versions) {
      if (version?.id && hasTargetD1(await getVersionBindings(version.id))) {
        candidateId = version.id
        break
      }
    }
  }
  if (!candidateId || !hasTargetD1(await getVersionBindings(candidateId))) throw new Error('No deployable Worker version uses poleczka-dev')

  if (!(await activeDeploymentUsesTarget())) {
    await api(`/accounts/${accountId}/workers/scripts/${workerName}/deployments`, {
      method: 'POST',
      body: {
        strategy: 'percentage',
        versions: [{ percentage: 100, version_id: candidateId }],
        annotations: { 'workers/message': 'Półeczka PWA: activate poleczka-dev' },
      },
    })
  }

  if (!(await activeDeploymentUsesTarget())) throw new Error('Active deployment verification failed')
  const finalSettings = await client.workers.scripts.scriptAndVersionSettings.get(workerName, { account_id: accountId })
  if (!hasTargetD1(finalSettings?.bindings ?? [])) throw new Error('Worker settings verification failed')
  console.log('Live Worker deployment now uses poleczka-dev for DB.')
}

async function finalConvergence() {
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    await syncOnce()
    await verifyForeignKeys()
    const before = await Promise.all(tables.map((table) => tableDigest(sourceDatabaseId, table)))
    await sleep(2500)
    const after = await Promise.all(tables.map((table) => tableDigest(sourceDatabaseId, table)))
    const stable = before.every((value, index) => value.count === after[index].count && value.digest === after[index].digest)
    if (stable) {
      await syncOnce()
      if (await compareDatabases()) {
        await verifyForeignKeys()
        console.log('Source is stable; target matches source exactly; foreign keys are clean.')
        return
      }
    }
  }
  throw new Error('Unable to reach stable final convergence after cutover')
}

async function main() {
  await verifySchemas()
  await assertNoTargetOnlyRows()
  await syncOnce()
  await verifyForeignKeys()
  console.log('Pre-cutover snapshot synchronized; switching live Worker now.')
  await switchWorkerBinding()
  await finalConvergence()
  console.log('FINAL CUTOVER SUCCESS: poleczka-dev is the live authoritative D1 database.')
}

await main()
