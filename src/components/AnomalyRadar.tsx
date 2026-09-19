import { useEffect, useRef, useState } from 'react'

type AnomalySeverity = 'warning' | 'critical'

type AnomalyItem = {
  id: string
  severity: AnomalySeverity
  category: string
  title: string
  summary: string
  detail: string
}

type AnomalyResponse = {
  ok: boolean
  state: 'ok' | 'alert'
  count: number
  criticalCount: number
  generatedAt: string
  items: AnomalyItem[]
  error?: string
}

function RadarGlyph() {
  return (
    <svg className="anomaly-radar-glyph" viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="24" r="17" />
      <circle cx="24" cy="24" r="10" />
      <circle cx="24" cy="24" r="3" />
      <path d="M24 24 L38 14" />
      <path className="anomaly-radar-sweep" d="M24 24 L40 24 A16 16 0 0 0 35.3 12.7 Z" />
    </svg>
  )
}

export default function AnomalyRadar() {
  const [data, setData] = useState<AnomalyResponse | null>(null)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let active = true

    async function loadRadar() {
      try {
        const response = await fetch('/api/analysis/anomalies', { cache: 'no-store' })
        const payload = await response.json() as AnomalyResponse
        if (!response.ok || !payload.ok) throw new Error(payload.error || 'Radar anomalii nie odpowiada')
        if (active) {
          setData(payload)
          setError('')
        }
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : 'Radar anomalii nie odpowiada')
      }
    }

    void loadRadar()
    const interval = window.setInterval(() => void loadRadar(), 60_000)
    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    function closeOnOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false)
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', closeOnOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOnOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [])

  const hasAlert = Boolean(data?.count)
  const stateClass = error ? 'is-unknown' : hasAlert ? 'is-alert' : 'is-ok'
  const ariaLabel = error
    ? 'Radar anomalii: brak danych'
    : hasAlert
      ? `Radar anomalii: ${data?.count} ostrzeżeń`
      : 'Radar anomalii: brak ostrzeżeń'

  return (
    <div className="anomaly-radar" ref={rootRef}>
      <button
        type="button"
        className={`anomaly-radar-button ${stateClass}`}
        aria-label={ariaLabel}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <RadarGlyph />
        {hasAlert && <span className="anomaly-radar-count">{data?.count}</span>}
      </button>

      {open && (
        <div className="anomaly-radar-panel" role="dialog" aria-label="Radar anomalii">
          <div className="anomaly-radar-panel-head">
            <div>
              <span>RADAR ANOMALII</span>
              <strong>{error ? 'Brak danych' : hasAlert ? 'Wymaga uwagi' : 'Wszystko spokojnie'}</strong>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Zamknij radar">×</button>
          </div>

          {error && <p className="anomaly-radar-empty is-error">{error}</p>}

          {!error && !hasAlert && (
            <div className="anomaly-radar-empty">
              <b>✓ Brak wykrytych anomalii</b>
              <span>Sprzedaż, rabaty, dostawy i powiązania danych nie przekroczyły progów alarmowych.</span>
            </div>
          )}

          {!error && hasAlert && (
            <div className="anomaly-radar-list">
              {data?.items.map((item) => (
                <article className={`anomaly-radar-item is-${item.severity}`} key={item.id}>
                  <div>
                    <em>{item.category}</em>
                    <b>{item.title}</b>
                  </div>
                  <p>{item.summary}</p>
                  <small>{item.detail}</small>
                </article>
              ))}
            </div>
          )}

          {data?.generatedAt && !error && (
            <small className="anomaly-radar-time">
              Sprawdzono {new Intl.DateTimeFormat('pl-PL', { hour: '2-digit', minute: '2-digit' }).format(new Date(data.generatedAt))}
            </small>
          )}
        </div>
      )}
    </div>
  )
}
