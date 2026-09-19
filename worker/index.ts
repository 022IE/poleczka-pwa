import { BUILD_BRANCH, BUILD_COMMIT_SHA, BUILD_TIME } from './buildInfo'

export interface Env {
  DB: D1Database
  PIPELINE_HUB: DurableObjectNamespace
  TELEGRAM_HEALTH_URL?: string
  TELEGRAM_BOT_TOKEN?: string
  DNR_QUARTER_LIMIT?: string
}

type StageState = 'waiting' | 'running' | 'ready' | 'failed' | 'blocked' | 'unknown'
type StageKey = 'work' | 'github' | 'build' | 'cloudflare' | 'online'
type PipelinePhase = 'build_start' | 'build_ready' | 'build_failed' | 'deploy_timeout' | 'online'

type WorkStatus = {
  state?: 'editing' | 'awaiting_publish' | 'idle' | 'unknown'
  label?: string
  task?: string
  updatedAt?: string | null
}

type PipelineStage = {
  state: StageState
  label: string
}

type PipelineSnapshot = {
  ok: true
  state: 'building' | 'ready' | 'failed' | 'unknown'
  branch: string
  status: string | null
  conclusion: string | null
  runNumber: number | null
  headSha: string | null
  headShaShort: string | null
  deployedSha: string | null
  deployedShaShort: string | null
  deployedBranch: string | null
  deployedAt: string | null
  updatedAt: string | null
  latestOnline: boolean
  url: string | null
  work: WorkStatus
  stages: Record<StageKey, PipelineStage>
}

type PipelineEvent = {
  type: 'work' | PipelinePhase
  branch?: string
  sha?: string | null
  runNumber?: number | null
  url?: string | null
  work?: WorkStatus
  updatedAt?: string | null
}

type GitHubWorkflowRun = {
  id?: number
  status?: string | null
  conclusion?: string | null
  head_branch?: string | null
  head_sha?: string | null
  run_number?: number
  created_at?: string | null
  updated_at?: string | null
  html_url?: string | null
}

type GitHubRunsResponse = {
  workflow_runs?: GitHubWorkflowRun[]
}

function nowIso() {
  return new Date().toISOString()
}

function shortSha(value?: string | null) {
  return value && value !== 'unknown' ? value.slice(0, 8) : null
}

function deployedShaFromBuild() {
  return BUILD_COMMIT_SHA !== 'unknown' ? BUILD_COMMIT_SHA : null
}

function workStage(work: WorkStatus): PipelineStage {
  if (work.state === 'editing') return { state: 'running', label: work.label || 'Wprowadzanie poprawek' }
  if (work.state === 'awaiting_publish') return { state: 'ready', label: work.label || 'Poprawki zakończone' }
  if (work.state === 'idle') return { state: 'ready', label: work.label || 'Gotowe' }
  return { state: 'waiting', label: work.label || 'Brak aktywnych prac' }
}

function isAtOrAfter(value?: string | null, reference?: string | null) {
  if (!value || !reference) return false
  const a = Date.parse(value)
  const b = Date.parse(reference)
  return Number.isFinite(a) && Number.isFinite(b) && a >= b
}

function blankSnapshot(branch: string): PipelineSnapshot {
  const deployedSha = deployedShaFromBuild()
  return {
    ok: true,
    state: 'unknown',
    branch,
    status: null,
    conclusion: null,
    runNumber: null,
    headSha: null,
    headShaShort: null,
    deployedSha,
    deployedShaShort: shortSha(deployedSha),
    deployedBranch: BUILD_BRANCH !== 'unknown' ? BUILD_BRANCH : branch,
    deployedAt: BUILD_TIME !== 'unknown' ? BUILD_TIME : null,
    updatedAt: null,
    latestOnline: false,
    url: null,
    work: { state: 'idle', label: 'Brak aktywnych prac', task: '', updatedAt: null },
    stages: {
      work: { state: 'waiting', label: 'Brak aktywnych prac' },
      github: { state: 'waiting', label: 'Czeka na zmianę' },
      build: { state: 'waiting', label: 'Oczekuje' },
      cloudflare: { state: 'waiting', label: 'Oczekuje' },
      online: deployedSha
        ? { state: 'ready', label: 'Wersja online' }
        : { state: 'unknown', label: 'Niepotwierdzone' },
    },
  }
}

async function fetchWorkStatus(): Promise<WorkStatus> {
  for (const branch of ['pipeline-status', 'dev']) {
    try {
      const response = await fetch(
        `https://raw.githubusercontent.com/022IE/poleczka-pwa/${branch}/status/work-status.json?_=${Date.now()}`,
        {
          headers: {
            'User-Agent': 'poleczka-pwa-pipeline',
            'Cache-Control': 'no-cache',
          },
          cf: { cacheTtl: 0, cacheEverything: false },
        },
      )
      if (response.ok) return (await response.json()) as WorkStatus
    } catch {
      // Próbujemy kolejnego źródła; status prac nie może wywrócić całego pipeline.
    }
  }

  return { state: 'unknown', label: 'Status prac chwilowo niedostępny', task: '', updatedAt: null }
}

async function fetchLatestRun(branch: string): Promise<GitHubWorkflowRun | null> {
  try {
    // Pytamy wyłącznie o workflow build.yml. Inne workflow nie mogą nadpisać stanu buildu PWA.
    const endpoint = new URL('https://api.github.com/repos/022IE/poleczka-pwa/actions/workflows/build.yml/runs')
    endpoint.searchParams.set('branch', branch)
    endpoint.searchParams.set('event', 'push')
    endpoint.searchParams.set('per_page', '1')

    const response = await fetch(endpoint, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'poleczka-pwa-pipeline',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      cf: { cacheTtl: 0, cacheEverything: false },
    })

    if (!response.ok) return null
    const payload = (await response.json()) as GitHubRunsResponse
    return payload.workflow_runs?.[0] || null
  } catch {
    return null
  }
}

async function bootstrapSnapshot(branch: string): Promise<PipelineSnapshot> {
  const snapshot = blankSnapshot(branch)
  const [work, run] = await Promise.all([fetchWorkStatus(), fetchLatestRun(branch)])

  snapshot.work = work
  snapshot.stages.work = workStage(work)
  snapshot.updatedAt = work.updatedAt || snapshot.updatedAt

  if (!run) {
    if (work.state === 'editing') {
      snapshot.stages.github = { state: 'waiting', label: 'Czeka na zapis zmian' }
      snapshot.stages.build = { state: 'waiting', label: 'Oczekuje na zmiany' }
      snapshot.stages.cloudflare = { state: 'waiting', label: 'Oczekuje' }
    }
    return snapshot
  }

  snapshot.branch = run.head_branch || branch
  snapshot.runNumber = run.run_number ?? null
  snapshot.headSha = run.head_sha || null
  snapshot.headShaShort = shortSha(snapshot.headSha)
  snapshot.url = run.html_url || null
  snapshot.status = run.status ?? null
  snapshot.conclusion = run.conclusion ?? null
  snapshot.updatedAt = run.updated_at || snapshot.updatedAt

  // Jeżeli build został utworzony już po rozpoczęciu prac, commit istnieje i etap "Prace"
  // musi być zakończony nawet wtedy, gdy osobny event work-status nie dotarł.
  if (snapshot.work.state === 'editing' && isAtOrAfter(run.created_at, snapshot.work.updatedAt)) {
    snapshot.work = {
      ...snapshot.work,
      state: 'awaiting_publish',
      label: 'Poprawki przekazane',
    }
    snapshot.stages.work = workStage(snapshot.work)
  }

  if (snapshot.work.state === 'editing') {
    snapshot.stages.github = { state: 'waiting', label: 'Czeka na zapis zmian' }
    snapshot.stages.build = { state: 'waiting', label: 'Oczekuje na zmiany' }
    snapshot.stages.cloudflare = { state: 'waiting', label: 'Oczekuje' }
    snapshot.stages.online = snapshot.deployedSha
      ? { state: 'ready', label: 'Poprzednia wersja online' }
      : { state: 'unknown', label: 'Niepotwierdzone' }
    return snapshot
  }

  snapshot.stages.github = { state: 'ready', label: 'Zmiana wysłana' }

  const deployedSha = snapshot.deployedSha
  const isLatestOnline = Boolean(snapshot.headSha && deployedSha && snapshot.headSha === deployedSha)
  snapshot.latestOnline = isLatestOnline

  if (run.status && run.status !== 'completed') {
    snapshot.state = 'building'
    snapshot.stages.build = { state: 'running', label: 'Build trwa' }
    snapshot.stages.cloudflare = { state: 'waiting', label: 'Oczekuje na build' }
  } else if (run.status === 'completed' && run.conclusion === 'success') {
    snapshot.state = 'ready'
    snapshot.stages.build = { state: 'ready', label: 'Build gotowy' }
    snapshot.stages.cloudflare = isLatestOnline
      ? { state: 'ready', label: 'Wdrożono' }
      : { state: 'running', label: 'Wdrażanie' }
  } else if (run.status === 'completed' && run.conclusion) {
    snapshot.state = 'failed'
    snapshot.stages.build = { state: 'failed', label: 'Build nieudany' }
    snapshot.stages.cloudflare = { state: 'blocked', label: 'Zablokowane' }
  }

  snapshot.stages.online = isLatestOnline
    ? { state: 'ready', label: 'Najnowsza wersja online' }
    : deployedSha
      ? { state: 'waiting', label: 'Czeka na nową wersję' }
      : { state: 'unknown', label: 'Niepotwierdzone' }

  return snapshot
}

async function pipelineStub(env: Env) {
  const id = env.PIPELINE_HUB.idFromName('global')
  return env.PIPELINE_HUB.get(id)
}

async function getStoredSnapshot(env: Env): Promise<PipelineSnapshot | null> {
  const stub = await pipelineStub(env)
  const response = await stub.fetch('https://pipeline.internal/snapshot')
  if (!response.ok) return null
  return (await response.json()) as PipelineSnapshot
}

async function publishSnapshot(env: Env, snapshot: PipelineSnapshot) {
  const stub = await pipelineStub(env)
  await stub.fetch('https://pipeline.internal/publish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(snapshot),
  })
}

function snapshotNeedsRepair(snapshot: PipelineSnapshot | null) {
  if (!snapshot) return true
  const stages = Object.values(snapshot.stages || {})
  if (!stages.length) return true
  return stages.every((stage) => stage.state === 'unknown')
}

function mergeStoredTerminalState(fresh: PipelineSnapshot, stored: PipelineSnapshot | null): PipelineSnapshot {
  if (!stored || !fresh.headSha || stored.headSha !== fresh.headSha) return fresh

  // Timeout wdrożenia jest stanem terminalnym po stronie monitora. Zachowujemy go,
  // dopóki aktualny Worker nie potwierdzi swoim BUILD_COMMIT_SHA, że nowa wersja jest online.
  if (!fresh.latestOnline && stored.stages?.cloudflare?.state === 'failed') {
    fresh.state = 'failed'
    fresh.stages.cloudflare = stored.stages.cloudflare
    fresh.stages.online = stored.stages.online
  }

  return fresh
}

async function reconcileSnapshot(env: Env, branch: string): Promise<PipelineSnapshot> {
  const stored = await getStoredSnapshot(env)
  const fresh = await bootstrapSnapshot(branch)

  if (!fresh.headSha && stored && !snapshotNeedsRepair(stored)) return stored

  const reconciled = mergeStoredTerminalState(fresh, stored)
  await publishSnapshot(env, reconciled)
  return reconciled
}

function applyEvent(current: PipelineSnapshot, event: PipelineEvent): PipelineSnapshot {
  const snapshot: PipelineSnapshot = JSON.parse(JSON.stringify(current)) as PipelineSnapshot
  const updatedAt = event.updatedAt || nowIso()
  const sha = event.sha || snapshot.headSha

  snapshot.ok = true
  snapshot.branch = event.branch || snapshot.branch || 'dev'
  snapshot.updatedAt = updatedAt
  if (event.runNumber !== undefined) snapshot.runNumber = event.runNumber
  if (event.url !== undefined) snapshot.url = event.url
  if (sha) {
    snapshot.headSha = sha
    snapshot.headShaShort = shortSha(sha)
  }

  if (event.type === 'work') {
    const work = event.work || { state: 'unknown', label: 'Status prac nieznany', task: '', updatedAt }
    snapshot.work = { ...work, updatedAt: work.updatedAt || updatedAt }
    snapshot.stages.work = workStage(snapshot.work)

    if (work.state === 'editing') {
      snapshot.latestOnline = false
      snapshot.state = 'unknown'
      snapshot.stages.github = { state: 'waiting', label: 'Czeka na zapis zmian' }
      snapshot.stages.build = { state: 'waiting', label: 'Oczekuje na zmiany' }
      snapshot.stages.cloudflare = { state: 'waiting', label: 'Oczekuje' }
      snapshot.stages.online = snapshot.deployedSha
        ? { state: 'ready', label: 'Poprzednia wersja online' }
        : { state: 'unknown', label: 'Niepotwierdzone' }
    }
    return snapshot
  }

  snapshot.stages.work = snapshot.work.state === 'editing'
    ? { state: 'ready', label: 'Poprawki przekazane' }
    : workStage(snapshot.work)
  snapshot.stages.github = { state: 'ready', label: 'Zmiana wysłana' }

  if (event.type === 'build_start') {
    snapshot.state = 'building'
    snapshot.status = 'in_progress'
    snapshot.conclusion = null
    snapshot.latestOnline = false
    snapshot.stages.build = { state: 'running', label: 'Build trwa' }
    snapshot.stages.cloudflare = { state: 'waiting', label: 'Oczekuje na build' }
    snapshot.stages.online = snapshot.deployedSha
      ? { state: 'waiting', label: 'Czeka na nową wersję' }
      : { state: 'unknown', label: 'Niepotwierdzone' }
  }

  if (event.type === 'build_ready') {
    snapshot.state = 'ready'
    snapshot.status = 'completed'
    snapshot.conclusion = 'success'
    snapshot.latestOnline = false
    snapshot.stages.build = { state: 'ready', label: 'Build gotowy' }
    snapshot.stages.cloudflare = { state: 'running', label: 'Wdrażanie' }
    snapshot.stages.online = { state: 'waiting', label: 'Czeka na nową wersję' }
  }

  if (event.type === 'build_failed') {
    snapshot.state = 'failed'
    snapshot.status = 'completed'
    snapshot.conclusion = 'failure'
    snapshot.latestOnline = false
    snapshot.stages.build = { state: 'failed', label: 'Build nieudany' }
    snapshot.stages.cloudflare = { state: 'blocked', label: 'Zablokowane' }
    snapshot.stages.online = snapshot.deployedSha
      ? { state: 'ready', label: 'Poprzednia wersja online' }
      : { state: 'unknown', label: 'Niepotwierdzone' }
  }

  if (event.type === 'deploy_timeout') {
    snapshot.state = 'failed'
    snapshot.latestOnline = false
    snapshot.stages.build = { state: 'ready', label: 'Build gotowy' }
    snapshot.stages.cloudflare = { state: 'failed', label: 'Brak potwierdzenia wdrożenia' }
    snapshot.stages.online = snapshot.deployedSha
      ? { state: 'ready', label: 'Poprzednia wersja online' }
      : { state: 'unknown', label: 'Niepotwierdzone' }
  }

  if (event.type === 'online') {
    snapshot.state = 'ready'
    snapshot.status = 'completed'
    snapshot.conclusion = 'success'
    snapshot.latestOnline = true
    snapshot.deployedSha = sha || deployedShaFromBuild()
    snapshot.deployedShaShort = shortSha(snapshot.deployedSha)
    snapshot.deployedBranch = snapshot.branch
    snapshot.deployedAt = updatedAt
    snapshot.stages.build = { state: 'ready', label: 'Build gotowy' }
    snapshot.stages.cloudflare = { state: 'ready', label: 'Wdrożono' }
    snapshot.stages.online = { state: 'ready', label: 'Najnowsza wersja online' }
  }

  return snapshot
}


