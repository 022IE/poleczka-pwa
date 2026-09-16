import { BUILD_BRANCH, BUILD_COMMIT_SHA, BUILD_TIME } from './buildInfo'

export interface Env {
  DB: D1Database
  PIPELINE_HUB: DurableObjectNamespace
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
  status?: string | null
  conclusion?: string | null
  head_branch?: string | null
  head_sha?: string | null
  run_number?: number
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
    const endpoint = new URL('https://api.github.com/repos/022IE/poleczka-pwa/actions/runs')
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

  if (work.state === 'editing') {
    snapshot.stages.github = { state: 'waiting', label: 'Czeka na zapis zmian' }
    snapshot.stages.build = { state: 'waiting', label: 'Oczekuje na zmiany' }
    snapshot.stages.cloudflare = { state: 'waiting', label: 'Oczekuje' }
  }

  if (!run) return snapshot

  snapshot.branch = run.head_branch || branch
  snapshot.runNumber = run.run_number ?? null
  snapshot.headSha = run.head_sha || null
  snapshot.headShaShort = shortSha(snapshot.headSha)
  snapshot.url = run.html_url || null
  snapshot.status = run.status ?? null
  snapshot.conclusion = run.conclusion ?? null
  snapshot.updatedAt = run.updated_at || snapshot.updatedAt

  const deployedSha = snapshot.deployedSha
  const isLatestOnline = Boolean(snapshot.headSha && deployedSha && snapshot.headSha === deployedSha)
  snapshot.latestOnline = isLatestOnline

  if (run.status && run.status !== 'completed') {
    snapshot.state = 'building'
    snapshot.stages.github = { state: 'ready', label: 'Zmiana wysłana' }
    snapshot.stages.build = { state: 'running', label: 'Build trwa' }
    snapshot.stages.cloudflare = { state: 'waiting', label: 'Oczekuje' }
  } else if (run.status === 'completed' && run.conclusion === 'success') {
    snapshot.state = isLatestOnline ? 'ready' : 'ready'
    snapshot.stages.github = { state: 'ready', label: 'Zmiana wysłana' }
    snapshot.stages.build = { state: 'ready', label: 'Build gotowy' }
    snapshot.stages.cloudflare = isLatestOnline
      ? { state: 'ready', label: 'Wdrożono' }
      : { state: 'running', label: 'Wdrażanie' }
  } else if (run.status === 'completed' && run.conclusion) {
    snapshot.state = 'failed'
    snapshot.stages.github = { state: 'ready', label: 'Zmiana wysłana' }
    snapshot.stages.build = { state: 'failed', label: 'Build nieudany' }
    snapshot.stages.cloudflare = { state: 'blocked', label: 'Zablokowane' }
  }

  snapshot.stages.online = isLatestOnline
    ? { state: 'ready', label: 'Najnowsza wersja online' }
    : deployedSha
      ? { state: 'ready', label: 'Poprzednia wersja online' }
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
      ? { state: 'ready', label: 'Poprzednia wersja online' }
      : { state: 'unknown', label: 'Niepotwierdzone' }
  }

  if (event.type === 'build_ready') {
    snapshot.state = 'ready'
    snapshot.status = 'completed'
    snapshot.conclusion = 'success'
    snapshot.latestOnline = false
    snapshot.stages.build = { state: 'ready', label: 'Build gotowy' }
    snapshot.stages.cloudflare = { state: 'running', label: 'Wdrażanie' }
    snapshot.stages.online = snapshot.deployedSha
      ? { state: 'ready', label: 'Poprzednia wersja online' }
      : { state: 'waiting', label: 'Czeka na wdrożenie' }
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

export class PipelineHub {
  constructor(private ctx: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    if (request.headers.get('Upgrade') === 'websocket') {
      const pair = new WebSocketPair()
      const client = pair[0]
      const server = pair[1]
      this.ctx.acceptWebSocket(server)

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

    if (url.pathname === '/api/health') {
      return Response.json({
        ok: true,
        service: 'poleczka-pwa',
        database: Boolean(env.DB),
        pipeline: Boolean(env.PIPELINE_HUB),
        deployedSha: BUILD_COMMIT_SHA,
        deployedBranch: BUILD_BRANCH,
        deployedAt: BUILD_TIME,
      }, { headers: { 'Cache-Control': 'no-store' } })
    }

    if (url.pathname === '/api/pipeline/ws') {
      if (request.headers.get('Upgrade') !== 'websocket') {
        return Response.json({ ok: false, error: 'WebSocket required' }, { status: 426 })
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
        let snapshot = await getStoredSnapshot(env)
        if (snapshotNeedsRepair(snapshot)) {
          snapshot = await bootstrapSnapshot(branch)
          await publishSnapshot(env, snapshot)
        }
        return Response.json(snapshot || blankSnapshot(branch), { headers: { 'Cache-Control': 'no-store' } })
      } catch {
        // Nawet przy awarii zewnętrznych źródeł frontend dostaje użyteczny, opisany stan.
        return Response.json(blankSnapshot(branch), { headers: { 'Cache-Control': 'no-store' } })
      }
    }

    return Response.json({ ok: false, error: 'Not found' }, { status: 404 })
  },
}
