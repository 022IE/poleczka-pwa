import { BUILD_BRANCH, BUILD_COMMIT_SHA, BUILD_TIME } from './buildInfo'

export interface Env {
  DB: D1Database
}

type StageState = 'waiting' | 'running' | 'ready' | 'failed' | 'blocked' | 'unknown'
type WorkState = 'idle' | 'editing' | 'awaiting_publish'

type WorkStatus = {
  state?: WorkState
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

async function getWorkStatus(branch: string): Promise<WorkStatus> {
  try {
    const endpoint = `https://raw.githubusercontent.com/022IE/poleczka-pwa/${encodeURIComponent(branch)}/status/work-status.json?t=${Date.now()}`
    const response = await fetch(endpoint, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'poleczka-pwa-work-status',
        'Cache-Control': 'no-cache',
      },
    })

    if (!response.ok) return { state: 'idle', label: 'Brak aktywnych zmian', updatedAt: null }
    return (await response.json()) as WorkStatus
  } catch {
    return { state: 'idle', label: 'Brak aktywnych zmian', updatedAt: null }
  }
}

function getWorkStage(workStatus: WorkStatus): { state: StageState; label: string } {
  if (workStatus.state === 'editing') {
    return { state: 'running', label: workStatus.label || 'Wprowadzanie poprawek' }
  }

  if (workStatus.state === 'awaiting_publish') {
    return { state: 'ready', label: workStatus.label || 'Poprawki gotowe' }
  }

  return { state: 'ready', label: workStatus.label || 'Brak aktywnych zmian' }
}

async function getBuildStatus(branch: string): Promise<Response> {
  const [workStatus, githubResponse] = await Promise.all([
    getWorkStatus(branch),
    fetch((() => {
      const endpoint = new URL('https://api.github.com/repos/022IE/poleczka-pwa/actions/runs')
      endpoint.searchParams.set('branch', branch)
      endpoint.searchParams.set('event', 'push')
      endpoint.searchParams.set('per_page', '1')
      return endpoint
    })(), {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'poleczka-pwa-build-status',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    }),
  ])

  const workStage = getWorkStage(workStatus)

  if (!githubResponse.ok) {
    return Response.json(
      { ok: false, error: `GitHub API: ${githubResponse.status}`, workStatus },
      { status: 502, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  const payload = (await githubResponse.json()) as GitHubRunsResponse
  const run = payload.workflow_runs?.[0]

  if (!run) {
    return Response.json(
      {
        ok: true,
        state: 'unknown',
        branch,
        status: null,
        conclusion: null,
        runNumber: null,
        headSha: null,
        deployedSha: BUILD_COMMIT_SHA,
        deployedBranch: BUILD_BRANCH,
        deployedAt: BUILD_TIME,
        updatedAt: null,
        workStatus,
        url: null,
        stages: {
          work: workStage,
          github: { state: 'unknown' as StageState, label: 'Status nieznany' },
          build: { state: 'unknown' as StageState, label: 'Status nieznany' },
          cloudflare: { state: 'unknown' as StageState, label: 'Status nieznany' },
          online: { state: 'unknown' as StageState, label: 'Status nieznany' },
        },
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
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

  let cloudflareStage: StageState = 'waiting'
  let onlineStage: StageState = deployedSha ? 'ready' : 'unknown'

  if (buildStage === 'failed') {
    cloudflareStage = 'blocked'
  } else if (buildStage === 'running' || buildStage === 'unknown') {
    cloudflareStage = 'waiting'
  } else if (isLatestOnline) {
    cloudflareStage = 'ready'
    onlineStage = 'ready'
  } else {
    cloudflareStage = 'running'
  }

  return Response.json(
    {
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
      updatedAt: run.updated_at ?? null,
      workStatus,
      url: run.html_url ?? null,
      latestOnline: isLatestOnline,
      stages: {
        work: workStage,
        github: {
          state: 'ready' as StageState,
          label: 'Zmiana wysłana',
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
                  : 'Build nieznany',
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
          label: isLatestOnline ? 'Najnowsza wersja online' : deployedSha ? 'Poprzednia wersja online' : 'Status online nieznany',
        },
      },
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
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
      })
    }

    if (url.pathname === '/api/build-status') {
      const branch = url.searchParams.get('branch')?.trim() || 'dev'
      return getBuildStatus(branch)
    }

    return Response.json({ ok: false, error: 'Not found' }, { status: 404 })
  },
}