type SalesQuery = {
  from: string | null
  to: string | null
  payment: string | null
  category: string | null
  item: string | null
  search: string | null
}

const SALES_TIME_ZONE = 'Europe/Warsaw'

function salesJson(payload: unknown, status = 200) {
  return Response.json(payload, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  })
}

function validYmd(value: string | null) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value))
}

function addDaysYmd(value: string, days: number) {
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + days))
  return date.toISOString().slice(0, 10)
}

function timeZoneOffsetMs(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)

  const pick = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value || 0)
  const asUtc = Date.UTC(
    pick('year'),
    pick('month') - 1,
    pick('day'),
    pick('hour'),
    pick('minute'),
    pick('second'),
  )
  return asUtc - date.getTime()
}

function warsawMidnightUtcIso(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  const localWallTimeAsUtc = Date.UTC(year, month - 1, day, 0, 0, 0)
  let instant = new Date(localWallTimeAsUtc)

  for (let index = 0; index < 2; index += 1) {
    const offset = timeZoneOffsetMs(instant, SALES_TIME_ZONE)
    instant = new Date(localWallTimeAsUtc - offset)
  }

  return instant.toISOString()
}

function parseSalesQuery(url: URL): SalesQuery {
  const value = (name: string) => url.searchParams.get(name)?.trim() || null
  const from = value('from')
  const to = value('to')

  return {
    from: validYmd(from) ? from : null,
    to: validYmd(to) ? to : null,
    payment: value('payment'),
    category: value('category'),
    item: value('item'),
    search: value('search'),
  }
}

