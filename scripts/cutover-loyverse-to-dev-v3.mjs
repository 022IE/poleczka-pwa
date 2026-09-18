import crypto from 'node:crypto'

const token = process.env.CLOUDFLARE_API_TOKEN
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
const sourceId = process.env.SOURCE_D1_DATABASE_ID
const targetId = process.env.TARGET_D1_DATABASE_ID
const worker = process.env.LOYVERSE_WORKER_NAME || 'poleczka-loyverse-webhook'

if (!token || !accountId || !sourceId || !targetId) throw new Error('Missing Cloudflare credentials or D1 ids')
if (sourceId === targetId) throw new Error('Source and target must differ')

const tables = ['categories', 'items', 'receipts', 'receipt_lines', 'receipt_payments', 'webhook_events']
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const qi = (v) => `"${String(v).replaceAll('"', '""')}"`

async function cf(path, { method = 'GET', body } = {}) {
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

async function patchWorkerSettings(settings) {
  const form = new FormData()
  form.append('settings', JSON.stringify(settings))
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${worker}/settings`,
    {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    },
  )
  const payload = await response.json().catch(() => null)
  if (!response.ok || !payload?.success) {
    const message = payload?.errors?.map((x) => x?.message).filter(Boolean).join('; ') || `HTTP ${response.status}`
    throw new Error(`Worker settings patch failed: ${message}`)
  }
  return payload.result
}

async function d1(id, sql, params = []) {
  const result = await cf(`/accounts/${accountId}/d1/database/${id}/query`, {
    method: 'POST',
    body: { sql, params },
  })
  const stmt = Array.isArray(result) ? result[0] : result
  if (!stmt || stmt.success === false) throw new Error(`D1 statement failed: ${stmt?.error || 'unknown'}`)
  return stmt.results ?? []
}

async function tableInfo(id, table) {
  return d1(id, `PRAGMA table_info(${qi(table)})`)
}

async function fetchRows(id, table) {
  const info = await tableInfo(id, table)
  const columns = info.map((r) => r.name)
  const pk = info.filter((r) => Number(r.pk) > 0).sort((a, b) => Number(a.pk) - Number(b.pk)).map((r) => r.name)
  if (!pk.length) throw new Error(`${table} has no primary key`)
  const rows = []
  const order = pk.map(qi).join(',')
  for (let offset = 0; ; offset += 100) {
    const page = await d1(id, `SELECT * FROM ${qi(table)} ORDER BY ${order} LIMIT 100 OFFSET ?`, [offset])
    rows.push(...page)
    if (page.length < 100) break
  }
  return { columns, pk, rows }
}

async function upsert(table, columns, pk, rows) {
  if (!rows.length) return
  const nonPk = columns.filter((c) => !pk.includes(c))
  const update = nonPk.length
    ? `DO UPDATE SET ${nonPk.map((c) => `${qi(c)}=excluded.${qi(c)}`).join(',')}`
    : 'DO NOTHING'
  const perBatch = Math.max(1, Math.floor(80 / columns.length))
  for (let offset = 0; offset < rows.length; offset += perBatch) {
    const chunk = rows.slice(offset, offset + perBatch)
    const rowMarks = `(${columns.map(() => '?').join(',')})`
    await d1(
      targetId,
      `INSERT INTO ${qi(table)} (${columns.map(qi).join(',')}) VALUES ${chunk.map(() => rowMarks).join(',')}
       ON CONFLICT (${pk.map(qi).join(',')}) ${update}`,
      chunk.flatMap((row) => columns.map((c) => row[c] ?? null)),
    )
  }
}

async function syncOnce() {
  for (const table of tables) {
    const data = await fetchRows(sourceId, table)
    await upsert(table, data.columns, data.pk, data.rows)
  }
}

async function verifyNoTargetOnlyRows() {
  for (const table of tables) {
    const [source, target] = await Promise.all([fetchRows(sourceId, table), fetchRows(targetId, table)])
    const key = (row) => JSON.stringify(source.pk.map((c) => row[c] ?? null))
    const sourceKeys = new Set(source.rows.map(key))
    if (target.rows.some((row) => !sourceKeys.has(key(row)))) {
      throw new Error(`Target contains rows in ${table} that are absent from source`)
    }
  }
}

async function digest(id, table) {
  const { columns, rows } = await fetchRows(id, table)
  const h = crypto.createHash('sha256')
  for (const row of rows) {
    h.update(JSON.stringify(columns.map((c) => row[c] ?? null)))
    h.update('\n')
  }
  return { count: rows.length, hash: h.digest('hex') }
}

async function equal() {
  for (const table of tables) {
    const [a, b] = await Promise.all([digest(sourceId, table), digest(targetId, table)])
    if (a.count !== b.count || a.hash !== b.hash) return false
  }
  return true
}

async function fkOk() {
  const errors = await d1(targetId, 'PRAGMA foreign_key_check')
  if (errors.length) throw new Error('Target foreign keys are inconsistent')
}

const bindingId = (b) => b?.database_id ?? b?.id ?? null
const usesTarget = (bindings) => {
  const db = (bindings ?? []).filter((b) => b?.name === 'DB' && b?.type === 'd1')
  return db.length === 1 && bindingId(db[0]) === targetId
}

async function settings() {
  return cf(`/accounts/${accountId}/workers/scripts/${worker}/settings`)
}

async function versions() {
  const result = await cf(`/accounts/${accountId}/workers/scripts/${worker}/versions?deployable=true`)
  return result?.items ?? []
}

async function versionBindings(id) {
  const result = await cf(`/accounts/${accountId}/workers/scripts/${worker}/versions/${id}`)
  return result?.resources?.bindings ?? []
}

async function targetVersion() {
  for (const version of await versions()) {
    if (version?.id && usesTarget(await versionBindings(version.id))) return version.id
  }
  return null
}

async function activeUsesTarget() {
  const result = await cf(`/accounts/${accountId}/workers/scripts/${worker}/deployments`)
  const deployment = result?.deployments?.[0]
  if (!deployment) throw new Error('No active Worker deployment')
  const active = (deployment.versions ?? []).filter((v) => Number(v.percentage) > 0)
  if (!active.length) return false
  for (const v of active) if (!usesTarget(await versionBindings(v.version_id))) return false
  return true
}

async function switchWorker() {
  let current = await settings()
  const db = (current?.bindings ?? []).filter((b) => b?.name === 'DB' && b?.type === 'd1')
  if (db.length !== 1) throw new Error(`Expected one DB binding, found ${db.length}`)

  if (bindingId(db[0]) === targetId && await activeUsesTarget()) {
    console.log('Worker already serves poleczka-dev.')
    return
  }

  if (bindingId(db[0]) === sourceId) {
    const nextBindings = (current.bindings ?? []).map((b) => {
      if (!b?.name) throw new Error('Unnamed Worker binding')
      return b.name === 'DB' && b.type === 'd1'
        ? { name: 'DB', type: 'd1', database_id: targetId }
        : { name: b.name, type: 'inherit', version_id: 'latest' }
    })
    await patchWorkerSettings({
      bindings: nextBindings,
      annotations: { 'workers/message': 'Półeczka PWA: switch D1 binding to poleczka-dev' },
    })
    current = await settings()
    if (!usesTarget(current?.bindings ?? [])) throw new Error('Settings patch did not switch DB to target')
  } else if (bindingId(db[0]) !== targetId) {
    throw new Error('DB binding points to an unexpected database')
  }

  const versionId = await targetVersion()
  if (!versionId) throw new Error('No deployable Worker version with poleczka-dev binding')

  if (!(await activeUsesTarget())) {
    await cf(`/accounts/${accountId}/workers/scripts/${worker}/deployments`, {
      method: 'POST',
      body: {
        strategy: 'percentage',
        versions: [{ percentage: 100, version_id: versionId }],
        annotations: { 'workers/message': 'Półeczka PWA: activate poleczka-dev' },
      },
    })
  }

  if (!(await activeUsesTarget())) throw new Error('Active Worker deployment did not switch to target')
  console.log('Live Worker deployment verified on poleczka-dev.')
}

async function finalConvergence() {
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    await syncOnce()
    await fkOk()
    const before = await Promise.all(tables.map((t) => digest(sourceId, t)))
    await sleep(2500)
    const after = await Promise.all(tables.map((t) => digest(sourceId, t)))
    const stable = before.every((v, i) => v.count === after[i].count && v.hash === after[i].hash)
    if (stable) {
      await syncOnce()
      if (await equal()) {
        await fkOk()
        console.log('Final source snapshot is stable; databases match exactly; foreign keys are clean.')
        return
      }
    }
  }
  throw new Error('Final convergence did not stabilize')
}

async function main() {
  await verifyNoTargetOnlyRows()
  await syncOnce()
  await fkOk()
  console.log('Pre-cutover snapshot synchronized.')
  await switchWorker()
  await finalConvergence()
  console.log('FINAL CUTOVER SUCCESS: poleczka-dev is authoritative and live.')
}

await main()
