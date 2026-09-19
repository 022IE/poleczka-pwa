import { useEffect, useRef, useState } from 'react'

type AnomalySeverity = 'warning' | 'critical'
type AnomalyReaction = 'important' | 'ignore'

type AnomalyItem = {
  alertId: string | null
  id: string
  severity: AnomalySeverity
  category: string
  title: string
  summary: string
  detail: string
  source: string
  firstDetectedAt: string | null
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

type ReactionResponse = {
  ok: boolean
  alertId: string
  reaction?: AnomalyReaction
  state?: string
  reactedAt?: string
  alreadyHandled?: boolean
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
  const [savingId, setSavingId] = useState<string | null>(null)
  const knownAlertIds = useRef<Set<string>>(new Set())
  const initialized = useRef(false)

  async function loadRadar(active = true) {
    try {
      const response = await fetch('/api/analysis/anomalies', { cache: 'no-store' })
      const payload = await response.json() as AnomalyResponse
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'Radar anomalii nie odpowiada')

      if (!active) return

      const ids = new Set(payload.items.map((item) => item.alertId).filter((id): id is string => Boolean(id)))
      const hasNewAlert = payload.items.length > 0 && (
        !initialized.current
        || [...ids].some((id) => !knownAlertIds.current.has(id))
      )

      knownAlertIds.current = ids
      initialized.current = true
      setData(payload)
      setError('')

      if (hasNewAlert) setOpen(true)
      if (payload.items.length === 0) setOpen(false)
    } catch (reason) {
      if (!active) return
      setError(reason instanceof Error ? reason.message : 'Radar anomalii nie odpowiada')
    }
  }

  useEffect(() => {
    let active = true
    void loadRadar(active)
    const interval = window.setInterval(() => void loadRadar(active), 60_000)
    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [])

  const reactToAlert = async (item: AnomalyItem, reaction: AnomalyReaction) => {
    if (!item.alertId || savingId) return

    setSavingId(item.alertId)
    try {
      const response = await fetch(`/api/analysis/anomalies/${encodeURIComponent(item.alertId)}/reaction`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reaction }),
      })
      const payload = await response.json() as ReactionResponse
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'Nie udało się zapisać reakcji')

      setData((current) => {
        if (!current) return current
        const items = current.items.filter((entry) => entry.alertId !== item.alertId)
        return {
          ...current,
          items,
          count: items.length,
          criticalCount: items.filter((entry) => entry.severity === 'critical').length,
          state: items.length > 0 ? 'alert' : 'ok',
        }
      })

      knownAlertIds.current.delete(item.alertId)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Nie udało się zapisać reakcji')
    } finally {
      setSavingId(null)
    }
  }

  const hasAlert = Boolean(data?.count)
  const stateClass = error ? 'is-unknown' : hasAlert ? 'is-alert' : 'is-ok'
  const ariaLabel = error
    ? 'Radar anomalii: brak danych'
    : hasAlert
      ? `Radar anomalii: ${data?.count} aktywnych alarmów`
      : 'Radar anomalii: brak aktywnych alarmów'

  return (
    <div className="anomaly-radar">
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
        <div className="anomaly-radar-modal-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setOpen(false)
        }}>
          <section className="anomaly-radar-panel" role="dialog" aria-modal="true" aria-label="Aktywne alarmy">
            <div className="anomaly-radar-panel-head">
              <div>
                <span>RADAR ANOMALII</span>
                <strong>{error ? 'Brak danych' : hasAlert ? 'Aktywne alarmy' : 'Wszystko spokojnie'}</strong>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Zamknij radar">×</button>
            </div>

            {error && <p className="anomaly-radar-empty is-error">{error}</p>}

            {!error && !hasAlert && (
              <div className="anomaly-radar-empty">
                <b>✓ Brak aktywnych alarmów</b>
                <span>Nie ma teraz niczego, co wymaga potwierdzenia.</span>
              </div>
            )}

            {!error && hasAlert && (
              <>
                <p className="anomaly-radar-intro">Potwierdź każdy alarm. Reakcja zostanie zapisana w historii D1.</p>
                <div className="anomaly-radar-list">
                  {data?.items.map((item) => (
                    <article className={`anomaly-radar-item is-${item.severity}`} key={item.alertId || item.id}>
                      <div className="anomaly-radar-item-head">
                        <em>{item.category}</em>
                        {item.source === 'test' && <span>TEST</span>}
                        <b>{item.title}</b>
                      </div>
                      <p>{item.summary}</p>
                      <small>{item.detail}</small>
                      {item.alertId ? (
                        <div className="anomaly-radar-actions">
                          <button
                            type="button"
                            className="is-important"
                            disabled={savingId === item.alertId}
                            onClick={() => void reactToAlert(item, 'important')}
                          >
                            OK, to ważne
                          </button>
                          <button
                            type="button"
                            className="is-ignore"
                            disabled={savingId === item.alertId}
                            onClick={() => void reactToAlert(item, 'ignore')}
                          >
                            Zignoruj
                          </button>
                        </div>
                      ) : (
                        <div className="anomaly-radar-pending">Historia alarmów jest jeszcze wdrażana.</div>
                      )}
                    </article>
                  ))}
                </div>
              </>
            )}

            {data?.generatedAt && !error && (
              <small className="anomaly-radar-time">
                Sprawdzono {new Intl.DateTimeFormat('pl-PL', { hour: '2-digit', minute: '2-digit' }).format(new Date(data.generatedAt))}
              </small>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