function escapeLike(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

function buildReceiptWhere(filters: SalesQuery) {
  const clauses = [
    "COALESCE(r.receipt_type, 'SALE') = 'SALE'",
    'r.cancelled_at IS NULL',
  ]
  const params: Array<string | number> = []

  if (filters.from) {
    clauses.push('r.receipt_date >= ?')
    params.push(warsawMidnightUtcIso(filters.from))
  }

  if (filters.to) {
    clauses.push('r.receipt_date < ?')
    params.push(warsawMidnightUtcIso(addDaysYmd(filters.to, 1)))
  }

  if (filters.payment) {
    clauses.push(`EXISTS (
      SELECT 1 FROM receipt_payments pf
      WHERE pf.receipt_number = r.receipt_number
        AND COALESCE(NULLIF(pf.payment_type_id, ''), NULLIF(pf.type, ''), pf.name) = ?
    )`)
    params.push(filters.payment)
  }

  if (filters.category) {
    clauses.push(`EXISTS (
      SELECT 1
      FROM receipt_lines lfc
      LEFT JOIN items ifc ON ifc.item_id = lfc.item_id
      WHERE lfc.receipt_number = r.receipt_number
        AND ifc.category_id = ?
    )`)
    params.push(filters.category)
  }

  if (filters.item) {
    clauses.push(`EXISTS (
      SELECT 1
      FROM receipt_lines lfi
      WHERE lfi.receipt_number = r.receipt_number
        AND lfi.item_id = ?
    )`)
    params.push(filters.item)
  }

  if (filters.search) {
    const pattern = `%${escapeLike(filters.search)}%`
    clauses.push(`(
      r.receipt_number LIKE ? ESCAPE '\\'
      OR EXISTS (
        SELECT 1
        FROM receipt_lines lfs
        LEFT JOIN items ifs ON ifs.item_id = lfs.item_id
        WHERE lfs.receipt_number = r.receipt_number
          AND (
            COALESCE(ifs.item_name, lfs.item_name, '') LIKE ? ESCAPE '\\'
            OR CAST(COALESCE(lfs.delivery_number, -1) AS TEXT) LIKE ? ESCAPE '\\'
          )
      )
    )`)
    params.push(pattern, pattern, pattern)
  }

  return { sql: clauses.join('\n AND '), params }
}

function buildSummaryWhere(filters: SalesQuery) {
  const clauses = [
    "COALESCE(r.receipt_type, 'SALE') = 'SALE'",
    'r.cancelled_at IS NULL',
  ]
  const params: Array<string | number> = []

  if (filters.from) {
    clauses.push('r.receipt_date >= ?')
    params.push(warsawMidnightUtcIso(filters.from))
  }

  if (filters.to) {
    clauses.push('r.receipt_date < ?')
    params.push(warsawMidnightUtcIso(addDaysYmd(filters.to, 1)))
  }

  if (filters.payment) {
    clauses.push(`EXISTS (
      SELECT 1 FROM receipt_payments ps
      WHERE ps.receipt_number = r.receipt_number
        AND COALESCE(NULLIF(ps.payment_type_id, ''), NULLIF(ps.type, ''), ps.name) = ?
    )`)
    params.push(filters.payment)
  }

  if (filters.category) {
    clauses.push('i.category_id = ?')
    params.push(filters.category)
  }

  if (filters.item) {
    clauses.push('l.item_id = ?')
    params.push(filters.item)
  }

  if (filters.search) {
    const pattern = `%${escapeLike(filters.search)}%`
    clauses.push(`(
      r.receipt_number LIKE ? ESCAPE '\\'
      OR COALESCE(i.item_name, l.item_name, '') LIKE ? ESCAPE '\\'
      OR CAST(COALESCE(l.delivery_number, -1) AS TEXT) LIKE ? ESCAPE '\\'
    )`)
    params.push(pattern, pattern, pattern)
  }

  return { sql: clauses.join('\n AND '), params }
}

function money(value: unknown) {
  const number = Number(value || 0)
  return Math.round((number + Number.EPSILON) * 100) / 100
}

async function salesCategories(env: Env) {
  const result = await env.DB.prepare(`
    SELECT category_id AS id, name
    FROM categories
    WHERE deleted_at IS NULL
      AND TRIM(COALESCE(name, '')) <> ''
    ORDER BY name COLLATE NOCASE
  `).all<{ id: string; name: string }>()

  return salesJson({
    ok: true,
    items: (result.results || []).map((row) => ({
      ...row,
      active: Number(row.active) === 1,
    })),
  })
}

async function salesItems(url: URL, env: Env) {
  const category = url.searchParams.get('category')?.trim()
  const where = category ? 'AND category_id = ?' : ''
  const statement = env.DB.prepare(`
    SELECT item_id AS id, item_name AS name, category_id AS categoryId
    FROM items
    WHERE deleted_at IS NULL
      AND TRIM(COALESCE(item_name, '')) <> ''
      ${where}
    ORDER BY item_name COLLATE NOCASE
  `)
  const result = category
    ? await statement.bind(category).all<{ id: string; name: string; categoryId: string | null }>()
    : await statement.all<{ id: string; name: string; categoryId: string | null }>()

  return salesJson({ ok: true, items: result.results || [] })
}

async function salesPaymentTypes(env: Env) {
  const result = await env.DB.prepare(`
    SELECT
      COALESCE(NULLIF(payment_type_id, ''), NULLIF(type, ''), name) AS id,
      MAX(name) AS name,
      MAX(type) AS type
    FROM receipt_payments
    WHERE TRIM(COALESCE(name, '')) <> ''
    GROUP BY COALESCE(NULLIF(payment_type_id, ''), NULLIF(type, ''), name)
    ORDER BY name COLLATE NOCASE
  `).all<{ id: string; name: string; type: string | null }>()

  return salesJson({ ok: true, items: result.results || [] })
}

async function salesSummary(url: URL, env: Env) {
  const filters = parseSalesQuery(url)
  const where = buildSummaryWhere(filters)
  const row = await env.DB.prepare(`
    SELECT
      COUNT(DISTINCT r.receipt_number) AS receipts,
      COALESCE(SUM(l.quantity), 0) AS units,
      COALESCE(SUM(l.gross_total_money), 0) AS gross,
      COALESCE(SUM(l.total_discount), 0) AS discount,
      COALESCE(SUM(l.total_money), 0) AS net
    FROM receipts r
    JOIN receipt_lines l ON l.receipt_number = r.receipt_number
    LEFT JOIN items i ON i.item_id = l.item_id
    WHERE ${where.sql}
  `).bind(...where.params).first<{
    receipts: number
    units: number
    gross: number
    discount: number
    net: number
  }>()

  const receipts = Number(row?.receipts || 0)
  const net = money(row?.net)

  return salesJson({
    ok: true,
    receipts,
    units: Number(row?.units || 0),
    gross: money(row?.gross),
    discount: money(row?.discount),
    net,
    averageReceipt: receipts ? money(net / receipts) : 0,
  })
}

async function salesReceipts(url: URL, env: Env) {
  const filters = parseSalesQuery(url)
  const where = buildReceiptWhere(filters)
  const page = Math.max(1, Number.parseInt(url.searchParams.get('page') || '1', 10) || 1)
  const requestedPageSize = Number.parseInt(url.searchParams.get('pageSize') || '25', 10) || 25
  const pageSize = [25, 50, 100].includes(requestedPageSize) ? requestedPageSize : 25
  const sort = url.searchParams.get('sort') || 'date'
  const order = url.searchParams.get('order') === 'asc' ? 'ASC' : 'DESC'
  const sortSql: Record<string, string> = {
    date: 'r.receipt_date',
    gross: '(COALESCE(r.total_money, 0) + COALESCE(r.total_discount, 0))',
    discount: 'COALESCE(r.total_discount, 0)',
    net: 'COALESCE(r.total_money, 0)',
    units: 'COALESCE(lt.units, 0)',
  }
  const orderBy = sortSql[sort] || sortSql.date

  const countRow = await env.DB.prepare(`
    SELECT COUNT(*) AS total
    FROM receipts r
    WHERE ${where.sql}
  `).bind(...where.params).first<{ total: number }>()

  const total = Number(countRow?.total || 0)
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(page, totalPages)
  const offset = (safePage - 1) * pageSize

  const result = await env.DB.prepare(`
    WITH line_totals AS (
      SELECT
        receipt_number,
        COUNT(*) AS positions,
        COALESCE(SUM(quantity), 0) AS units
      FROM receipt_lines
      GROUP BY receipt_number
    )
    SELECT
      r.receipt_number AS receiptNumber,
      r.receipt_date AS date,
      COALESCE(lt.positions, 0) AS positions,
      COALESCE(lt.units, 0) AS units,
      ROUND(COALESCE(r.total_money, 0) + COALESCE(r.total_discount, 0), 2) AS gross,
      ROUND(COALESCE(r.total_discount, 0), 2) AS discount,
      ROUND(COALESCE(r.total_money, 0), 2) AS net,
      COALESCE(r.sk, 1) AS sk,
      COALESCE((
        SELECT GROUP_CONCAT(pp.name, ' + ')
        FROM receipt_payments pp
        WHERE pp.receipt_number = r.receipt_number
      ), '—') AS payment
    FROM receipts r
    LEFT JOIN line_totals lt ON lt.receipt_number = r.receipt_number
    WHERE ${where.sql}
    ORDER BY ${orderBy} ${order}, r.receipt_number DESC
    LIMIT ? OFFSET ?
  `).bind(...where.params, pageSize, offset).all<{
    receiptNumber: string
    date: string
    positions: number
    units: number
    gross: number
    discount: number
    net: number
    sk: number
    payment: string
  }>()

  return salesJson({
    ok: true,
    page: safePage,
    pageSize,
    total,
    totalPages,
    items: (result.results || []).map((receipt) => ({
      ...receipt,
      sk: Boolean(receipt.sk),
    })),
  })
}

async function updateReceiptSk(request: Request, receiptNumber: string, env: Env) {
  let payload: { sk?: unknown }
  try {
    payload = await request.json() as { sk?: unknown }
  } catch {
    return salesJson({ ok: false, error: 'Invalid JSON body' }, 400)
  }

  if (typeof payload.sk !== 'boolean') {
    return salesJson({ ok: false, error: 'Field sk must be boolean' }, 400)
  }

  const existing = await env.DB.prepare(`
    SELECT receipt_number
    FROM receipts
    WHERE receipt_number = ?
    LIMIT 1
  `).bind(receiptNumber).first<{ receipt_number: string }>()

  if (!existing) return salesJson({ ok: false, error: 'Receipt not found' }, 404)

  await env.DB.prepare(`
    UPDATE receipts
    SET sk = ?
    WHERE receipt_number = ?
  `).bind(payload.sk ? 1 : 0, receiptNumber).run()

  return salesJson({
    ok: true,
    receiptNumber,
    sk: payload.sk,
  })
}

async function salesReceiptLines(receiptNumber: string, env: Env) {
  const receipt = await env.DB.prepare(`
    SELECT receipt_number
    FROM receipts
    WHERE receipt_number = ?
    LIMIT 1
  `).bind(receiptNumber).first<{ receipt_number: string }>()

  if (!receipt) return salesJson({ ok: false, error: 'Receipt not found' }, 404)

  const result = await env.DB.prepare(`
    SELECT
      l.line_id AS lineId,
      l.item_id AS itemId,
      l.variant_id AS variantId,
      COALESCE(i.item_name, l.item_name, '—') AS itemName,
      COALESCE(c.name, '—') AS category,
      COALESCE(l.quantity, 0) AS quantity,
      COALESCE(l.price, 0) AS price,
      COALESCE(l.total_discount, 0) AS discount,
      COALESCE(l.total_money, 0) AS net,
      CAST(COALESCE(l.delivery_number, -1) AS TEXT) AS deliveryNo,
      COALESCE(d.supplier_name, '—') AS supplierName
    FROM receipt_lines l
    LEFT JOIN items i ON i.item_id = l.item_id
    LEFT JOIN categories c ON c.category_id = i.category_id
    LEFT JOIN deliveries d ON d.delivery_number = l.delivery_number
    WHERE l.receipt_number = ?
    ORDER BY l.rowid
  `).bind(receiptNumber).all<{
    lineId: string
    itemId: string | null
    variantId: string | null
    itemName: string
    category: string
    quantity: number
    price: number
    discount: number
    net: number
    deliveryNo: string
    supplierName: string
  }>()

  return salesJson({ ok: true, items: result.results || [] })
}

type DeliveryQuery = {
  from: string | null
  to: string | null
  supplier: string | null
  status: string | null
  category: string | null
  search: string | null
}

function parseDeliveryQuery(url: URL): DeliveryQuery {
  const value = (name: string) => url.searchParams.get(name)?.trim() || null
  const from = value('from')
  const to = value('to')
  const status = value('status')
  return {
    from: validYmd(from) ? from : null,
    to: validYmd(to) ? to : null,
    supplier: value('supplier'),
    status: status === 'active' || status === 'inactive' || status === 'unsold' || status === 'sold-out' ? status : null,
    category: value('category'),
    search: value('search'),
  }
}

function buildDeliveryWhere(filters: DeliveryQuery) {
  const clauses = ['1=1']
  const params: Array<string | number> = []

  if (filters.from) {
    clauses.push('d.delivery_date >= ?')
    params.push(filters.from)
  }
  if (filters.to) {
    clauses.push('d.delivery_date <= ?')
    params.push(filters.to)
  }
  if (filters.supplier) {
    clauses.push('d.supplier_name = ?')
    params.push(filters.supplier)
  }
  if (filters.status === 'active') {
    clauses.push('d.active = TRUE')
  } else if (filters.status === 'inactive') {
    clauses.push('d.active = FALSE')
  } else if (filters.status === 'unsold') {
    clauses.push('COALESCE(s.sold, 0) <= 0')
  } else if (filters.status === 'sold-out') {
    clauses.push('COALESCE(s.sold, 0) >= d.quantity')
  }
  if (filters.category) {
    clauses.push(`EXISTS (
      SELECT 1
      FROM receipt_lines lcf
      JOIN receipts rcf ON rcf.receipt_number = lcf.receipt_number
      LEFT JOIN items icf ON icf.item_id = lcf.item_id
      WHERE lcf.delivery_number = d.delivery_number
        AND COALESCE(rcf.receipt_type, 'SALE') = 'SALE'
        AND rcf.cancelled_at IS NULL
        AND icf.category_id = ?
    )`)
    params.push(filters.category)
  }
  if (filters.search) {
    const pattern = `%${escapeLike(filters.search)}%`
    clauses.push(`(
      CAST(d.delivery_number AS TEXT) LIKE ? ESCAPE '\\'
      OR d.supplier_name LIKE ? ESCAPE '\\'
    )`)
    params.push(pattern, pattern)
  }

  return { sql: clauses.join('\n AND '), params }
}

const deliverySalesCte = `
  WITH sales AS (
    SELECT
      l.delivery_number,
      COALESCE(SUM(l.quantity), 0) AS sold,
      COALESCE(SUM(l.total_money), 0) AS sales
    FROM receipt_lines l
    JOIN receipts r ON r.receipt_number = l.receipt_number
    WHERE COALESCE(r.receipt_type, 'SALE') = 'SALE'
      AND r.cancelled_at IS NULL
    GROUP BY l.delivery_number
  )
`

async function deliveryRows(url: URL, env: Env) {
  const filters = parseDeliveryQuery(url)
  const where = buildDeliveryWhere(filters)
  const result = await env.DB.prepare(`
    ${deliverySalesCte}
    SELECT
      d.delivery_number AS deliveryNumber,
      d.delivery_date AS deliveryDate,
      d.supplier_name AS supplierName,
      d.quantity AS quantity,
      d.total_cost AS totalCost,
      d.active AS active,
      ROUND(d.total_cost / NULLIF(d.quantity, 0), 2) AS unitCost,
      COALESCE(s.sold, 0) AS sold,
      ROUND(COALESCE(s.sold, 0) * 100.0 / NULLIF(d.quantity, 0), 1) AS sellThrough,
      ROUND(COALESCE(s.sales, 0) * 100.0 / NULLIF(d.total_cost, 0), 1) AS returnRate,
      ROUND(COALESCE(s.sales, 0), 2) AS sales,
      ROUND(COALESCE(s.sales, 0) - (COALESCE(s.sold, 0) * d.total_cost / NULLIF(d.quantity, 0)), 2) AS profit,
      (
        SELECT COUNT(DISTINCT ldocs.receipt_number)
        FROM receipt_lines ldocs
        WHERE ldocs.delivery_number = d.delivery_number
      ) AS salesDocumentsCount
    FROM deliveries d
    LEFT JOIN sales s ON s.delivery_number = d.delivery_number
    WHERE ${where.sql}
    ORDER BY d.delivery_number DESC
  `).bind(...where.params).all<{
    deliveryNumber: number
    deliveryDate: string
    supplierName: string
    quantity: number
    totalCost: number
    active: number
    unitCost: number
    sold: number
    sellThrough: number
    returnRate: number
    sales: number
    profit: number
    salesDocumentsCount: number
  }>()

  return salesJson({
    ok: true,
    items: (result.results || []).map((row) => ({
      ...row,
      active: Number(row.active) === 1,
    })),
  })
}

async function deliverySummary(url: URL, env: Env) {
  const filters = parseDeliveryQuery(url)
  const where = buildDeliveryWhere(filters)

  const row = await env.DB.prepare(`
    ${deliverySalesCte},
    filtered AS (
      SELECT
        d.delivery_number,
        d.supplier_name,
        d.quantity,
        d.total_cost,
        d.active,
        COALESCE(s.sold, 0) AS sold,
        COALESCE(s.sales, 0) AS sales,
        COALESCE(s.sales, 0) - (COALESCE(s.sold, 0) * d.total_cost / NULLIF(d.quantity, 0)) AS profit
      FROM deliveries d
      LEFT JOIN sales s ON s.delivery_number = d.delivery_number
      WHERE ${where.sql}
    )
    SELECT
      COALESCE(SUM(CASE WHEN active = TRUE THEN 1 ELSE 0 END), 0) AS activeDeliveries,
      COALESCE(SUM(CASE WHEN delivery_number >= 0 THEN quantity ELSE 0 END), 0) AS receivedUnits,
      COALESCE(SUM(CASE WHEN delivery_number >= 0 THEN sold ELSE 0 END), 0) AS soldUnits,
      COALESCE(SUM(CASE WHEN delivery_number >= 0 THEN sales ELSE 0 END), 0) AS sales,
      COALESCE(SUM(CASE WHEN delivery_number >= 0 THEN profit ELSE 0 END), 0) AS profit
    FROM filtered
  `).bind(...where.params).first<{
    activeDeliveries: number
    receivedUnits: number
    soldUnits: number
    sales: number
    profit: number
  }>()

  const supplier = await env.DB.prepare(`
    ${deliverySalesCte},
    filtered AS (
      SELECT
        d.delivery_number,
        d.supplier_name,
        d.quantity,
        d.total_cost,
        d.active,
        COALESCE(s.sold, 0) AS sold,
        COALESCE(s.sales, 0) AS sales,
        COALESCE(s.sales, 0) - (COALESCE(s.sold, 0) * d.total_cost / NULLIF(d.quantity, 0)) AS profit
      FROM deliveries d
      LEFT JOIN sales s ON s.delivery_number = d.delivery_number
      WHERE ${where.sql}
    )
    SELECT supplier_name AS supplierName, ROUND(SUM(profit), 2) AS profit
    FROM filtered
    WHERE delivery_number > 0
    GROUP BY supplier_name
    ORDER BY profit DESC, supplier_name COLLATE NOCASE
    LIMIT 1
  `).bind(...where.params).first<{ supplierName: string; profit: number }>()

  const receivedUnits = Number(row?.receivedUnits || 0)
  const soldUnits = Number(row?.soldUnits || 0)

  return salesJson({
    ok: true,
    activeDeliveries: Number(row?.activeDeliveries || 0),
    receivedUnits,
    sellThrough: receivedUnits > 0 ? Math.round((soldUnits / receivedUnits) * 1000) / 10 : 0,
    sales: money(row?.sales),
    profit: money(row?.profit),
    bestSupplier: supplier?.supplierName || null,
  })
}

async function deliverySuppliers(env: Env) {
  const result = await env.DB.prepare(`
    SELECT DISTINCT supplier_name AS name
    FROM deliveries
    WHERE TRIM(COALESCE(supplier_name, '')) <> ''
    ORDER BY supplier_name COLLATE NOCASE
  `).all<{ name: string }>()
  return salesJson({ ok: true, items: (result.results || []).map((row) => row.name) })
}

async function deliveryItems(deliveryNumber: number, env: Env) {
  const exists = await env.DB.prepare(
    'SELECT delivery_number FROM deliveries WHERE delivery_number = ? LIMIT 1'
  ).bind(deliveryNumber).first<{ delivery_number: number }>()
  if (!exists) return salesJson({ ok: false, error: 'Delivery not found' }, 404)

  const result = await env.DB.prepare(`
    SELECT
      l.item_id AS itemId,
      COALESCE(i.item_name, l.item_name, '—') AS itemName,
      COALESCE(c.name, '—') AS category,
      ROUND(SUM(l.quantity), 2) AS quantity,
      ROUND(SUM(l.total_money), 2) AS sales
    FROM receipt_lines l
    JOIN receipts r ON r.receipt_number = l.receipt_number
    LEFT JOIN items i ON i.item_id = l.item_id
    LEFT JOIN categories c ON c.category_id = i.category_id
    WHERE l.delivery_number = ?
      AND COALESCE(r.receipt_type, 'SALE') = 'SALE'
      AND r.cancelled_at IS NULL
    GROUP BY l.item_id, COALESCE(i.item_name, l.item_name, '—'), COALESCE(c.name, '—')
    HAVING SUM(l.quantity) > 0
    ORDER BY SUM(l.quantity) DESC, itemName COLLATE NOCASE
  `).bind(deliveryNumber).all<{
    itemId: string | null
    itemName: string
    category: string
    quantity: number
    sales: number
  }>()

  return salesJson({ ok: true, items: result.results || [] })
}

async function createDelivery(request: Request, env: Env) {
  let body: { deliveryDate?: unknown; supplierName?: unknown; quantity?: unknown; totalCost?: unknown; active?: unknown }
  try {
    body = await request.json() as typeof body
  } catch {
    return salesJson({ ok: false, error: 'Invalid JSON' }, 400)
  }

  const deliveryDate = typeof body.deliveryDate === 'string' ? body.deliveryDate.trim() : ''
  const supplierName = typeof body.supplierName === 'string' ? body.supplierName.trim() : ''
  const quantity = Number(body.quantity)
  const totalCost = Number(body.totalCost)
  const active = typeof body.active === 'boolean' ? body.active : true

  if (!validYmd(deliveryDate) || !supplierName || !Number.isInteger(quantity) || quantity <= 0 || !Number.isFinite(totalCost) || totalCost < 0) {
    return salesJson({ ok: false, error: 'Invalid delivery data' }, 400)
  }

  const row = await env.DB.prepare(`
    INSERT INTO deliveries (delivery_number, delivery_date, supplier_name, quantity, total_cost, active)
    SELECT
      COALESCE(MAX(CASE WHEN delivery_number > 0 THEN delivery_number END), 0) + 1,
      ?, ?, ?, ?, ?
    FROM deliveries
    RETURNING
      delivery_number AS deliveryNumber,
      delivery_date AS deliveryDate,
      supplier_name AS supplierName,
      quantity,
      total_cost AS totalCost,
      active
  `).bind(deliveryDate, supplierName, quantity, money(totalCost), active ? 1 : 0).first<{
    deliveryNumber: number
    deliveryDate: string
    supplierName: string
    quantity: number
    totalCost: number
    active: number
  }>()

  return salesJson({
    ok: true,
    item: row ? { ...row, active: Number(row.active) === 1 } : row,
  }, 201)
}


async function updateDelivery(request: Request, deliveryNumber: number, env: Env) {
  let body: { deliveryDate?: unknown; supplierName?: unknown; quantity?: unknown; totalCost?: unknown }
  try {
    body = await request.json() as typeof body
  } catch {
    return salesJson({ ok: false, error: 'Invalid JSON' }, 400)
  }

  const deliveryDate = typeof body.deliveryDate === 'string' ? body.deliveryDate.trim() : ''
  const supplierName = typeof body.supplierName === 'string' ? body.supplierName.trim() : ''
  const quantity = Number(body.quantity)
  const totalCost = Number(body.totalCost)

  if (!validYmd(deliveryDate) || !supplierName || !Number.isInteger(quantity) || quantity <= 0 || !Number.isFinite(totalCost) || totalCost < 0) {
    return salesJson({ ok: false, error: 'Nieprawidłowe dane dostawy.' }, 400)
  }

  const row = await env.DB.prepare(`
    UPDATE deliveries
    SET
      delivery_date = ?,
      supplier_name = ?,
      quantity = ?,
      total_cost = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE delivery_number = ?
    RETURNING
      delivery_number AS deliveryNumber,
      delivery_date AS deliveryDate,
      supplier_name AS supplierName,
      quantity,
      total_cost AS totalCost
  `).bind(deliveryDate, supplierName, quantity, money(totalCost), deliveryNumber).first<{
    deliveryNumber: number
    deliveryDate: string
    supplierName: string
    quantity: number
    totalCost: number
  }>()

  if (!row) return salesJson({ ok: false, error: 'Dostawa nie istnieje.' }, 404)
  return salesJson({ ok: true, item: row })
}

async function deleteDeliveryRecord(deliveryNumber: number, env: Env) {
  if (deliveryNumber <= 0) {
    return salesJson({ ok: false, error: 'Dostawy technicznej -1 lub 0 nie można usunąć.' }, 409)
  }

  const linked = await env.DB.prepare(`
    SELECT COUNT(*) AS count
    FROM receipt_lines
    WHERE delivery_number = ?
  `).bind(deliveryNumber).first<{ count: number }>()

  if (Number(linked?.count || 0) > 0) {
    return salesJson({
      ok: false,
      error: 'Nie można usunąć dostawy, do której są przypisane pozycje sprzedaży. Najpierw trzeba przepiąć te pozycje do innej dostawy.',
    }, 409)
  }

  const deleted = await env.DB.prepare(`
    DELETE FROM deliveries
    WHERE delivery_number = ?
    RETURNING delivery_number AS deliveryNumber
  `).bind(deliveryNumber).first<{ deliveryNumber: number }>()

  if (!deleted) return salesJson({ ok: false, error: 'Dostawa nie istnieje.' }, 404)
  return salesJson({ ok: true, deliveryNumber: deleted.deliveryNumber })
}


async function updateDeliveryActive(request: Request, deliveryNumber: number, env: Env) {
  let body: { active?: unknown }
  try {
    body = await request.json() as typeof body
  } catch {
    return salesJson({ ok: false, error: 'Invalid JSON' }, 400)
  }

  if (typeof body.active !== 'boolean') {
    return salesJson({ ok: false, error: 'Pole active musi być wartością boolean.' }, 400)
  }

  const row = await env.DB.prepare(`
    UPDATE deliveries
    SET active = ?, updated_at = CURRENT_TIMESTAMP
    WHERE delivery_number = ?
    RETURNING delivery_number AS deliveryNumber, active
  `).bind(body.active ? 1 : 0, deliveryNumber).first<{ deliveryNumber: number; active: number }>()

  if (!row) return salesJson({ ok: false, error: 'Dostawa nie istnieje.' }, 404)

  return salesJson({
    ok: true,
    item: {
      deliveryNumber: row.deliveryNumber,
      active: Number(row.active) === 1,
    },
  })
}


async function getNextDeliveryNumber(env: Env) {
  const row = await env.DB.prepare(`
    SELECT COALESCE(MAX(CASE WHEN delivery_number > 0 THEN delivery_number END), 0) + 1 AS nextDeliveryNumber
    FROM deliveries
  `).first<{ nextDeliveryNumber: number }>()

  return salesJson({
    ok: true,
    nextDeliveryNumber: Number(row?.nextDeliveryNumber || 1),
  })
}

async function handleDeliveriesApi(request: Request, url: URL, env: Env): Promise<Response | null> {
  if (url.pathname === '/api/deliveries' && request.method === 'GET') return deliveryRows(url, env)
  if (url.pathname === '/api/deliveries' && request.method === 'POST') return createDelivery(request, env)
  if (url.pathname === '/api/deliveries/summary' && request.method === 'GET') return deliverySummary(url, env)
  if (url.pathname === '/api/deliveries/suppliers' && request.method === 'GET') return deliverySuppliers(env)
  if (url.pathname === '/api/deliveries/next-number' && request.method === 'GET') return getNextDeliveryNumber(env)

  const itemMatch = url.pathname.match(/^\/api\/deliveries\/(-?\d+)\/items$/)
  if (itemMatch && request.method === 'GET') return deliveryItems(Number(itemMatch[1]), env)

  const activeMatch = url.pathname.match(/^\/api\/deliveries\/(-?\d+)\/active$/)
  if (activeMatch && request.method === 'PATCH') return updateDeliveryActive(request, Number(activeMatch[1]), env)

  const deliveryMatch = url.pathname.match(/^\/api\/deliveries\/(-?\d+)$/)
  if (deliveryMatch && request.method === 'PUT') return updateDelivery(request, Number(deliveryMatch[1]), env)
  if (deliveryMatch && request.method === 'DELETE') return deleteDeliveryRecord(Number(deliveryMatch[1]), env)

  return null
}

type DashboardComparisonPeriod = 'week' | 'month' | 'year'

type DashboardReceiptRow = {
  receiptNumber: string
  date: string
  net: number
}

type DashboardLineRow = {
  date: string
  quantity: number
  net: number
  category: string
}

type DashboardProfitSummary = {
  currentProfit: number
  currentCoveredSales: number
  currentCoveredUnits: number
  currentTotalUnits: number
  previousProfit: number
  previousCoveredSales: number
  previousCoveredUnits: number
}

type DashboardSellThroughSummary = {
  receivedUnits: number
  soldUnits: number
}

type DashboardRange = {
  start: string
  end: string
  label: string
}

function warsawYmd(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: SALES_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)

  const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || ''
  return `${pick('year')}-${pick('month')}-${pick('day')}`
}

