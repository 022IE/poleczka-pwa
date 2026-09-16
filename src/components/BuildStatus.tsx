import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type StageState = 'waiting' | 'running' | 'ready' | 'failed' | 'blocked' | 'unknown'
type StageKey = 'work' | 'github' | 'build' | 'cloudflare' | 'online'
type ConnectionState = 'connecting' | 'live' | 'fallback' | 'offline'

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
  runNumber?: number | null
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

const defaults: Record<StageKey, PipelineStage> = {
  work: { state: 'waiting', label: 'Brak aktywnych prac' },
  github: { state: 'waiting', label: 'Czeka na zmianę' },
  build: { state: 'waiting', label: 'Oczekuje' },
  cloudflare: { state: 'waiting', label: 'Oczekuje' },
  online: { state: 'unknown', label: 'Niepotwierdzone' },
}

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

function connectionLabel(state: ConnectionState) {
  if (state === 'live') return 'LIVE'
  if (state === 'connecting') return 'ŁĄCZENIE'
  if (state === 'fallback') return 'AWARYJNY'
  return 'BRAK POŁ.'
}

export default function BuildStatus() {
  const [data, setData] = useState<BuildStatusResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [connection, setConnection] = useState<ConnectionState>('connecting')
  const [lastError, setLastError] = useState<string | null>(null)
  const reconnectAttempt = useRef(0)
  const branch = 'dev'

  const loadSnapshot = useCallback(async () => {
    try {
      const response = await fetch(`/api/build-status?branch=${encodeURIComponent(branch)}&_=${Date.now()}`, {
        cache: 'no-store',
      })
      const payload = (await response.json()) as BuildStatusResponse
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'Status pipeline jest niedostępny')
      setData(payload)
      setLastError(null)
      return true
    } catch (error) {
      setLastError(error instanceof Error ? error.message : 'Nie udało się pobrać statusu')
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let stopped = false
    let socket: WebSocket | null = null
    let reconnectTimer: number | null = null
    let fallbackTimer: number | null = null
    let heartbeatTimer: number | null = null

    const clearHeartbeat = () => {
      if (heartbeatTimer !== null) {
        window.clearInterval(heartbeatTimer)
        heartbeatTimer = null
      }
    }

    const stopFallback = () => {
      if (fallbackTimer !== null) {
        window.clearInterval(fallbackTimer)
        fallbackTimer = null
      }
    }

    const startFallback = () => {
      if (fallbackTimer !== null) return
      setConnection('fallback')
      void loadSnapshot()
      fallbackTimer = window.setInterval(() => void loadSnapshot(), 30000)
    }

    const connect = () => {
      if (stopped) return
      setConnection(reconnectAttempt.current === 0 ? 'connecting' : 'fallback')
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      socket = new WebSocket(`${protocol}//${window.location.host}/api/pipeline/ws`)

      socket.onopen = () => {
        if (stopped) return
        reconnectAttempt.current = 0
        setConnection('live')
        setLastError(null)
        stopFallback()
        clearHeartbeat()

        // WebSocket jest kanałem push, ale po każdym zestawieniu połączenia pobieramy
        // jeden autorytatywny snapshot. Naprawia to sytuację, gdy wcześniejszy event
        // został utracony albo Durable Object pamiętał starszy build.
        void loadSnapshot()

        heartbeatTimer = window.setInterval(() => {
          if (socket?.readyState === WebSocket.OPEN) socket.send('ping')
        }, 25000)
      }

      socket.onmessage = (event) => {
        if (String(event.data) === 'pong') return
        try {
          const payload = JSON.parse(String(event.data)) as BuildStatusResponse
          if (payload?.ok) {
            setData(payload)
            setLoading(false)
            setLastError(null)
          }
        } catch {
          setLastError('Odebrano nieprawidłowy komunikat statusu')
        }
      }

      socket.onclose = () => {
        if (stopped) return
        clearHeartbeat()
        startFallback()
        reconnectAttempt.current += 1
        const delay = Math.min(15000, 2000 * reconnectAttempt.current)
        reconnectTimer = window.setTimeout(connect, delay)
      }

      socket.onerror = () => {
        setLastError('Utracono połączenie LIVE — używam trybu awaryjnego')
        socket?.close()
      }
    }

    void loadSnapshot()
    connect()

    return () => {
      stopped = true
      clearHeartbeat()
      stopFallback()
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer)
      socket?.close()
    }
  }, [loadSnapshot])

  const stages = useMemo<Record<StageKey, PipelineStage>>(() => {
    const normalized: Record<StageKey, PipelineStage> = {
      work: data?.stages?.work || defaults.work,
      github: data?.stages?.github || defaults.github,
      build: data?.stages?.build || defaults.build,
      cloudflare: data?.stages?.cloudflare || defaults.cloudflare,
      online: data?.stages?.online || (data?.deployedSha ? { state: 'ready', label: 'Poprzednia wersja online' } : defaults.online),
    }

    // Commit jest granicą etapu „Prace”. Jeśli GitHub już przyjął zmianę lub build
    // wystartował, stary event „editing” nie może dalej kręcić pierwszego kafelka.
    const commitAlreadySent = normalized.github.state === 'ready'
      || normalized.build.state === 'running'
      || normalized.build.state === 'ready'
      || normalized.build.state === 'failed'
      || normalized.cloudflare.state === 'running'
      || normalized.cloudflare.state === 'ready'
      || normalized.cloudflare.state === 'failed'
      || normalized.cloudflare.state === 'blocked'

    if (commitAlreadySent && normalized.work.state === 'running') {
      normalized.work = { state: 'ready', label: 'Poprawki przekazane' }
    }

    // „Online” ma oznaczać najnowszą wersję, nie fakt że poprzednia wersja nadal działa.
    if (!data?.latestOnline && commitAlreadySent) {
      normalized.online = { state: 'waiting', label: 'Czeka na nową wersję' }
    }

    return normalized
  }, [data])

  const pipelineState: StageState = loading && !data
    ? 'running'
    : stages.work.state === 'running'
      ? 'running'
      : stages.build.state === 'failed' || stages.cloudflare.state === 'failed' || stages.cloudflare.state === 'blocked'
        ? 'failed'
        : data?.latestOnline
          ? 'ready'
          : stages.build.state === 'running' || stages.cloudflare.state === 'running'
            ? 'running'
            : 'waiting'

  const headline = loading && !data
    ? 'Sprawdzam status publikacji…'
    : stages.work.state === 'running'
      ? data?.work?.label || 'Wprowadzanie poprawek'
      : pipelineState === 'ready'
        ? 'Najnowsza wersja jest online'
        : pipelineState === 'failed'
          ? 'Publikacja wymaga uwagi'
          : pipelineState === 'running'
            ? 'Publikacja trwa…'
            : !data?.ok && lastError
              ? 'Status chwilowo niedostępny'
              : 'Oczekiwanie na publikację'

  const task = stages.work.state === 'running' ? data?.work?.task : null
  const meta = task || `${data?.branch || branch}${data?.runNumber ? ` • build #${data.runNumber}` : ''}${data?.headShaShort ? ` • ${data.headShaShort}` : ''}`

  return (
    <aside className={`build-pipeline is-${pipelineState}`} aria-live="polite">
      <div className="build-pipeline-head">
        <span className="build-pipeline-main-dot" aria-hidden="true" />
        <span className="build-pipeline-title">
          <strong>{headline}</strong>
          <small title={meta}>{meta}</small>
        </span>
        <span
          className={`build-pipeline-live is-${connection}`}
          title={lastError || (connection === 'live' ? 'Aktualizacje natychmiast przez WebSocket' : 'Ponawiam połączenie z kanałem LIVE')}
        >
          {connectionLabel(connection)}
        </span>
        <button
          type="button"
          className="build-pipeline-refresh"
          onClick={() => {
            setLoading(true)
            void loadSnapshot()
          }}
          aria-label="Odśwież status publikacji"
          title="Odśwież status"
        >
          ↻
        </button>
      </div>

      <div className="build-pipeline-flow">
        {stageOrder.map((key, index) => {
          const stage = stages[key]
          return (
            <div className="build-pipeline-stage-wrap" key={key}>
              <div className={`build-pipeline-stage is-${stage.state}`} title={`${stageNames[key]} — ${stage.label || 'Brak statusu'}`}>
                <span className="build-pipeline-stage-icon" aria-hidden="true">{iconFor(stage.state)}</span>
                <span>
                  <b>{stageNames[key]}</b>
                  <small>{stage.label || 'Brak statusu'}</small>
                </span>
              </div>
              {index < stageOrder.length - 1 && <span className="build-pipeline-arrow" aria-hidden="true">→</span>}
            </div>
          )
        })}
      </div>

      {lastError && connection !== 'live' && (
        <div className="build-pipeline-warning">{lastError}</div>
      )}
    </aside>
  )
}
