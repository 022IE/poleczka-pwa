import { useCallback, useEffect, useMemo, useState } from 'react'

type StageState = 'waiting' | 'running' | 'ready' | 'failed' | 'blocked' | 'unknown'
type StageKey = 'work' | 'github' | 'build' | 'cloudflare' | 'online'

type PipelineStage = {
  state: StageState
  label?: string
}

type WorkStatus = {
  state?: 'editing' | 'awaiting_publish' | 'idle' | 'unknown'
  label?: string
  task?: string
  updatedAt?: string | null
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
  work?: WorkStatus | null
  stages?: Partial<Record<StageKey, PipelineStage>>
  error?: string
}

const fallbackStage: PipelineStage = { state: 'unknown', label: 'Status nieznany' }

const stageNames: Record<StageKey, string> = {
  work: 'Prace',
  github: 'GitHub',
  build: 'Build',
  cloudflare: 'Cloudflare',
  online: 'Online',
}

const stageOrder: StageKey[] = ['work', 'github', 'build', 'cloudflare', 'online']

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
  const [live, setLive] = useState(false)
  const branch = 'dev'

  const loadSnapshot = useCallback(async () => {
    try {
      const response = await fetch(`/api/build-status?branch=${encodeURIComponent(branch)}`, {
        cache: 'no-store',
      })
      const payload = (await response.json()) as BuildStatusResponse
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'Pipeline status unavailable')
      setData(payload)
    } catch {
      setData((current) => current || { ok: false, state: 'unknown' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let stopped = false
    let socket: WebSocket | null = null
    let reconnectTimer: number | null = null
    let fallbackTimer: number | null = null

    const stopFallback = () => {
      if (fallbackTimer !== null) {
        window.clearInterval(fallbackTimer)
        fallbackTimer = null
      }
    }

    const startFallback = () => {
      if (fallbackTimer !== null) return
      fallbackTimer = window.setInterval(() => void loadSnapshot(), 120000)
    }

    const connect = () => {
      if (stopped) return
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      socket = new WebSocket(`${protocol}//${window.location.host}/api/pipeline/ws`)

      socket.onopen = () => {
        if (stopped) return
        setLive(true)
        stopFallback()
      }

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(String(event.data)) as BuildStatusResponse
          if (payload?.ok) {
            setData(payload)
            setLoading(false)
          }
        } catch {
          // Ignorujemy pojedynczą uszkodzoną wiadomość i utrzymujemy połączenie.
        }
      }

      socket.onclose = () => {
        if (stopped) return
        setLive(false)
        startFallback()
        reconnectTimer = window.setTimeout(connect, 3000)
      }

      socket.onerror = () => socket?.close()
    }

    void loadSnapshot()
    connect()

    return () => {
      stopped = true
      setLive(false)
      stopFallback()
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer)
      socket?.close()
    }
  }, [loadSnapshot])

  const stages = useMemo<Record<StageKey, PipelineStage>>(() => {
    if (!data?.ok) {
      return {
        work: fallbackStage,
        github: fallbackStage,
        build: fallbackStage,
        cloudflare: fallbackStage,
        online: fallbackStage,
      }
    }

    return {
      work: data.stages?.work || fallbackStage,
      github: data.stages?.github || fallbackStage,
      build: data.stages?.build || fallbackStage,
      cloudflare: data.stages?.cloudflare || fallbackStage,
      online: data.stages?.online || fallbackStage,
    }
  }, [data])

  const pipelineState: StageState = loading
    ? 'running'
    : !data?.ok
      ? 'unknown'
      : stages.work.state === 'running'
        ? 'running'
        : stages.build.state === 'failed' || stages.cloudflare.state === 'failed' || stages.cloudflare.state === 'blocked'
          ? 'failed'
          : data.latestOnline
            ? 'ready'
            : stages.build.state === 'running' || stages.cloudflare.state === 'running'
              ? 'running'
              : 'waiting'

  const headline = loading
    ? 'Sprawdzam publikację…'
    : stages.work.state === 'running'
      ? data?.work?.label || 'Wprowadzanie poprawek'
      : pipelineState === 'ready'
        ? 'Najnowsza wersja jest online'
        : pipelineState === 'failed'
          ? 'Publikacja wymaga uwagi'
          : pipelineState === 'running'
            ? 'Publikacja trwa…'
            : 'Oczekiwanie na publikację'

  const task = stages.work.state === 'running' ? data?.work?.task : null

  return (
    <aside className={`build-pipeline is-${pipelineState}`} aria-live="polite">
      <div className="build-pipeline-head">
        <span className="build-pipeline-main-dot" aria-hidden="true" />
        <span className="build-pipeline-title">
          <strong>{headline}</strong>
          <small title={task || undefined}>
            {task || `${data?.branch || branch}${data?.runNumber ? ` • build #${data.runNumber}` : ''}`}
          </small>
        </span>
        <span className={`build-pipeline-live ${live ? 'is-live' : 'is-fallback'}`} title={live ? 'Aktualizacje przez WebSocket' : 'Tryb awaryjny'}>
          {live ? 'LIVE' : 'FALLBACK'}
        </span>
        <button
          type="button"
          className="build-pipeline-refresh"
          onClick={() => {
            setLoading(true)
            void loadSnapshot()
          }}
          aria-label="Odśwież status publikacji"
          title="Odśwież"
        >
          ↻
        </button>
      </div>

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
    </aside>
  )
}