function ymdUtc(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

function utcYmd(date: Date) {
  return date.toISOString().slice(0, 10)
}

function diffDaysInclusive(start: string, end: string) {
  return Math.max(1, Math.round((ymdUtc(end).getTime() - ymdUtc(start).getTime()) / 86400000) + 1)
}

function localReceiptParts(value: string) {
  const date = new Date(value)
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: SALES_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || '0'
  const ymd = `${pick('year')}-${pick('month')}-${pick('day')}`
  return { ymd, hour: Number(pick('hour')) }
}

function weekdayIndexFromYmd(value: string) {
  const day = ymdUtc(value).getUTCDay()
  return (day + 6) % 7
}

function quarterForYmd(value: string) {
  const [year, month] = value.split('-').map(Number)
  const quarter = Math.floor((month - 1) / 3) + 1
  const startMonth = ((quarter - 1) * 3) + 1
  const start = `${year}-${String(startMonth).padStart(2, '0')}-01`
  const nextQuarter = startMonth === 10
    ? `${year + 1}-01-01`
    : `${year}-${String(startMonth + 3).padStart(2, '0')}-01`
  const end = addDaysYmd(nextQuarter, -1)
  const roman = ['I', 'II', 'III', 'IV'][quarter - 1]
  return { year, quarter, start, end, label: `${roman} kwartał ${year}` }
}

function previousQuarterForYmd(value: string) {
  const current = quarterForYmd(value)
  return quarterForYmd(addDaysYmd(current.start, -1))
}

function shiftPeriodYmd(value: string, period: DashboardComparisonPeriod, amount: number) {
  const date = ymdUtc(value)

  if (period === 'week') {
    date.setUTCDate(date.getUTCDate() - (7 * amount))
    return utcYmd(date)
  }

  const originalDay = date.getUTCDate()
  date.setUTCDate(1)

  if (period === 'month') {
    date.setUTCMonth(date.getUTCMonth() - amount)
  } else {
    date.setUTCFullYear(date.getUTCFullYear() - amount)
  }

  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate()
  date.setUTCDate(Math.min(originalDay, lastDay))
  return utcYmd(date)
}

function formatRangeLabel(start: string, end: string) {
  const formatter = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'short', year: '2-digit', timeZone: 'UTC' })
  const format = (value: string) => formatter.format(ymdUtc(value)).replace('.', '')
  return `${format(start)} – ${format(end)}`
}

function comparisonRanges(end: string, type: DashboardComparisonPeriod, count: number): DashboardRange[] {
  return Array.from({ length: count }, (_, index) => {
    const offset = count - index - 1
    const periodEnd = shiftPeriodYmd(end, type, offset)
    const periodStart = addDaysYmd(shiftPeriodYmd(periodEnd, type, 1), 1)
    return { start: periodStart, end: periodEnd, label: formatRangeLabel(periodStart, periodEnd) }
  })
}

function metricChange(current: number, previous: number) {
  if (Math.abs(previous) < 0.00001) return current === 0 ? 0 : null
  return Math.round((((current - previous) / Math.abs(previous)) * 100) * 10) / 10
}

function sumReceipts(rows: DashboardReceiptRow[], start: string, end: string) {
  return money(rows.reduce((sum, row) => {
    const ymd = localReceiptParts(row.date).ymd
    return ymd >= start && ymd <= end ? sum + Number(row.net || 0) : sum
  }, 0))
}

function countReceipts(rows: DashboardReceiptRow[], start: string, end: string) {
  return rows.reduce((count, row) => {
    const ymd = localReceiptParts(row.date).ymd
    return ymd >= start && ymd <= end ? count + 1 : count
  }, 0)
}

function sumUnits(rows: DashboardLineRow[], start: string, end: string) {
  return rows.reduce((sum, row) => {
    const ymd = localReceiptParts(row.date).ymd
    return ymd >= start && ymd <= end ? sum + Number(row.quantity || 0) : sum
  }, 0)
}

function comparisonBins(range: DashboardRange, type: DashboardComparisonPeriod) {
  const count = type === 'year' ? 12 : 7
  const totalDays = diffDaysInclusive(range.start, range.end)

  return Array.from({ length: count }, (_, index) => {
    const startOffset = Math.floor((index * totalDays) / count)
    const nextOffset = Math.floor(((index + 1) * totalDays) / count)
    const endOffset = Math.max(startOffset, nextOffset - 1)
    return {
      start: addDaysYmd(range.start, startOffset),
      end: addDaysYmd(range.start, Math.min(totalDays - 1, endOffset)),
    }
  })
}

function comparisonAxis(range: DashboardRange, type: DashboardComparisonPeriod) {
  const bins = comparisonBins(range, type)

  if (type === 'week') {
    const labels = ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sob']
    return bins.map((bin) => labels[ymdUtc(bin.start).getUTCDay()])
  }

  if (type === 'year') {
    const formatter = new Intl.DateTimeFormat('pl-PL', { month: 'short', timeZone: 'UTC' })
    return bins.map((bin) => formatter.format(ymdUtc(bin.start)).replace('.', ''))
  }

  const formatter = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'short', timeZone: 'UTC' })
  return bins.map((bin) => formatter.format(ymdUtc(bin.start)).replace('.', ''))
}

