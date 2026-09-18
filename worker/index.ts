import { BUILD_BRANCH, BUILD_COMMIT_SHA, BUILD_TIME } from './buildInfo'

export interface Env {
  DB: D1Database
  PIPELINE_HUB: DurableObjectNamespace
  TELEGRAM_HEALTH_URL?: string
  TELEGRAM_BOT_TOKEN?: string
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
            OR COALESCE(lfs.line_note, '') LIKE ? ESCAPE '\\'
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
      OR COALESCE(l.line_note, '') LIKE ? ESCAPE '\\'
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

  return salesJson({ ok: true, items: result.results || [] })
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
    payment: string
  }>()

  return salesJson({
    ok: true,
    page: safePage,
    pageSize,
    total,
    totalPages,
    items: result.results || [],
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
      CASE
        WHEN TRIM(COALESCE(l.line_note, '')) = '' THEN '-1'
        ELSE TRIM(l.line_note)
      END AS deliveryNo
    FROM receipt_lines l
    LEFT JOIN items i ON i.item_id = l.item_id
    LEFT JOIN categories c ON c.category_id = i.category_id
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
  }>()

  return salesJson({ ok: true, items: result.results || [] })
}

async function handleSalesApi(request: Request, url: URL, env: Env): Promise<Response | null> {
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

async function telegramIntegrationStatus(env: Env): Promise<IntegrationService> {
  const healthUrl = env.TELEGRAM_HEALTH_URL?.trim()
  const botToken = env.TELEGRAM_BOT_TOKEN?.trim()

  try {
    if (healthUrl) {
      const response = await fetch(healthUrl, {
        headers: { 'User-Agent': 'poleczka-pwa-integration-status' },
        cf: { cacheTtl: 0, cacheEverything: false },
      })

      return response.ok
        ? { id: 'telegram', label: 'Telegram', state: 'online', detail: 'Bot / Worker odpowiada' }
        : { id: 'telegram', label: 'Telegram', state: 'offline', detail: `Health check HTTP ${response.status}` }
    }

    if (botToken) {
      const response = await fetch(`https://api.telegram.org/bot${botToken}/getMe`, {
        headers: { 'User-Agent': 'poleczka-pwa-integration-status' },
        cf: { cacheTtl: 0, cacheEverything: false },
      })
      const payload = await response.json() as { ok?: boolean }

      return response.ok && payload.ok
        ? { id: 'telegram', label: 'Telegram', state: 'online', detail: 'Telegram Bot API odpowiada' }
        : { id: 'telegram', label: 'Telegram', state: 'offline', detail: 'Telegram Bot API nie potwierdziło bota' }
    }
  } catch {
    return { id: 'telegram', label: 'Telegram', state: 'offline', detail: 'Brak odpowiedzi z usługi Telegram' }
  }

  return { id: 'telegram', label: 'Telegram', state: 'unknown', detail: 'Brak skonfigurowanego health checku' }
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
    const pipeline = await getStoredSnapshot(env)
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
}
