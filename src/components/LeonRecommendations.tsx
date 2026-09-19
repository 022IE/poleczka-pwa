import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'

export type LeonRecommendation = {
  id: string
  tone: 'positive' | 'warning' | 'neutral'
  badge: string
  title: string
  summary: string
  reason: string
  action: string
  priority: number
}

type RecommendationsResponse = {
  ok: boolean
  generatedAt: string
  period: {
    currentStart: string
    currentEnd: string
    previousStart: string
    previousEnd: string
  }
  items: LeonRecommendation[]
  error?: string
}

function RecommendationBody({ item, index, compact }: { item: LeonRecommendation; index: number; compact: boolean }) {
  return (
    <article className={`leon-advice leon-advice-${item.tone}`}>
      <span className="leon-advice-number">{index + 1}</span>
      <div className="leon-advice-copy">
        <div className="leon-advice-title-row">
          <b>{item.title}</b>
          <em>{item.badge}</em>
        </div>
        <p>{item.summary}</p>
        {!compact && (
          <>
            <div className="leon-advice-detail"><span>Dlaczego</span><strong>{item.reason}</strong></div>
            <div className="leon-advice-action"><span>Co robić</span><strong>{item.action}</strong></div>
          </>
        )}
      </div>
    </article>
  )
}

export default function LeonRecommendations({ compact = false }: { compact?: boolean }) {
  const [data, setData] = useState<RecommendationsResponse | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    setError('')

    fetch('/api/analysis/recommendations', { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json() as RecommendationsResponse
        if (!response.ok || !payload.ok) throw new Error(payload.error || 'Nie udało się policzyć rekomendacji')
        return payload
      })
      .then(setData)
      .catch((reason) => {
        if (reason instanceof DOMException && reason.name === 'AbortError') return
        setError(reason instanceof Error ? reason.message : 'Nie udało się policzyć rekomendacji')
      })

    return () => controller.abort()
  }, [])

  const content = (
    <>
      <div className="leon-recommendations-head">
        <div>
          <span>CODZIENNE REKOMENDACJE</span>
          <h2>Leon mówi…</h2>
        </div>
        {compact
          ? <strong>Przejdź do analiz <span aria-hidden="true">→</span></strong>
          : <small>{data?.generatedAt ? `Dane przeliczone: ${new Intl.DateTimeFormat('pl-PL', { hour: '2-digit', minute: '2-digit' }).format(new Date(data.generatedAt))}` : 'Rekomendacje liczone z D1'}</small>}
      </div>

      {error && <div className="leon-recommendations-state is-error">Leon nie może teraz odczytać danych: {error}</div>}
      {!error && !data && <div className="leon-recommendations-state">Leon patrzy na dane…</div>}
      {!error && data && (
        <div className={compact ? 'leon-advice-grid' : 'leon-advice-list'}>
          {data.items.slice(0, 3).map((item, index) => (
            <RecommendationBody key={item.id} item={item} index={index} compact={compact} />
          ))}
        </div>
      )}
    </>
  )

  if (compact) {
    return (
      <NavLink to="/analizy" className="leon-recommendations leon-recommendations-compact" aria-label="Otwórz rekomendacje w module Analizy">
        {content}
      </NavLink>
    )
  }

  return <section className="leon-recommendations leon-recommendations-full">{content}</section>
}