async function dashboardData(url: URL, env: Env) {
  const today = warsawYmd()
  const yesterday = addDaysYmd(today, -1)
  const currentQuarter = quarterForYmd(today)
  const previousQuarter = previousQuarterForYmd(today)
  const last30Start = addDaysYmd(today, -29)
  const currentWeekStart = addDaysYmd(today, -6)
  const previousWeekStart = addDaysYmd(today, -13)
  const previousWeekEnd = addDaysYmd(today, -7)

  const comparisonTypeRaw = url.searchParams.get('comparisonType')
  const comparisonType: DashboardComparisonPeriod =
    comparisonTypeRaw === 'month' || comparisonTypeRaw === 'year' ? comparisonTypeRaw : 'week'
  const comparisonCount = Math.min(5, Math.max(1, Number.parseInt(url.searchParams.get('comparisonCount') || '4', 10) || 4))
  const comparisonEndRaw = url.searchParams.get('comparisonEnd')
  const comparisonEnd = validYmd(comparisonEndRaw) ? String(comparisonEndRaw) : today
  const ranges = comparisonRanges(comparisonEnd, comparisonType, comparisonCount)
  const comparisonStart = ranges[0]?.start || comparisonEnd

  const baseStart = [previousQuarter.start, previousWeekStart, last30Start].sort()[0]
  const baseEndExclusive = warsawMidnightUtcIso(addDaysYmd(today, 1))

  const [receiptResult, lineResult, comparisonReceiptResult, profitResult, sellThroughResult] = await Promise.all([
    env.DB.prepare(`
      SELECT
        receipt_number AS receiptNumber,
        receipt_date AS date,
        COALESCE(total_money, 0) AS net
      FROM receipts
      WHERE COALESCE(receipt_type, 'SALE') = 'SALE'
        AND cancelled_at IS NULL
        AND receipt_date >= ?
        AND receipt_date < ?
      ORDER BY receipt_date
    `).bind(warsawMidnightUtcIso(baseStart), baseEndExclusive).all<DashboardReceiptRow>(),

    env.DB.prepare(`
      SELECT
        r.receipt_date AS date,
        COALESCE(l.quantity, 0) AS quantity,
        COALESCE(l.total_money, 0) AS net,
        COALESCE(NULLIF(TRIM(c.name), ''), 'Bez kategorii') AS category
      FROM receipt_lines l
      JOIN receipts r ON r.receipt_number = l.receipt_number
      LEFT JOIN items i ON i.item_id = l.item_id
      LEFT JOIN categories c ON c.category_id = i.category_id
      WHERE COALESCE(r.receipt_type, 'SALE') = 'SALE'
        AND r.cancelled_at IS NULL
        AND r.receipt_date >= ?
        AND r.receipt_date < ?
      ORDER BY r.receipt_date
    `).bind(warsawMidnightUtcIso(baseStart), baseEndExclusive).all<DashboardLineRow>(),

    env.DB.prepare(`
      SELECT
        receipt_number AS receiptNumber,
        receipt_date AS date,
        COALESCE(total_money, 0) AS net
      FROM receipts
      WHERE COALESCE(receipt_type, 'SALE') = 'SALE'
        AND cancelled_at IS NULL
        AND receipt_date >= ?
        AND receipt_date < ?
      ORDER BY receipt_date
    `).bind(
      warsawMidnightUtcIso(comparisonStart),
      warsawMidnightUtcIso(addDaysYmd(comparisonEnd, 1)),
    ).all<DashboardReceiptRow>(),

    env.DB.prepare(`
      SELECT
        COALESCE(SUM(CASE
          WHEN r.receipt_date >= ? AND r.receipt_date < ?
           AND d.delivery_number IS NOT NULL AND d.quantity > 0
          THEN COALESCE(l.total_money, 0) - (COALESCE(l.quantity, 0) * d.total_cost / d.quantity)
          ELSE 0
        END), 0) AS currentProfit,
        COALESCE(SUM(CASE
          WHEN r.receipt_date >= ? AND r.receipt_date < ?
           AND d.delivery_number IS NOT NULL AND d.quantity > 0
          THEN COALESCE(l.total_money, 0)
          ELSE 0
        END), 0) AS currentCoveredSales,
        COALESCE(SUM(CASE
          WHEN r.receipt_date >= ? AND r.receipt_date < ?
           AND d.delivery_number IS NOT NULL AND d.quantity > 0
          THEN COALESCE(l.quantity, 0)
          ELSE 0
        END), 0) AS currentCoveredUnits,
        COALESCE(SUM(CASE
          WHEN r.receipt_date >= ? AND r.receipt_date < ?
          THEN COALESCE(l.quantity, 0)
          ELSE 0
        END), 0) AS currentTotalUnits,
        COALESCE(SUM(CASE
          WHEN r.receipt_date >= ? AND r.receipt_date < ?
           AND d.delivery_number IS NOT NULL AND d.quantity > 0
          THEN COALESCE(l.total_money, 0) - (COALESCE(l.quantity, 0) * d.total_cost / d.quantity)
          ELSE 0
        END), 0) AS previousProfit,
        COALESCE(SUM(CASE
          WHEN r.receipt_date >= ? AND r.receipt_date < ?
           AND d.delivery_number IS NOT NULL AND d.quantity > 0
          THEN COALESCE(l.total_money, 0)
          ELSE 0
        END), 0) AS previousCoveredSales,
        COALESCE(SUM(CASE
          WHEN r.receipt_date >= ? AND r.receipt_date < ?
           AND d.delivery_number IS NOT NULL AND d.quantity > 0
          THEN COALESCE(l.quantity, 0)
          ELSE 0
        END), 0) AS previousCoveredUnits
      FROM receipt_lines l
      JOIN receipts r ON r.receipt_number = l.receipt_number
      LEFT JOIN deliveries d ON d.delivery_number = l.delivery_number
      WHERE COALESCE(r.receipt_type, 'SALE') = 'SALE'
        AND r.cancelled_at IS NULL
        AND r.receipt_date >= ?
        AND r.receipt_date < ?
    `).bind(
      warsawMidnightUtcIso(currentQuarter.start),
      warsawMidnightUtcIso(addDaysYmd(today, 1)),
      warsawMidnightUtcIso(currentQuarter.start),
      warsawMidnightUtcIso(addDaysYmd(today, 1)),
      warsawMidnightUtcIso(currentQuarter.start),
      warsawMidnightUtcIso(addDaysYmd(today, 1)),
      warsawMidnightUtcIso(currentQuarter.start),
      warsawMidnightUtcIso(addDaysYmd(today, 1)),
      warsawMidnightUtcIso(previousQuarter.start),
      warsawMidnightUtcIso(addDaysYmd(previousQuarter.end, 1)),
      warsawMidnightUtcIso(previousQuarter.start),
      warsawMidnightUtcIso(addDaysYmd(previousQuarter.end, 1)),
      warsawMidnightUtcIso(previousQuarter.start),
      warsawMidnightUtcIso(addDaysYmd(previousQuarter.end, 1)),
      warsawMidnightUtcIso(previousQuarter.start),
      warsawMidnightUtcIso(addDaysYmd(today, 1)),
    ).first<DashboardProfitSummary>(),

    env.DB.prepare(`
      WITH sold AS (
        SELECT
          l.delivery_number,
          COALESCE(SUM(l.quantity), 0) AS sold
        FROM receipt_lines l
        JOIN receipts r ON r.receipt_number = l.receipt_number
        WHERE COALESCE(r.receipt_type, 'SALE') = 'SALE'
          AND r.cancelled_at IS NULL
        GROUP BY l.delivery_number
      )
      SELECT
        COALESCE(SUM(CASE WHEN d.delivery_number >= 0 THEN d.quantity ELSE 0 END), 0) AS receivedUnits,
        COALESCE(SUM(CASE WHEN d.delivery_number >= 0 THEN COALESCE(s.sold, 0) ELSE 0 END), 0) AS soldUnits
      FROM deliveries d
      LEFT JOIN sold s ON s.delivery_number = d.delivery_number
    `).first<DashboardSellThroughSummary>(),
  ])

  const receipts = receiptResult.results || []
  const lines = lineResult.results || []
  const comparisonReceipts = comparisonReceiptResult.results || []

  const todaySales = sumReceipts(receipts, today, today)
  const yesterdaySales = sumReceipts(receipts, yesterday, yesterday)
  const quarterSales = sumReceipts(receipts, currentQuarter.start, today)
  const previousQuarterSales = sumReceipts(receipts, previousQuarter.start, previousQuarter.end)
  const todayUnits = sumUnits(lines, today, today)
  const yesterdayUnits = sumUnits(lines, yesterday, yesterday)
  const currentWeekSales = sumReceipts(receipts, currentWeekStart, today)
  const currentWeekReceipts = countReceipts(receipts, currentWeekStart, today)
  const previousWeekSales = sumReceipts(receipts, previousWeekStart, previousWeekEnd)
  const previousWeekReceipts = countReceipts(receipts, previousWeekStart, previousWeekEnd)
  const averageReceipt = currentWeekReceipts ? money(currentWeekSales / currentWeekReceipts) : 0
  const previousAverageReceipt = previousWeekReceipts ? money(previousWeekSales / previousWeekReceipts) : 0

  const currentProfit = money(profitResult?.currentProfit)
  const previousProfit = money(profitResult?.previousProfit)
  const currentCoveredSales = Number(profitResult?.currentCoveredSales || 0)
  const currentCoveredUnits = Number(profitResult?.currentCoveredUnits || 0)
  const currentTotalUnits = Number(profitResult?.currentTotalUnits || 0)
  const previousCoveredUnits = Number(profitResult?.previousCoveredUnits || 0)
  const costCoverage = currentTotalUnits > 0
    ? Math.round((currentCoveredUnits / currentTotalUnits) * 1000) / 10
    : 0
  const profitMargin = currentCoveredSales > 0
    ? Math.round((currentProfit / currentCoveredSales) * 1000) / 10
    : null
  const receivedUnits = Number(sellThroughResult?.receivedUnits || 0)
  const soldDeliveryUnits = Number(sellThroughResult?.soldUnits || 0)
  const sellThrough = receivedUnits > 0
    ? Math.round((soldDeliveryUnits / receivedUnits) * 1000) / 10
    : null

  const dailyMap = new Map<string, number>()
  for (let offset = 0; offset < 30; offset += 1) {
    dailyMap.set(addDaysYmd(last30Start, offset), 0)
  }
  for (const row of receipts) {
    const ymd = localReceiptParts(row.date).ymd
    if (ymd >= last30Start && ymd <= today) dailyMap.set(ymd, (dailyMap.get(ymd) || 0) + Number(row.net || 0))
  }
  const daily = Array.from(dailyMap, ([date, value]) => ({ date, value: money(value) }))
  const total30 = money(daily.reduce((sum, day) => sum + day.value, 0))
  const average30 = money(total30 / 30)
  const bestDay = daily.reduce((best, day) => day.value > best.value ? day : best, { date: last30Start, value: 0 })

  const categoryMap = new Map<string, number>()
  for (const row of lines) {
    const ymd = localReceiptParts(row.date).ymd
    if (ymd < currentQuarter.start || ymd > today) continue
    categoryMap.set(row.category, (categoryMap.get(row.category) || 0) + Number(row.net || 0))
  }
  let categoryEntries = Array.from(categoryMap, ([name, value]) => ({ name, value: money(value) }))
    .sort((a, b) => b.value - a.value)
  if (categoryEntries.length > 5) {
    const top = categoryEntries.slice(0, 4)
    const otherValue = money(categoryEntries.slice(4).reduce((sum, item) => sum + item.value, 0))
    categoryEntries = [...top, { name: 'Pozostałe', value: otherValue }]
  }
  const categoryTotal = money(categoryEntries.reduce((sum, item) => sum + item.value, 0))
  const categories = categoryEntries.map((item) => ({
    ...item,
    percent: categoryTotal > 0 ? Math.round((item.value / categoryTotal) * 1000) / 10 : 0,
  }))

  const weekdayOccurrences = Array(7).fill(0) as number[]
  for (let date = currentQuarter.start; date <= today; date = addDaysYmd(date, 1)) {
    weekdayOccurrences[weekdayIndexFromYmd(date)] += 1
  }

  const heatTotals = Array(7 * 14).fill(0) as number[]
  for (const row of receipts) {
    const local = localReceiptParts(row.date)
    if (local.ymd < currentQuarter.start || local.ymd > today) continue
    if (local.hour < 8 || local.hour > 21) continue
    const weekday = weekdayIndexFromYmd(local.ymd)
    const index = (weekday * 14) + (local.hour - 8)
    heatTotals[index] += Number(row.net || 0)
  }

  const heatAverages = heatTotals.map((total, index) => {
    const weekday = Math.floor(index / 14)
    const divisor = weekdayOccurrences[weekday] || 1
    return money(total / divisor)
  })
  const heatMax = Math.max(0, ...heatAverages)
  const heatLevels = heatAverages.map((value) => {
    if (value <= 0 || heatMax <= 0) return 1
    const ratio = value / heatMax
    if (ratio <= 0.25) return 1
    if (ratio <= 0.5) return 2
    if (ratio <= 0.75) return 3
    return 4
  })

  const comparisonSeries = ranges.map((range) => {
    const bins = comparisonBins(range, comparisonType)
    return {
      label: range.label,
      values: bins.map((bin) => sumReceipts(comparisonReceipts, bin.start, bin.end)),
    }
  })

  const configuredLimit = Number(env.DNR_QUARTER_LIMIT || '10813.50')
  const dnrLimit = Number.isFinite(configuredLimit) && configuredLimit > 0 ? configuredLimit : 10813.50
  const dnrRemaining = money(Math.max(0, dnrLimit - quarterSales))
  const dnrPercent = dnrLimit > 0 ? Math.round((quarterSales / dnrLimit) * 1000) / 10 : 0

  return salesJson({
    ok: true,
    generatedAt: nowIso(),
    quarter: {
      label: currentQuarter.label,
      start: currentQuarter.start,
      end: currentQuarter.end,
      used: quarterSales,
      limit: dnrLimit,
      remaining: dnrRemaining,
      percent: dnrPercent,
    },
    kpis: {
      todaySales,
      todaySalesChange: metricChange(todaySales, yesterdaySales),
      quarterSales,
      quarterSalesChange: metricChange(quarterSales, previousQuarterSales),
      // Koszt sztuki = cena całej dostawy / liczba sztuk w dostawie.
      // Zysk bazuje na kanonicznym receipt_lines.delivery_number i nie używa receipt_lines.cost/cost_total.
      estimatedProfit: currentCoveredUnits > 0 ? currentProfit : null,
      estimatedProfitChange: currentCoveredUnits > 0 && previousCoveredUnits > 0
        ? metricChange(currentProfit, previousProfit)
        : null,
      profitMargin,
      costCoverage,
      todayUnits,
      todayUnitsChange: metricChange(todayUnits, yesterdayUnits),
      averageReceipt,
      averageReceiptChange: metricChange(averageReceipt, previousAverageReceipt),
      sellThrough,
      sellThroughChange: null,
      sellThroughAvailable: receivedUnits > 0,
    },
    sales30: {
      days: daily,
      total: total30,
      average: average30,
      bestDay,
    },
    comparison: {
      type: comparisonType,
      count: comparisonCount,
      end: comparisonEnd,
      axis: comparisonAxis(ranges[ranges.length - 1], comparisonType),
      series: comparisonSeries,
    },
    categories: {
      total: categoryTotal,
      items: categories,
    },
    heatmap: {
      days: ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Niedz'],
      hours: Array.from({ length: 14 }, (_, index) => index + 8),
      averages: heatAverages,
      levels: heatLevels,
    },
  })
}

type LeonMessageRow = {
  id: number
  message: string
}

async function leonMessageOfDay(env: Env) {
  const today = warsawYmd()

  const readToday = () => env.DB.prepare(`
    SELECT m.id, m.message
    FROM leon_message_history h
    JOIN leon_messages m ON m.id = h.message_id
    WHERE h.shown_on = ?
    LIMIT 1
  `).bind(today).first<LeonMessageRow>()

  const existing = await readToday()
  if (existing) {
    return {
      id: Number(existing.id),
      text: String(existing.message),
      date: today,
    }
  }

  let candidate = await env.DB.prepare(`
    SELECT id, message
    FROM leon_messages
    WHERE active = TRUE
      AND id NOT IN (
        SELECT message_id
        FROM leon_message_history
        ORDER BY shown_on DESC
        LIMIT 99
      )
    ORDER BY RANDOM()
    LIMIT 1
  `).first<LeonMessageRow>()

  // Ten fallback jest potrzebny tylko wtedy, gdy liczba aktywnych tekstów spadnie poniżej 100.
  // Przy pełnej puli 100 wpisów normalny wybór nie pozwala na powtórkę przez 100 dni.
  if (!candidate) {
    candidate = await env.DB.prepare(`
      SELECT id, message
      FROM leon_messages
      WHERE active = TRUE
      ORDER BY RANDOM()
      LIMIT 1
    `).first<LeonMessageRow>()
  }

  if (!candidate) return null

  await env.DB.prepare(`
    INSERT OR IGNORE INTO leon_message_history (shown_on, message_id)
    VALUES (?, ?)
  `).bind(today, Number(candidate.id)).run()

  // Ponowny odczyt rozwiązuje ewentualny równoległy pierwszy request danego dnia.
  const selected = await readToday()
  if (!selected) return null

  return {
    id: Number(selected.id),
    text: String(selected.message),
    date: today,
  }
}



