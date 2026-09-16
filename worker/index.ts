import { BUILD_BRANCH, BUILD_COMMIT_SHA, BUILD_TIME } from './buildInfo'

export interface Env {
  DB: D1Database
  PIPELINE_HUB: DurableObjectNamespace
}

type StageState = 'waiting' | 'running' | 'ready' | 'failed' | 'blocked' | 'unknown'
type PipelinePhase = 'build_start' | 'build_ready' | 'build_failed' | 'online' | null

type WorkStatus = {
  state?: 'editing' | 'awaiting_publish' | 'idle' | 'unknown'
  label?: string
  task?: string
  updatedAt?: string | null
}

type GitHubWorkflowRun = {
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

function shortSha(value?: string | null) {
  return value && value !== 'unknown' ? value.slice(0, 8) : null
}

async function fetchWorkStatus(): Promise<WorkStatus> {
  const branches = ['pipeline-status', 'dev']

  for (const branch of branches) {
    try {
      const response = await fetch(`https://raw.githubusercontent.com/022IE/poleczka-pwa/${branch}/status/work-status.json`, {
        headers: { 'User-Agent': 'poleczka-pwa-pipeline' },
        cf: { cacheTtl: 0, cacheEverything: false },
      })
      if (response.ok) return (await response.json()) as WorkStatus
    } catch {
      // Próbujemy gałęzi zapasowej.
    }
  }

  return { state: 'unknown', label: 'Status prac nieznany', task: '', updatedAt: null }
}

async function fetchLatestRun(branch: string): Promise<GitHubWorkflowRun | null> {
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
  })

  if (!response.ok) throw new Error(`GitHub API: ${response.status}`)
  const payload = (await response.json()) as GitHubRunsResponse
  return payload.workflow_runs?.[0] || null
}

function workStage(work: WorkStatus) {
  if (work.state === 'editing') return { state: 'running' as StageState, label: work.label || 'Wprowadzanie poprawek' }
  if (work.state === 'awaiting_publish') return { state: 'ready' as StageState, label: work.label || 'Zmiany gotowe' }
  if (work.state === 'idle') return { state: 'ready' as StageState, label: work.label || 'Gotowe' }
  return { state: 'unknown' as StageState, label: work.label || 'Status nieznany' }
}

