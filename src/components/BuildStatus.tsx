import { useCallback, useEffect, useMemo, useState } from 'react'

type StageState = 'waiting' | 'running' | 'ready' | 'failed' | 'blocked' | 'unknown'

type PipelineStage = {
  state: StageState
  label?: string
}

type BuildStatusResponse = {
  ok: boolean
  state?: 'building' | 'ready' | 'failed' | 'unknown'
  status?: string | null
  conclusion?: string | null
  branch?: string
  runNumber?: number
  headSha?: string | null
  headShaShort?: string | null
  deployedSha?: string | null
  deployedShaShort?: string | null
  deployedBranch?: string | null
  deployedAt?: string | null
  updatedAt?: string | null
  latestOnline?: boolean
  url?: string | null
  stages?: {
    github?: PipelineStage
    build?: PipelineStage
    cloudflare?: PipelineStage
    online?: PipelineStage
  }
  error?: string
}

const fallbackStage: PipelineStage = { state: 'unknown', label: 'Status nieznany' }

const stageNames = {
  github: 'GitHub',
  build: 'Build',
  cloudflare: 'Cloudflare',
  online: 'Online',
} as const

const stageOrder = ['github', 'build', 'cloudflare', 'online'] as const

function iconFor(state: StageState) {
  if (state === 'ready') return '✓'
  if (state === 'failed' || state === 'blocked') return '×'
  if (state === 'running') return '↻'
  if (state === 'waiting') return '…'
  return '?'
}

export default function BuildStatus() {
  const [data, setData] = useState<BuildStatusResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(true)
  const branch = 'dev'

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/build-status?branch=${encodeURIComponent(branch)}`, {
        cache: 'no-store',
      })
      const payload = (await response.json()) as BuildStatusResponse
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'Build status unavailable')
      setData(payload)
    } catch {
      setData({ ok: false, state: 'unknown' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => void load(), 10000)
    return () => window.clearInterval(timer)
  }, [load])

  const stages = useMemo(() => {
    if (!data?.ok) {
      return {
        github: fallbackStage,
        build: fallbackStage,
        cloudflare: fallbackStage,
        online: fallbackStage,
      }
    }

    return {
      github: data.stages?.github || { state: 'ready', label: 'Zmiana wysłana' },
      build:
        data.stages?.build ||
        ({
          state: data.state === 'building' ? 'running' : data.state === 'ready' ? 'ready' : data.state === 'failed' ? 'failed' : 'unknown',
          label: data.state === 'building' ? 'Build trwa' : data.state === 'ready' ? 'Build gotowy' : data.state === 'failed' ? 'Build nieudany' : 'Status nieznany',
        } as PipelineStage),
      cloudflare: data.stages?.cloudflare || fallbackStage,
      online: data.stages?.online || fallbackStage,
    }
  }, [data])

  const pipelineState = loading
    ? 'running'
    : !data?.ok
      ? 'unknown'
      : stages.build.state === 'failed' || stages.cloudflare.state === 'failed' || stages.cloudflare.state === 'blocked'
        ? 'failed'
        : data.latestOnline
          ? 'ready'
          : stages.build.state === 'running' || stages.cloudflare.state === 'running'
            ? 'running'
            : 'waiting'

  const headline = loading
    ? 'Sprawdzam publikację…'
    : pipelineState === 'ready'
      ? 'Najnowsza wersja jest online'
      : pipelineState === 'failed'
        ? 'Publikacja wymaga uwagi'
        : pipelineState === 'running'
          ? 'Publikacja trwa…'
          : 'Oczekiwanie na publikację'

  const updated = data?.updatedAt
    ? new Intl.DateTimeFormat('pl-PL', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(data.updatedAt))
    : null

  return (
    <aside className={`build-pipeline is-${pipelineState} ${expanded ? 'is-expanded' : 'is-collapsed'}`} aria-live="polite">
      <div className="build-pipeline-head">
        <button
          type="button"
          className="build-pipeline-toggle"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          title={expanded ? 'Zwiń status publikacji' : 'Rozwiń status publikacji'}
        >
          <span className="build-pipeline-main-dot" aria-hidden="true" />
          <span className="build-pipeline-title">
            <strong>{headline}</strong>
            <small>
              {data?.branch || branch}
              {data?.runNumber ? ` • build #${data.runNumber}` : ''}
              {updated ? ` • ${updated}` : ''}
            </small>
          </span>
          <span className="build-pipeline-chevron">{expanded ? '⌄' : '⌃'}</span>
        </button>
        <button
          type="button"
          className="build-pipeline-refresh"
          onClick={() => {
            setLoading(true)
            void load()
          }}
          aria-label="Odśwież status publikacji"
          title="Odśwież"
        >
          ↻
        </button>
      </div>

      {expanded && (
        <>
          <div className="build-pipeline-flow">
            {stageOrder.map((key, index) => {
              const stage = stages[key]
              return (
                <div className="build-pipeline-stage-wrap" key={key}>
                  <div className={`build-pipeline-stage is-${stage.state}`}>
                    <span className="build-pipeline-stage-icon" aria-hidden="true">{iconFor(stage.state)}</span>
                    <span>
                      <b>{stageNames[key]}</b>
                      <small>{stage.label || 'Status nieznany'}</small>
                    </span>
                  </div>
                  {index < stageOrder.length - 1 && <span className="build-pipeline-arrow" aria-hidden="true">→</span>}
                </div>
              )
            })}
          </div>

          <div className="build-pipeline-meta">
            <span>
              commit <b>{data?.headShaShort || '—'}</b>
            </span>
            {data?.deployedShaShort && (
              <span>
                online <b>{data.deployedShaShort}</b>
              </span>
            )}
            {data?.url && (
              <a href={data.url} target="_blank" rel="noreferrer">
                GitHub Actions ↗
              </a>
            )}
          </div>
        </>
      )}
    </aside>
  )
}
