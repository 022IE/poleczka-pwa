import { BUILD_BRANCH, BUILD_COMMIT_SHA, BUILD_TIME } from './buildInfo'

export interface Env {
  DB: D1Database
}

type StageState = 'waiting' | 'running' | 'ready' | 'failed' | 'blocked' | 'unknown'

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

async function getBuildStatus(branch: string): Promise<Response> {
  const endpoint = new URL('https://api.github.com/repos/022IE/poleczka-pwa/actions/runs')
  endpoint.searchParams.set('branch', branch)
  endpoint.searchParams.set('event', 'push')
  endpoint.searchParams.set('per_page', '1')

  const githubResponse = await fetch(endpoint, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'poleczka-pwa-build-status',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })

  if (!githubResponse.ok) {
    return Response.json(
      { ok: false, error: `GitHub API: ${githubResponse.status}` },
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
        url: null,
        stages: {
          github: { state: 'unknown' as StageState },
          build: { state: 'unknown' as StageState },
          cloudflare: { state: 'unknown' as StageState },
          online: { state: 'unknown' as StageState },
        },
      },
      { headers: { 'Cache-Control': 'public, max-age=15' } },
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
      url: run.html_url ?? null,
      latestOnline: isLatestOnline,
      stages: {
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
    { headers: { 'Cache-Control': 'public, max-age=15' } },
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
