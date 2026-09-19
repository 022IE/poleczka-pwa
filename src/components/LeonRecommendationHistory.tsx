import { useEffect, useMemo, useState } from 'react'
import type { LeonDecision, LeonRecommendation } from './LeonRecommendations'

type HistoryDay = {
  date: string
  generatedAt: string
  personalNote: { id: number; text: string } | null
  items: LeonRecommendation[]
}

type HistoryResponse = {
  ok: boolean
  today: string
  days: number
  items: HistoryDay[]
  error?: string
}

function formatHistoryDate(value: string) {
  const date = new Date(`${value}T12:00:00Z`)
  return new Intl.DateTimeFormat('pl-PL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

function decisionLabel(decision: LeonDecision) {
  if (decision === 'do') return 'Zrób'
  if (decision === 'defer') return 'Odłóż'
  return 'Odrzuć'
}

export default function LeonRecommendationHistory() {
  const [data, setData] = useState<HistoryResponse | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()

    fetch('/api/analysis/recommendations/history?days=30', {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = await response.json() as HistoryResponse
        if (!response.ok || !payload.ok) throw new Error(payload.error || 'Nie udało się pobrać historii')
        return payload
      })
      .then(setData)
      .catch((reason) => {
        if (reason instanceof DOMException && reason.name === 'AbortError') return
        setError(reason instanceof Error ? reason.message : 'Nie udało się pobrać historii')
      })

    return () => controller.abort()
  }, [])

  const historyDays = useMemo(
    () => data?.items.filter((day) => day.date !== data.today) || [],
    [data],
  )

  return (
    <section className="leon-history">
      <div className="leon-history-head">
        <div>
          <span>HISTORIA LEONA</span>
          <h2>Poprzednie rekomendacje</h2>
        </div>
        <small>Ostatnie 30 dni</small>
      </div>

      {error && <div className="leon-recommendations-state is-error">{error}</div>}
      {!error && !data && <div className="leon-recommendations-state">Wczytuję historię…</div>}
      {!error && data && historyDays.length === 0 && (
        <div className="leon-recommendations-state">Historia zacznie się zapełniać od kolejnych dni Leona.</div>
      )}

      {!error && historyDays.length > 0 && (
        <div className="leon-history-list">
          {historyDays.map((day) => (
            <details className="leon-history-day" key={day.date}>
              <summary>
                <div>
                  <b>{formatHistoryDate(day.date)}</b>
                  {day.personalNote?.text && <span>{day.personalNote.text}</span>}
                </div>
                <em>{day.items.length} {day.items.length === 1 ? 'rekomendacja' : 'rekomendacje'}</em>
              </summary>

              <div className="leon-history-items">
                {day.items.map((item, index) => (
                  <article key={item.id} className="leon-history-item">
                    <div className="leon-history-item-title">
                      <span>{index + 1}</span>
                      <b>{item.title}</b>
                      <em>{item.badge}</em>
                    </div>
                    <p>{item.summary}</p>
                    <div><strong>Dlaczego:</strong> {item.reason}</div>
                    <div><strong>Co robić:</strong> {item.action}</div>
                    {item.decision && (
                      <div className={`leon-history-decision is-${item.decision}`}>
                        <strong>Decyzja:</strong> {decisionLabel(item.decision)}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </details>
          ))}
        </div>
      )}
    </section>
  )
}
