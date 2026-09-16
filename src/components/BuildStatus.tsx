import { useCallback, useEffect, useState } from 'react'

type BuildStatusResponse = {
  ok: boolean
  state?: 'building' | 'ready' | 'failed' | 'unknown'
  status?: string | null
  conclusion?: string | null
  branch?: string
  runNumber?: number
  updatedAt?: string | null
  url?: string | null
  error?: string
}

const labels = {
  loading: 'Sprawdzanie…',
  building: 'Build trwa…',
  ready: 'Build gotowy',
  failed: 'Build nieudany',
  unknown: 'Status nieznany',
  unavailable: 'Status niedostępny',
} as const

export default function BuildStatus() {
  const [data, setData] = useState<BuildStatusResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const branch = import.meta.env.VITE_BUILD_BRANCH || 'dev'

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
  }, [branch])

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => void load(), 15000)
    return () => window.clearInterval(timer)
  }, [load])

  const state = loading ? 'loading' : data?.ok ? data.state || 'unknown' : 'unavailable'
  const updated = data?.updatedAt
    ? new Intl.DateTimeFormat('pl-PL', { hour: '2-digit', minute: '2-digit' }).format(new Date(data.updatedAt))
    : null

  const body = (
    <>
      <span className="build-status-dot" aria-hidden="true" />
      <span className="build-status-copy">
        <strong>{labels[state]}</strong>
        <small>
          {data?.runNumber ? `${data.branch || branch} • #${data.runNumber}` : branch}
          {updated ? ` • ${updated}` : ''}
        </small>
      </span>
      <button
        type="button"
        className="build-status-refresh"
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          setLoading(true)
          void load()
        }}
        aria-label="Odśwież status builda"
        title="Odśwież"
      >
        ↻
      </button>
    </>
  )

  if (data?.url) {
    return (
      <a
        className={`build-status-widget is-${state}`}
        href={data.url}
        target="_blank"
        rel="noreferrer"
        title="Otwórz build w GitHub Actions"
      >
        {body}
      </a>
    )
  }

  return <div className={`build-status-widget is-${state}`}>{body}</div>
}