async function buildSnapshot(branch: string, phase: PipelinePhase = null, hintedSha?: string | null) {
  const [run, work] = await Promise.all([fetchLatestRun(branch), fetchWorkStatus()])

  if (!run) {
    return {
      ok: true,
      state: 'unknown' as const,
      branch,
      status: null,
      conclusion: null,
      runNumber: null,
      headSha: null,
      headShaShort: null,
      deployedSha: BUILD_COMMIT_SHA !== 'unknown' ? BUILD_COMMIT_SHA : null,
      deployedShaShort: shortSha(BUILD_COMMIT_SHA),
      deployedBranch: BUILD_BRANCH,
      deployedAt: BUILD_TIME,
      updatedAt: work.updatedAt || null,
      url: null,
      latestOnline: false,
      work,
      stages: {
        work: workStage(work),
        github: { state: work.state === 'editing' ? 'waiting' as StageState : 'unknown' as StageState, label: work.state === 'editing' ? 'Czeka na commit' : 'Status nieznany' },
        build: { state: 'waiting' as StageState, label: 'Oczekuje' },
        cloudflare: { state: 'waiting' as StageState, label: 'Oczekuje' },
        online: { state: BUILD_COMMIT_SHA !== 'unknown' ? 'ready' as StageState : 'unknown' as StageState, label: BUILD_COMMIT_SHA !== 'unknown' ? 'Poprzednia wersja online' : 'Status nieznany' },
      },
    }
  }

  let state: 'building' | 'ready' | 'failed' | 'unknown' = 'unknown'
  let buildStage: StageState = 'unknown'

  if (run.status && run.status !== 'completed') {
    state = 'building'
    buildStage = 'running'
  } else if (run.status === 'completed' && run.conclusion === 'success') {
    state = 'ready'
    buildStage = 'ready'
  } else if (run.status === 'completed' && run.conclusion) {
    state = 'failed'
    buildStage = 'failed'
  }

  const latestSha = run.head_sha || null
  const deployedSha = BUILD_COMMIT_SHA !== 'unknown' ? BUILD_COMMIT_SHA : null
  const isLatestOnline = Boolean(latestSha && deployedSha && latestSha === deployedSha)
  const phaseMatches = Boolean(phase && hintedSha && latestSha && hintedSha === latestSha)

  let githubStage: StageState = work.state === 'editing' ? 'waiting' : 'ready'
  let cloudflareStage: StageState = 'waiting'
  let onlineStage: StageState = deployedSha ? 'ready' : 'unknown'

  if (work.state === 'editing' && !phaseMatches) {
    buildStage = 'waiting'
    state = 'unknown'
  }

  if (buildStage === 'failed') {
    cloudflareStage = 'blocked'
  } else if (buildStage === 'running' || buildStage === 'unknown' || buildStage === 'waiting') {
    cloudflareStage = 'waiting'
  } else if (isLatestOnline) {
    cloudflareStage = 'ready'
    onlineStage = 'ready'
  } else {
    cloudflareStage = 'running'
  }

  if (phaseMatches) {
    githubStage = 'ready'
    if (phase === 'build_start') {
      state = 'building'
      buildStage = 'running'
      cloudflareStage = 'waiting'
    } else if (phase === 'build_ready') {
      state = 'ready'
      buildStage = 'ready'
      cloudflareStage = isLatestOnline ? 'ready' : 'running'
    } else if (phase === 'build_failed') {
      state = 'failed'
      buildStage = 'failed'
      cloudflareStage = 'blocked'
    } else if (phase === 'online') {
      state = 'ready'
      buildStage = 'ready'
      cloudflareStage = 'ready'
      onlineStage = 'ready'
    }
  }

  return {
    ok: true,
    state,
    status: run.status ?? null,
    conclusion: run.conclusion ?? null,
    branch: run.head_branch || branch,
    runNumber: run.run_number ?? null,
    headSha: latestSha,
    headShaShort: shortSha(latestSha),
    deployedSha,
    deployedShaShort: shortSha(deployedSha),
    deployedBranch: BUILD_BRANCH,
    deployedAt: BUILD_TIME,
    updatedAt: run.updated_at ?? work.updatedAt ?? null,
    url: run.html_url ?? null,
    latestOnline: phase === 'online' && phaseMatches ? true : isLatestOnline,
    work,
    stages: {
      work: workStage(work),
      github: {
        state: githubStage,
        label: githubStage === 'ready' ? 'Zmiana wysłana' : 'Czeka na commit',
      },
      build: {
        state: buildStage,
        label:
          buildStage === 'running'
            ? 'Build trwa'
            : buildStage === 'ready'
              ? 'Build gotowy'
              : buildStage === 'failed'
                ? 'Build nieudany'
                : buildStage === 'waiting'
                  ? 'Oczekuje'
                  : 'Status nieznany',
      },
      cloudflare: {
        state: cloudflareStage,
        label:
          cloudflareStage === 'ready'
            ? 'Wdrożono'
            : cloudflareStage === 'running'
              ? 'Wdrażanie'
              : cloudflareStage === 'blocked'
                ? 'Zablokowane'
                : 'Oczekuje',
      },
      online: {
        state: onlineStage,
        label: (phase === 'online' && phaseMatches) || isLatestOnline ? 'Najnowsza wersja online' : deployedSha ? 'Poprzednia wersja online' : 'Status online nieznany',
      },
    },
  }
}

async function pipelineStub(env: Env) {
  const id = env.PIPELINE_HUB.idFromName('global')
  return env.PIPELINE_HUB.get(id)
}

async function publishSnapshot(env: Env, snapshot: unknown) {
  const stub = await pipelineStub(env)
  await stub.fetch('https://pipeline.internal/publish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(snapshot),
  })
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

      const snapshot = await this.ctx.storage.get('snapshot')
      if (snapshot) server.send(JSON.stringify(snapshot))

      return new Response(null, { status: 101, webSocket: client })
    }

    if (url.pathname === '/publish' && request.method === 'POST') {
      const snapshot = await request.json()
      await this.ctx.storage.put('snapshot', snapshot)
      const message = JSON.stringify(snapshot)
      for (const socket of this.ctx.getWebSockets()) {
        try { socket.send(message) } catch { /* klient już się rozłączył */ }
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

    if (url.pathname === '/api/pipeline-refresh') {
      const branch = url.searchParams.get('branch')?.trim() || 'dev'
      const phase = (url.searchParams.get('phase') || null) as PipelinePhase
      const hintedSha = url.searchParams.get('sha')
      try {
        const snapshot = await buildSnapshot(branch, phase, hintedSha)
        await publishSnapshot(env, snapshot)
        return Response.json(snapshot, { headers: { 'Cache-Control': 'no-store' } })
      } catch (error) {
        return Response.json({ ok: false, error: error instanceof Error ? error.message : 'Pipeline refresh failed' }, { status: 502 })
      }
    }

    if (url.pathname === '/api/build-status') {
      const branch = url.searchParams.get('branch')?.trim() || 'dev'
      try {
        const snapshot = await buildSnapshot(branch)
        return Response.json(snapshot, { headers: { 'Cache-Control': 'no-store' } })
      } catch (error) {
        return Response.json({ ok: false, error: error instanceof Error ? error.message : 'Pipeline status failed' }, { status: 502 })
      }
    }

    return Response.json({ ok: false, error: 'Not found' }, { status: 404 })
  },
}