type LeonRecommendationDecision = 'do' | 'defer' | 'reject'

type AnalysisRecommendation = {
  id: string
  tone: 'positive' | 'warning' | 'neutral'
  badge: string
  title: string
  summary: string
  reason: string
  action: string
  priority: number
  decision?: LeonRecommendationDecision | null
  decisionAt?: string | null
}

type RecommendationCategoryRow = {
  category: string
  currentSales: number
  previousSales: number
  currentUnits: number
  previousUnits: number
}

type RecommendationDeliveryRow = {
  deliveryNumber: number
  deliveryDate: string | null
  supplierName: string | null
  quantity: number
  soldTotal: number
  soldCurrent: number
  soldPrevious: number
  lastSaleAt: string | null
}

type RecommendationSalesRow = {
  currentSales: number
  previousSales: number
  currentReceipts: number
  previousReceipts: number
}

function recommendationAgeDays(deliveryDate: string | null, today: string) {
  const ymd = deliveryDate?.slice(0, 10) || ''
  if (!validYmd(ymd)) return null
  return Math.max(0, diffDaysInclusive(ymd, today) - 1)
}

function recommendationPercent(value: number) {
  return Math.round(value * 10) / 10
}

async function calculateAnalysisRecommendations(env: Env, today = warsawYmd()) {
  const currentStart = addDaysYmd(today, -6)
  const previousStart = addDaysYmd(today, -13)
  const previousEnd = addDaysYmd(today, -7)
  const currentStartIso = warsawMidnightUtcIso(currentStart)
  const previousStartIso = warsawMidnightUtcIso(previousStart)
  const todayEndIso = warsawMidnightUtcIso(addDaysYmd(today, 1))

  const [salesRow, categoryResult, deliveryResult] = await Promise.all([
    env.DB.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN receipt_date >= ? THEN total_money ELSE 0 END), 0) AS currentSales,
        COALESCE(SUM(CASE WHEN receipt_date >= ? AND receipt_date < ? THEN total_money ELSE 0 END), 0) AS previousSales,
        COUNT(CASE WHEN receipt_date >= ? THEN 1 END) AS currentReceipts,
        COUNT(CASE WHEN receipt_date >= ? AND receipt_date < ? THEN 1 END) AS previousReceipts
      FROM receipts
      WHERE COALESCE(receipt_type, 'SALE') = 'SALE'
        AND cancelled_at IS NULL
        AND receipt_date >= ?
        AND receipt_date < ?
    `).bind(
      currentStartIso,
      previousStartIso,
      currentStartIso,
      currentStartIso,
      previousStartIso,
      currentStartIso,
      previousStartIso,
      todayEndIso,
    ).first<RecommendationSalesRow>(),

    env.DB.prepare(`
      SELECT
        COALESCE(NULLIF(TRIM(c.name), ''), 'Bez kategorii') AS category,
        COALESCE(SUM(CASE WHEN r.receipt_date >= ? THEN l.total_money ELSE 0 END), 0) AS currentSales,
        COALESCE(SUM(CASE WHEN r.receipt_date >= ? AND r.receipt_date < ? THEN l.total_money ELSE 0 END), 0) AS previousSales,
        COALESCE(SUM(CASE WHEN r.receipt_date >= ? THEN l.quantity ELSE 0 END), 0) AS currentUnits,
        COALESCE(SUM(CASE WHEN r.receipt_date >= ? AND r.receipt_date < ? THEN l.quantity ELSE 0 END), 0) AS previousUnits
      FROM receipt_lines l
      JOIN receipts r ON r.receipt_number = l.receipt_number
      LEFT JOIN items i ON i.item_id = l.item_id
      LEFT JOIN categories c ON c.category_id = i.category_id
      WHERE COALESCE(r.receipt_type, 'SALE') = 'SALE'
        AND r.cancelled_at IS NULL
        AND r.receipt_date >= ?
        AND r.receipt_date < ?
      GROUP BY COALESCE(NULLIF(TRIM(c.name), ''), 'Bez kategorii')
    `).bind(
      currentStartIso,
      previousStartIso,
      currentStartIso,
      currentStartIso,
      previousStartIso,
      currentStartIso,
      previousStartIso,
      todayEndIso,
    ).all<RecommendationCategoryRow>(),

    env.DB.prepare(`
      WITH sold AS (
        SELECT
          l.delivery_number,
          COALESCE(SUM(l.quantity), 0) AS soldTotal,
          COALESCE(SUM(CASE WHEN r.receipt_date >= ? THEN l.quantity ELSE 0 END), 0) AS soldCurrent,
          COALESCE(SUM(CASE WHEN r.receipt_date >= ? AND r.receipt_date < ? THEN l.quantity ELSE 0 END), 0) AS soldPrevious,
          MAX(r.receipt_date) AS lastSaleAt
        FROM receipt_lines l
        JOIN receipts r ON r.receipt_number = l.receipt_number
        WHERE COALESCE(r.receipt_type, 'SALE') = 'SALE'
          AND r.cancelled_at IS NULL
        GROUP BY l.delivery_number
      )
      SELECT
        d.delivery_number AS deliveryNumber,
        d.delivery_date AS deliveryDate,
        d.supplier_name AS supplierName,
        COALESCE(d.quantity, 0) AS quantity,
        COALESCE(s.soldTotal, 0) AS soldTotal,
        COALESCE(s.soldCurrent, 0) AS soldCurrent,
        COALESCE(s.soldPrevious, 0) AS soldPrevious,
        s.lastSaleAt AS lastSaleAt
      FROM deliveries d
      LEFT JOIN sold s ON s.delivery_number = d.delivery_number
      WHERE d.delivery_number > 0
        AND COALESCE(d.active, TRUE) = TRUE
        AND COALESCE(d.quantity, 0) > 0
    `).bind(
      currentStartIso,
      previousStartIso,
      currentStartIso,
    ).all<RecommendationDeliveryRow>(),
  ])

  const categories = (categoryResult.results || []).map((row) => ({
    ...row,
    currentSales: Number(row.currentSales || 0),
    previousSales: Number(row.previousSales || 0),
    currentUnits: Number(row.currentUnits || 0),
    previousUnits: Number(row.previousUnits || 0),
  }))

  const deliveries = (deliveryResult.results || []).map((row) => {
    const quantity = Number(row.quantity || 0)
    const soldTotal = Number(row.soldTotal || 0)
    const soldCurrent = Number(row.soldCurrent || 0)
    const soldPrevious = Number(row.soldPrevious || 0)
    return {
      ...row,
      deliveryNumber: Number(row.deliveryNumber),
      quantity,
      soldTotal,
      soldCurrent,
      soldPrevious,
      remaining: Math.max(0, quantity - soldTotal),
      sellThrough: quantity > 0 ? recommendationPercent((soldTotal / quantity) * 100) : 0,
      ageDays: recommendationAgeDays(row.deliveryDate, today),
    }
  })

  const candidates: AnalysisRecommendation[] = []

  const stalled = deliveries
    .filter((row) => row.remaining >= 3 && (row.ageDays ?? 0) >= 10 && row.soldCurrent === 0)
    .sort((a, b) => ((b.ageDays ?? 0) - (a.ageDays ?? 0)) || (a.sellThrough - b.sellThrough))[0]

  if (stalled) {
    candidates.push({
      id: `delivery-stalled-${stalled.deliveryNumber}`,
      tone: 'warning',
      badge: 'DOSTAWA',
      title: `Sprawdź dostawę ${stalled.deliveryNumber}`,
      summary: `Przez ostatnie 7 dni nie sprzedała się ani jedna sztuka, a zostało ${stalled.remaining}.`,
      reason: `Dostawa ma ${stalled.ageDays} dni i ${stalled.sellThrough}% zbytu. To sygnał do zmiany ekspozycji, zanim ruszymy z ceną.`,
      action: 'Najpierw zmień ekspozycję lub położenie rzeczy. Jeśli nadal nie ruszy, wtedy wrócimy do symulacji promocji.',
      priority: 96,
    })
  }

  const accelerating = deliveries
    .filter((row) =>
      row.remaining >= 2
      && row.soldCurrent >= 2
      && row.soldCurrent > row.soldPrevious
      && row.soldCurrent >= Math.max(2, row.soldPrevious * 1.5),
    )
    .sort((a, b) => (b.soldCurrent - b.soldPrevious) - (a.soldCurrent - a.soldPrevious))[0]

  if (accelerating) {
    const pace = accelerating.soldPrevious > 0
      ? recommendationPercent(((accelerating.soldCurrent - accelerating.soldPrevious) / accelerating.soldPrevious) * 100)
      : null
    candidates.push({
      id: `delivery-accelerating-${accelerating.deliveryNumber}`,
      tone: 'positive',
      badge: 'MARŻA',
      title: `Nie przeceniaj dostawy ${accelerating.deliveryNumber}`,
      summary: `W ostatnich 7 dniach sprzedało się ${accelerating.soldCurrent} szt. wobec ${accelerating.soldPrevious} wcześniej.`,
      reason: `${pace === null ? 'Tempo ruszyło z zera' : `Tempo wzrosło o ${pace}%`}; zbyt wynosi ${accelerating.sellThrough}%, a na stanie zostało ${accelerating.remaining} szt.`,
      action: 'Utrzymaj obecną cenę i ekspozycję. Przyspieszającej dostawy nie ma sensu teraz oddawać taniej.',
      priority: 92,
    })
  }

  const growingCategory = categories
    .filter((row) =>
      row.category !== 'Bez kategorii'
      && row.currentUnits >= 2
      && row.currentSales > row.previousSales
      && row.currentSales >= Math.max(100, row.previousSales * 1.2),
    )
    .sort((a, b) => (b.currentSales - b.previousSales) - (a.currentSales - a.previousSales))[0]

  if (growingCategory) {
    const change = metricChange(growingCategory.currentSales, growingCategory.previousSales)
    candidates.push({
      id: `category-growing-${growingCategory.category}`,
      tone: 'positive',
      badge: 'EKSPOZYCJA',
      title: `Wyeksponuj: ${growingCategory.category}`,
      summary: `Ta kategoria zrobiła ${money(growingCategory.currentSales)} zł w 7 dni i wyraźnie przyspiesza.`,
      reason: `Sprzedaż wcześniej: ${money(growingCategory.previousSales)} zł. Teraz: ${money(growingCategory.currentSales)} zł${change === null ? '' : ` (${change > 0 ? '+' : ''}${change}%)`}.`,
      action: 'Daj tej kategorii mocne miejsce na sali i nie chowaj jej za słabszymi rzeczami.',
      priority: 86,
    })
  }

  const currentSales = money(salesRow?.currentSales)
  const previousSales = money(salesRow?.previousSales)
  const salesChange = metricChange(currentSales, previousSales)

  if (salesChange !== null && salesChange <= -15) {
    candidates.push({
      id: 'sales-slowdown',
      tone: 'warning',
      badge: 'SPRZEDAŻ',
      title: 'Odśwież ekspozycję',
      summary: `Sprzedaż z ostatnich 7 dni jest o ${Math.abs(salesChange)}% niższa niż tydzień wcześniej.`,
      reason: `${money(currentSales)} zł teraz wobec ${money(previousSales)} zł w poprzednich 7 dniach.`,
      action: 'Najpierw porusz ekspozycją i mocnymi kategoriami. Nie przeceniaj całego sklepu tylko dlatego, że tydzień był słabszy.',
      priority: 90,
    })
  } else if (salesChange !== null && salesChange >= 15) {
    candidates.push({
      id: 'sales-momentum',
      tone: 'positive',
      badge: 'SPRZEDAŻ',
      title: 'Utrzymaj kierunek',
      summary: `Sprzedaż z ostatnich 7 dni wzrosła o ${salesChange}% tydzień do tygodnia.`,
      reason: `${money(currentSales)} zł teraz wobec ${money(previousSales)} zł wcześniej.`,
      action: 'Nie rób gwałtownych zmian cen. Wykorzystaj to, co już działa, i obserwuj które dostawy ciągną wynik.',
      priority: 72,
    })
  }

  if (!growingCategory) {
    const topCategory = [...categories]
      .filter((row) => row.category !== 'Bez kategorii' && row.currentSales > 0)
      .sort((a, b) => b.currentSales - a.currentSales)[0]

    if (topCategory) {
      candidates.push({
        id: `category-top-${topCategory.category}`,
        tone: 'neutral',
        badge: 'EKSPOZYCJA',
        title: `Trzymaj wysoko: ${topCategory.category}`,
        summary: `To najmocniejsza kategoria ostatnich 7 dni: ${money(topCategory.currentSales)} zł sprzedaży.`,
        reason: `Sprzedała ${topCategory.currentUnits} szt. w bieżącym tygodniowym oknie.`,
        action: 'Zostaw ją w dobrym miejscu i wykorzystuj jako punkt odniesienia przy układaniu sali.',
        priority: 66,
      })
    }
  }

  if (!accelerating) {
    const healthyDelivery = deliveries
      .filter((row) => row.remaining > 0 && row.soldTotal > 0)
      .sort((a, b) => b.sellThrough - a.sellThrough)[0]

    if (healthyDelivery) {
      candidates.push({
        id: `delivery-healthy-${healthyDelivery.deliveryNumber}`,
        tone: 'neutral',
        badge: 'DOSTAWA',
        title: `Pilnuj dostawy ${healthyDelivery.deliveryNumber}`,
        summary: `Ma ${healthyDelivery.sellThrough}% zbytu i nadal ${healthyDelivery.remaining} szt. do sprzedania.`,
        reason: `Sprzedano łącznie ${healthyDelivery.soldTotal} z ${healthyDelivery.quantity} sztuk.`,
        action: 'Nie chowaj jej zbyt wcześnie. To dobry kandydat do dalszej ekspozycji bez automatycznej przeceny.',
        priority: 62,
      })
    }
  }

  if (candidates.length < 3) {
    candidates.push({
      id: 'baseline-observe',
      tone: 'neutral',
      badge: 'OBSERWACJA',
      title: 'Dziś bez nerwowych ruchów',
      summary: 'Dane nie pokazują teraz mocnego sygnału wymagającego gwałtownej zmiany.',
      reason: `Analiza porównuje ${currentStart}–${today} z ${previousStart}–${previousEnd}.`,
      action: 'Obserwuj sprzedaż i ekspozycję. Kolejne sygnały pojawią się automatycznie, gdy dane wyraźnie odjadą od normy.',
      priority: 20,
    })
  }

  const unique = Array.from(new Map(candidates.map((item) => [item.id, item])).values())
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 3)

  return {
    ok: true,
    generatedAt: nowIso(),
    period: {
      currentStart,
      currentEnd: today,
      previousStart,
      previousEnd,
    },
    items: unique,
  }
}

type LeonDailyRecommendationRow = {
  forDate: string
  position: number
  recommendationId: string
  tone: 'positive' | 'warning' | 'neutral'
  badge: string
  title: string
  summary: string
  reason: string
  action: string
  priority: number
  generatedAt: string
  currentStart: string
  currentEnd: string
  previousStart: string
  previousEnd: string
}

function leonDailyTableMissing(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || '')
  return message.toLowerCase().includes('no such table: leon_daily_recommendations')
}

async function readLeonDailyRecommendationRows(env: Env, forDate: string) {
  try {
    const result = await env.DB.prepare(`
      SELECT
        for_date AS forDate,
        position,
        recommendation_id AS recommendationId,
        tone,
        badge,
        title,
        summary,
        reason,
        action,
        priority,
        generated_at AS generatedAt,
        current_start AS currentStart,
        current_end AS currentEnd,
        previous_start AS previousStart,
        previous_end AS previousEnd
      FROM leon_daily_recommendations
      WHERE for_date = ?
      ORDER BY position
    `).bind(forDate).all<LeonDailyRecommendationRow>()

    return result.results || []
  } catch (error) {
    if (leonDailyTableMissing(error)) return null
    throw error
  }
}

function dailyRowsToRecommendations(rows: LeonDailyRecommendationRow[]): AnalysisRecommendation[] {
  return rows.map((row) => ({
    id: row.recommendationId,
    tone: row.tone,
    badge: row.badge,
    title: row.title,
    summary: row.summary,
    reason: row.reason,
    action: row.action,
    priority: Number(row.priority || 0),
  }))
}


type LeonRecommendationDecisionRow = {
  forDate: string
  recommendationId: string
  decision: LeonRecommendationDecision
  firstDecidedAt: string
  updatedAt: string
}

function leonDecisionTableMissing(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || '')
  return message.toLowerCase().includes('no such table: leon_recommendation_decisions')
}

async function readLeonRecommendationDecisionRows(env: Env, fromDate: string, toDate = fromDate) {
  try {
    const result = await env.DB.prepare(`
      SELECT
        for_date AS forDate,
        recommendation_id AS recommendationId,
        decision,
        first_decided_at AS firstDecidedAt,
        updated_at AS updatedAt
      FROM leon_recommendation_decisions
      WHERE for_date >= ?
        AND for_date <= ?
      ORDER BY for_date DESC, updated_at DESC
    `).bind(fromDate, toDate).all<LeonRecommendationDecisionRow>()

    return result.results || []
  } catch (error) {
    if (leonDecisionTableMissing(error)) return []
    throw error
  }
}

async function attachLeonRecommendationDecisions(
  env: Env,
  forDate: string,
  items: AnalysisRecommendation[],
) {
  const rows = await readLeonRecommendationDecisionRows(env, forDate)
  const decisions = new Map(rows.map((row) => [row.recommendationId, row]))

  return items.map((item) => {
    const row = decisions.get(item.id)
    return {
      ...item,
      decision: row?.decision || null,
      decisionAt: row?.updatedAt || null,
    }
  })
}

async function prepareLeonDay(env: Env) {
  const today = warsawYmd()
  const personalNote = await leonMessageOfDay(env)
  const stored = await readLeonDailyRecommendationRows(env, today)

  if (stored && stored.length > 0) {
    const first = stored[0]
    return {
      ok: true,
      source: 'daily-snapshot',
      forDate: today,
      generatedAt: first.generatedAt,
      personalNote,
      period: {
        currentStart: first.currentStart,
        currentEnd: first.currentEnd,
        previousStart: first.previousStart,
        previousEnd: first.previousEnd,
      },
      items: await attachLeonRecommendationDecisions(env, today, dailyRowsToRecommendations(stored)),
    }
  }

  const calculated = await calculateAnalysisRecommendations(env, today)
  const generatedAt = nowIso()

  const statements = calculated.items.map((item, index) =>
    env.DB.prepare(`
      INSERT OR IGNORE INTO leon_daily_recommendations (
        for_date,
        position,
        recommendation_id,
        tone,
        badge,
        title,
        summary,
        reason,
        action,
        priority,
        generated_at,
        current_start,
        current_end,
        previous_start,
        previous_end
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      today,
      index + 1,
      item.id,
      item.tone,
      item.badge,
      item.title,
      item.summary,
      item.reason,
      item.action,
      item.priority,
      generatedAt,
      calculated.period.currentStart,
      calculated.period.currentEnd,
      calculated.period.previousStart,
      calculated.period.previousEnd,
    )
  )

  if (statements.length > 0) {
    try {
      await env.DB.batch(statements)
    } catch (error) {
      if (!leonDailyTableMissing(error)) throw error
      return {
        ok: true,
        source: 'live-fallback',
        forDate: today,
        generatedAt,
        personalNote,
        period: calculated.period,
        items: await attachLeonRecommendationDecisions(env, today, calculated.items),
      }
    }
  }

  const saved = await readLeonDailyRecommendationRows(env, today)
  if (saved && saved.length > 0) {
    const first = saved[0]
    return {
      ok: true,
      source: 'daily-snapshot',
      generatedAt: first.generatedAt,
      personalNote,
      period: {
        currentStart: first.currentStart,
        currentEnd: first.currentEnd,
        previousStart: first.previousStart,
        previousEnd: first.previousEnd,
      },
      items: await attachLeonRecommendationDecisions(env, today, dailyRowsToRecommendations(saved)),
    }
  }

  return {
    ok: true,
    source: 'live-fallback',
    forDate: today,
    generatedAt,
    personalNote,
    period: calculated.period,
    items: await attachLeonRecommendationDecisions(env, today, calculated.items),
  }
}

