import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'

export type LeonDecision = 'do' | 'defer' | 'reject'

export type LeonRecommendation = {
  id: string
  tone: 'positive' | 'warning' | 'neutral'
  badge: string
  title: string
  summary: string
  reason: string
  action: string
  priority: number
  decision?: LeonDecision | null
  decisionAt?: string | null
}

type RecommendationsResponse = {
  ok: boolean
  forDate: string
  generatedAt: string
  period: {
    currentStart: string
    currentEnd: string
    previousStart: string
    previousEnd: string
  }
  personalNote: {
    id: number
    text: string
    date: string
  } | null
  items: LeonRecommendation[]
  error?: string
}

type DecisionResponse = {
  ok: boolean
  recommendationId: string
  decision: LeonDecision
  decisionAt: string
  error?: string
}

const DECISIONS: Array<{ value: LeonDecision; label: string }> = [
  { value: 'do', label: 'Zrób' },
  { value: 'defer', label: 'Odłóż' },
  { value: 'reject', label: 'Odrzuć' },
]

function RecommendationBody({
  item,
  index,
  compact,
  saving,
  decisionError,
  onDecision,
}: {
  item: LeonRecommendation
  index: number
  compact: boolean
  saving: boolean
  decisionError: string
  onDecision: (decision: LeonDecision) => void
}) {
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
            <div className="leon-decision-row">
              <span>Twoja decyzja</span>
              <div className="leon-decision-buttons" role="group" aria-label={`Decyzja dla: ${item.title}`}>
                {DECISIONS.map((option) => (
                  <button
                    type="button"
                    key={option.value}
                    className={`leon-decision-button is-${option.value}${item.decision === option.value ? ' is-active' : ''}`}
                    aria-pressed={item.decision === option.value}
                    disabled={saving}
                    onClick={() => onDecision(option.value)}
                  >
                    {saving && item.decision !== option.value ? option.label : option.label}
                  </button>
                ))}
              </div>
            </div>
            {decisionError && <div className="leon-decision-error">{decisionError}</div>}
          </>
        )}
      </div>
    </article>
  )
}

export default function LeonRecommendations({ compact = false }: { compact?: boolean }) {
  const [data, setData] = useState<RecommendationsResponse | null>(null)
  const [error, setError] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)
  const [decisionErrors, setDecisionErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    const controller = new AbortController()
    setError('')

    fetch('/api/analysis/recommendations', { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json() as RecommendationsResponse
        if (!response.ok || !payload.ok) throw new Error(payload.error || 'Nie udało się pobrać rekomendacji')
        return payload
      })
      .then(setData)
      .catch((reason) => {
        if (reason instanceof DOMException && reason.name === 'AbortError') return
        setError(reason instanceof Error ? reason.message : 'Nie udało się pobrać rekomendacji')
      })

    return () => controller.abort()
  }, [])

  const chooseDecision = async (item: LeonRecommendation, decision: LeonDecision) => {
    if (!data || savingId) return

    setSavingId(item.id)
    setDecisionErrors((current) => ({ ...current, [item.id]: '' }))

    try {
      const response = await fetch('/api/analysis/recommendations/decision', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          forDate: data.forDate,
          recommendationId: item.id,
          decision,
        }),
      })

      const payload = await response.json() as DecisionResponse
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'Nie udało się zapisać decyzji')

      setData((current) => current ? {
        ...current,
        items: current.items.map((entry) => entry.id === item.id
          ? { ...entry, decision: payload.decision, decisionAt: payload.decisionAt }
          : entry),
      } : current)
    } catch (reason) {
      setDecisionErrors((current) => ({
        ...current,
        [item.id]: reason instanceof Error ? reason.message : 'Nie udało się zapisać decyzji',
      }))
    } finally {
      setSavingId(null)
    }
  }

  const content = (
    <>
      <div className="leon-recommendations-head">
        <div>
          <h2>Leon mówi…</h2>
          {data?.personalNote?.text && <p className="leon-personal-note">{data.personalNote.text}</p>}
        </div>
        {!compact && <small>{data?.generatedAt ? `Dane przeliczone: ${new Intl.DateTimeFormat('pl-PL', { hour: '2-digit', minute: '2-digit' }).format(new Date(data.generatedAt))}` : 'Rekomendacje z D1'}</small>}
      </div>

      {error && <div className="leon-recommendations-state is-error">Leon nie może teraz odczytać danych: {error}</div>}
      {!error && !data && <div className="leon-recommendations-state">Leon patrzy na dane…</div>}
      {!error && data && (
        <div className={compact ? 'leon-advice-grid' : 'leon-advice-list'}>
          {data.items.slice(0, 3).map((item, index) => (
            <RecommendationBody
              key={item.id}
              item={item}
              index={index}
              compact={compact}
              saving={savingId === item.id}
              decisionError={decisionErrors[item.id] || ''}
              onDecision={(decision) => chooseDecision(item, decision)}
            />
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