async function analysisRecommendations(env: Env) {
  return salesJson(await prepareLeonDay(env))
}

type LeonHistoryRow = LeonDailyRecommendationRow & {
  personalNoteId: number | null
  personalNoteText: string | null
}

async function analysisRecommendationHistory(url: URL, env: Env) {
  const requestedDays = Number.parseInt(url.searchParams.get('days') || '30', 10) || 30
  const days = Math.min(90, Math.max(1, requestedDays))
  const today = warsawYmd()
  const from = addDaysYmd(today, -(days - 1))

  let rows: LeonHistoryRow[] = []
  try {
    const result = await env.DB.prepare(`
      SELECT
        r.for_date AS forDate,
        r.position,
        r.recommendation_id AS recommendationId,
        r.tone,
        r.badge,
        r.title,
        r.summary,
        r.reason,
        r.action,
        r.priority,
        r.generated_at AS generatedAt,
        r.current_start AS currentStart,
        r.current_end AS currentEnd,
        r.previous_start AS previousStart,
        r.previous_end AS previousEnd,
        m.id AS personalNoteId,
        m.message AS personalNoteText
      FROM leon_daily_recommendations r
      LEFT JOIN leon_message_history h ON h.shown_on = r.for_date
      LEFT JOIN leon_messages m ON m.id = h.message_id
      WHERE r.for_date >= ?
        AND r.for_date <= ?
      ORDER BY r.for_date DESC, r.position ASC
    `).bind(from, today).all<LeonHistoryRow>()
    rows = result.results || []
  } catch (error) {
    if (!leonDailyTableMissing(error)) throw error
  }

  const decisionRows = await readLeonRecommendationDecisionRows(env, from, today)
  const decisionMap = new Map(
    decisionRows.map((row) => [`${row.forDate}\n${row.recommendationId}`, row]),
  )

  const daysMap = new Map<string, {
    date: string
    generatedAt: string
    personalNote: { id: number; text: string } | null
    items: AnalysisRecommendation[]
  }>()

  for (const row of rows) {
    let day = daysMap.get(row.forDate)
    if (!day) {
      day = {
        date: row.forDate,
        generatedAt: row.generatedAt,
        personalNote: row.personalNoteId && row.personalNoteText
          ? { id: Number(row.personalNoteId), text: String(row.personalNoteText) }
          : null,
        items: [],
      }
      daysMap.set(row.forDate, day)
    }

    const decision = decisionMap.get(`${row.forDate}\n${row.recommendationId}`)
    day.items.push({
      id: row.recommendationId,
      tone: row.tone,
      badge: row.badge,
      title: row.title,
      summary: row.summary,
      reason: row.reason,
      action: row.action,
      priority: Number(row.priority || 0),
      decision: decision?.decision || null,
      decisionAt: decision?.updatedAt || null,
    })
  }

  return salesJson({
    ok: true,
    today,
    days,
    items: Array.from(daysMap.values()),
  })
}


async function updateAnalysisRecommendationDecision(request: Request, env: Env) {
  let body: {
    forDate?: unknown
    recommendationId?: unknown
    decision?: unknown
  }

  try {
    body = await request.json() as typeof body
  } catch {
    return salesJson({ ok: false, error: 'Nieprawidłowy JSON.' }, 400)
  }

  const forDate = typeof body.forDate === 'string' ? body.forDate.trim() : ''
  const recommendationId = typeof body.recommendationId === 'string' ? body.recommendationId.trim() : ''
  const decision = body.decision

  if (!validYmd(forDate) || !recommendationId) {
    return salesJson({ ok: false, error: 'Brak daty lub identyfikatora rekomendacji.' }, 400)
  }

  if (decision !== 'do' && decision !== 'defer' && decision !== 'reject') {
    return salesJson({ ok: false, error: 'Nieprawidłowa decyzja.' }, 400)
  }

  const recommendation = await env.DB.prepare(`
    SELECT recommendation_id
    FROM leon_daily_recommendations
    WHERE for_date = ?
      AND recommendation_id = ?
    LIMIT 1
  `).bind(forDate, recommendationId).first<{ recommendation_id: string }>()

  if (!recommendation) {
    return salesJson({ ok: false, error: 'Rekomendacja nie istnieje w historii Leona.' }, 404)
  }

  const timestamp = nowIso()

  try {
    await env.DB.prepare(`
      INSERT INTO leon_recommendation_decisions (
        for_date,
        recommendation_id,
        decision,
        first_decided_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(for_date, recommendation_id) DO UPDATE SET
        decision = excluded.decision,
        updated_at = excluded.updated_at
    `).bind(forDate, recommendationId, decision, timestamp, timestamp).run()
  } catch (error) {
    if (leonDecisionTableMissing(error)) {
      return salesJson({ ok: false, error: 'Mechanizm decyzji jest jeszcze wdrażany.' }, 503)
    }
    throw error
  }

  return salesJson({
    ok: true,
    forDate,
    recommendationId,
    decision,
    decisionAt: timestamp,
  })
}


async function handleSalesApi(request: Request, url: URL, env: Env): Promise<Response | null> {
  const skMatch = url.pathname.match(/^\/api\/sales\/receipts\/([^/]+)\/sk$/)
  if (skMatch && request.method === 'PATCH') {
    return updateReceiptSk(request, decodeURIComponent(skMatch[1]), env)
  }

  if (request.method !== 'GET') return null

  if (url.pathname === '/api/dictionaries/categories') return salesCategories(env)
  if (url.pathname === '/api/dictionaries/items') return salesItems(url, env)
  if (url.pathname === '/api/dictionaries/payment-types') return salesPaymentTypes(env)
  if (url.pathname === '/api/sales/summary') return salesSummary(url, env)
  if (url.pathname === '/api/sales/receipts') return salesReceipts(url, env)

  const lineMatch = url.pathname.match(/^\/api\/sales\/receipts\/([^/]+)\/lines$/)
  if (lineMatch) {
    return salesReceiptLines(decodeURIComponent(lineMatch[1]), env)
  }

  return null
}

type IntegrationState = 'online' | 'warning' | 'offline' | 'unknown'

type IntegrationService = {
  id: 'api' | 'd1' | 'loyverse' | 'telegram' | 'online'
  label: string
  state: IntegrationState
  detail: string
}

type TelegramHealthPayload = {
  ok: boolean
  configured: boolean
  service: 'telegram'
  botUsername: string | null
  checkedAt: string
  error?: string
}

async function telegramBotHealth(env: Env): Promise<TelegramHealthPayload> {
  const botToken = env.TELEGRAM_BOT_TOKEN?.trim()

  if (!botToken) {
    return {
      ok: false,
      configured: false,
      service: 'telegram',
      botUsername: null,
      checkedAt: nowIso(),
      error: 'TELEGRAM_BOT_TOKEN is not configured',
    }
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/getMe`, {
      headers: { 'User-Agent': 'poleczka-pwa-telegram-health' },
      cf: { cacheTtl: 0, cacheEverything: false },
    })
    const payload = await response.json() as {
      ok?: boolean
      result?: { username?: string | null }
      description?: string
    }

    if (!response.ok || payload.ok !== true) {
      return {
        ok: false,
        configured: true,
        service: 'telegram',
        botUsername: null,
        checkedAt: nowIso(),
        error: payload.description || `Telegram Bot API HTTP ${response.status}`,
      }
    }

    return {
      ok: true,
      configured: true,
      service: 'telegram',
      botUsername: payload.result?.username || null,
      checkedAt: nowIso(),
    }
  } catch {
    return {
      ok: false,
      configured: true,
      service: 'telegram',
      botUsername: null,
      checkedAt: nowIso(),
      error: 'Brak odpowiedzi z Telegram Bot API',
    }
  }
}

function telegramHealthResponse(payload: TelegramHealthPayload) {
  return Response.json(payload, {
    status: payload.ok ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' },
  })
}

async function telegramIntegrationStatus(env: Env): Promise<IntegrationService> {
  const healthUrl = env.TELEGRAM_HEALTH_URL?.trim()

  try {
    if (healthUrl) {
      const response = await fetch(healthUrl, {
        headers: { 'User-Agent': 'poleczka-pwa-integration-status' },
        cf: { cacheTtl: 0, cacheEverything: false },
      })
      const payload = await response.json().catch(() => null) as { ok?: boolean; botUsername?: string | null } | null
      const healthy = response.ok && payload?.ok !== false

      return healthy
        ? {
            id: 'telegram',
            label: 'Telegram',
            state: 'online',
            detail: payload?.botUsername ? `Bot @${payload.botUsername} odpowiada` : 'Health check Telegram odpowiada',
          }
        : { id: 'telegram', label: 'Telegram', state: 'offline', detail: `Health check HTTP ${response.status}` }
    }
  } catch {
    return { id: 'telegram', label: 'Telegram', state: 'offline', detail: 'Brak odpowiedzi z health checku Telegram' }
  }

  const health = await telegramBotHealth(env)

  if (!health.configured) {
    return { id: 'telegram', label: 'Telegram', state: 'unknown', detail: 'Brak sekretu TELEGRAM_BOT_TOKEN' }
  }

  return health.ok
    ? {
        id: 'telegram',
        label: 'Telegram',
        state: 'online',
        detail: health.botUsername ? `Bot @${health.botUsername} odpowiada` : 'Telegram Bot API odpowiada',
      }
    : { id: 'telegram', label: 'Telegram', state: 'offline', detail: health.error || 'Health check Telegram nieudany' }
}

async function integrationStatus(env: Env) {
  const services: IntegrationService[] = [
    { id: 'api', label: 'API', state: 'online', detail: 'Worker PWA odpowiada' },
  ]

  let dbReachable = false

  try {
    const probe = await env.DB.prepare('SELECT 1 AS ok').first<{ ok: number }>()
    dbReachable = Number(probe?.ok || 0) === 1
  } catch {
    dbReachable = false
  }

  services.push({
    id: 'd1',
    label: 'D1',
    state: dbReachable ? 'online' : 'offline',
    detail: dbReachable ? 'Baza odpowiada na zapytania' : 'Brak odpowiedzi z D1',
  })

  if (dbReachable) {
    try {
      const [latest, pending] = await Promise.all([
        env.DB.prepare(`
          SELECT received_at AS receivedAt, processed_at AS processedAt, last_error AS lastError
          FROM webhook_events
          WHERE event_type = 'receipts.update'
          ORDER BY received_at DESC
          LIMIT 1
        `).first<{ receivedAt: string | null; processedAt: string | null; lastError: string | null }>(),
        env.DB.prepare(`
          SELECT COUNT(*) AS count
          FROM webhook_events
          WHERE processed_at IS NULL
        `).first<{ count: number }>(),
      ])

      const pendingCount = Number(pending?.count || 0)
      const hasError = Boolean(latest?.lastError)

      services.push({
        id: 'loyverse',
        label: 'Loyverse',
        state: hasError ? 'offline' : pendingCount > 0 ? 'warning' : latest?.processedAt ? 'online' : 'unknown',
        detail: hasError
          ? `Ostatni błąd: ${latest?.lastError}`
          : pendingCount > 0
            ? `${pendingCount} zdarzeń oczekuje na przetworzenie`
            : latest?.processedAt
              ? `Ostatnie zdarzenie przetworzone: ${latest.processedAt}`
              : 'Brak zdarzeń webhooka do oceny',
      })
    } catch {
      services.push({ id: 'loyverse', label: 'Loyverse', state: 'unknown', detail: 'Nie udało się odczytać historii webhooka' })
    }
  } else {
    services.push({ id: 'loyverse', label: 'Loyverse', state: 'unknown', detail: 'Status niedostępny bez połączenia z D1' })
  }

  services.push(await telegramIntegrationStatus(env))

  try {
    // Status integracji musi opierać się na świeżym stanie GitHub + BUILD_COMMIT_SHA,
    // a nie na potencjalnie przeterminowanym snapshotcie Durable Object.
    const pipeline = await reconcileSnapshot(env, 'dev')
    services.push({
      id: 'online',
      label: 'PWA',
      state: pipeline?.latestOnline
        ? 'online'
        : pipeline?.state === 'failed'
          ? 'offline'
          : pipeline?.state === 'building'
            ? 'warning'
            : pipeline?.deployedSha
              ? 'warning'
              : 'unknown',
      detail: pipeline?.latestOnline
        ? 'Najnowsza wersja jest online'
        : pipeline?.state === 'failed'
          ? 'Ostatnia publikacja zakończyła się błędem'
          : pipeline?.state === 'building'
            ? 'Trwa publikacja nowej wersji'
            : pipeline?.deployedSha
              ? 'Online działa poprzednia wersja'
              : 'Brak potwierdzonego stanu publikacji',
    })
  } catch {
    services.push({ id: 'online', label: 'PWA', state: 'unknown', detail: 'Nie udało się odczytać stanu publikacji' })
  }

  const hasOffline = services.some((service) => service.state === 'offline')
  const hasWarning = services.some((service) => service.state === 'warning' || service.state === 'unknown')
  const state: IntegrationState = hasOffline ? 'offline' : hasWarning ? 'warning' : 'online'

  return Response.json({
    ok: true,
    state,
    checkedAt: nowIso(),
    services,
  }, { headers: { 'Cache-Control': 'no-store' } })
}

export class PipelineHub {
  constructor(private ctx: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    if (request.headers.get('Upgrade') === 'websocket') {
      const pair = new WebSocketPair()
      const client = pair[0]
      const server = pair[1]
      this.ctx.acceptWebSocket(server)

      // Snapshot jest odświeżany w głównym Workerze przed zestawieniem połączenia.
      // Dzięki temu nowy klient nigdy nie dostaje starego stanu jako pierwszej wiadomości.
      const snapshot = await this.ctx.storage.get<PipelineSnapshot>('snapshot')
      if (snapshot) server.send(JSON.stringify(snapshot))

      return new Response(null, { status: 101, webSocket: client })
    }

    if (url.pathname === '/snapshot' && request.method === 'GET') {
      const snapshot = await this.ctx.storage.get<PipelineSnapshot>('snapshot')
      return snapshot
        ? Response.json(snapshot, { headers: { 'Cache-Control': 'no-store' } })
        : new Response('No snapshot', { status: 404 })
    }

    if (url.pathname === '/publish' && request.method === 'POST') {
      const snapshot = (await request.json()) as PipelineSnapshot
      await this.ctx.storage.put('snapshot', snapshot)
      const message = JSON.stringify(snapshot)
      for (const socket of this.ctx.getWebSockets()) {
        try {
          socket.send(message)
        } catch {
          try { socket.close(1011, 'stale socket') } catch { /* już zamknięty */ }
        }
      }
      return Response.json({ ok: true })
    }

    return new Response('Not found', { status: 404 })
  }

  webSocketMessage(socket: WebSocket, message: string | ArrayBuffer) {
    if (message === 'ping') socket.send('pong')
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/api/telegram-health') {
      return telegramHealthResponse(await telegramBotHealth(env))
    }

    if (url.pathname === '/api/integration-status') {
      return integrationStatus(env)
    }

    if (url.pathname === '/api/health') {
      let dbReachable = false

      try {
        const probe = await env.DB.prepare('SELECT 1 AS ok').first<{ ok: number }>()
        dbReachable = Number(probe?.ok || 0) === 1
      } catch {
        dbReachable = false
      }

      return Response.json({
        ok: true,
        service: 'poleczka-pwa',
        database: Boolean(env.DB),
        dbReachable,
        pipeline: Boolean(env.PIPELINE_HUB),
        deployedSha: BUILD_COMMIT_SHA,
        deployedBranch: BUILD_BRANCH,
        deployedAt: BUILD_TIME,
      }, { headers: { 'Cache-Control': 'no-store' } })
    }



    if (url.pathname === '/api/analysis/recommendations/decision' && request.method === 'PUT') {
      try {
        return updateAnalysisRecommendationDecision(request, env)
      } catch (error) {
        return salesJson({
          ok: false,
          error: error instanceof Error ? error.message : 'Analysis recommendation decision API failed',
        }, 500)
      }
    }

    if (url.pathname === '/api/analysis/recommendations/history' && request.method === 'GET') {
      try {
        return analysisRecommendationHistory(url, env)
      } catch (error) {
        return salesJson({
          ok: false,
          error: error instanceof Error ? error.message : 'Analysis recommendation history API failed',
        }, 500)
      }
    }

    if (url.pathname === '/api/analysis/recommendations' && request.method === 'GET') {
      try {
        return analysisRecommendations(env)
      } catch (error) {
        return salesJson({
          ok: false,
          error: error instanceof Error ? error.message : 'Analysis recommendations API failed',
        }, 500)
      }
    }

    if (url.pathname === '/api/dashboard' && request.method === 'GET') {
      try {
        return dashboardData(url, env)
      } catch (error) {
        return salesJson({
          ok: false,
          error: error instanceof Error ? error.message : 'Dashboard API failed',
        }, 500)
      }
    }

    if (url.pathname.startsWith('/api/deliveries')) {
      try {
        const response = await handleDeliveriesApi(request, url, env)
        if (response) return response
      } catch (error) {
        return salesJson({
          ok: false,
          error: error instanceof Error ? error.message : 'Deliveries API failed',
        }, 500)
      }
    }

    if (url.pathname.startsWith('/api/sales/') || url.pathname.startsWith('/api/dictionaries/')) {
      try {
        const response = await handleSalesApi(request, url, env)
        if (response) return response
      } catch (error) {
        return salesJson({
          ok: false,
          error: error instanceof Error ? error.message : 'Sales API failed',
        }, 500)
      }
    }

    if (url.pathname === '/api/pipeline/ws') {
      if (request.headers.get('Upgrade') !== 'websocket') {
        return Response.json({ ok: false, error: 'WebSocket required' }, { status: 426 })
      }

      // Przed podłączeniem klienta naprawiamy ewentualnie utracone eventy na podstawie
      // rzeczywistego stanu workflow GitHub + BUILD_COMMIT_SHA aktualnego wdrożenia.
      try {
        await reconcileSnapshot(env, 'dev')
      } catch {
        // WebSocket nadal może działać na ostatnim zapisanym snapshotcie.
      }

      const stub = await pipelineStub(env)
      return stub.fetch(request)
    }

    if (url.pathname === '/api/pipeline-event' && request.method === 'POST') {
      try {
        const event = (await request.json()) as PipelineEvent
        if (!event?.type) return Response.json({ ok: false, error: 'Missing event type' }, { status: 400 })
        const branch = event.branch || 'dev'
        let current = await getStoredSnapshot(env)
        if (snapshotNeedsRepair(current)) current = await bootstrapSnapshot(branch)
        const snapshot = applyEvent(current || blankSnapshot(branch), event)
        await publishSnapshot(env, snapshot)
        return Response.json(snapshot, { headers: { 'Cache-Control': 'no-store' } })
      } catch (error) {
        return Response.json({ ok: false, error: error instanceof Error ? error.message : 'Pipeline event failed' }, { status: 500 })
      }
    }

    // Zgodność ze starszym workflow. Nowe automaty używają /api/pipeline-event.
    if (url.pathname === '/api/pipeline-refresh') {
      try {
        const branch = url.searchParams.get('branch')?.trim() || 'dev'
        const phase = url.searchParams.get('phase') as PipelinePhase | null
        const sha = url.searchParams.get('sha')
        const runNumberRaw = url.searchParams.get('runNumber')
        const runNumber = runNumberRaw ? Number(runNumberRaw) : null
        const current = (await getStoredSnapshot(env)) || await bootstrapSnapshot(branch)

        const event: PipelineEvent = phase
          ? { type: phase, branch, sha, runNumber, updatedAt: nowIso() }
          : { type: 'work', branch, work: await fetchWorkStatus(), updatedAt: nowIso() }

        const snapshot = applyEvent(current, event)
        await publishSnapshot(env, snapshot)
        return Response.json(snapshot, { headers: { 'Cache-Control': 'no-store' } })
      } catch (error) {
        return Response.json({ ok: false, error: error instanceof Error ? error.message : 'Pipeline refresh failed' }, { status: 500 })
      }
    }

    if (url.pathname === '/api/build-status') {
      const branch = url.searchParams.get('branch')?.trim() || 'dev'
      try {
        const snapshot = await reconcileSnapshot(env, branch)
        return Response.json(snapshot, { headers: { 'Cache-Control': 'no-store' } })
      } catch {
        const stored = await getStoredSnapshot(env)
        return Response.json(stored || blankSnapshot(branch), { headers: { 'Cache-Control': 'no-store' } })
      }
    }

    return Response.json({ ok: false, error: 'Not found' }, { status: 404 })
  },

  async scheduled(_controller: ScheduledController, env: Env, _ctx: ExecutionContext): Promise<void> {
    await prepareLeonDay(env)
  },
}
