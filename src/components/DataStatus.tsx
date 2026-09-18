import { useEffect, useMemo, useState } from 'react'

type IntegrationState = 'checking' | 'online' | 'warning' | 'offline'

type ServiceState = 'online' | 'warning' | 'offline' | 'unknown'

type IntegrationService = {
  id: string
  label: string
  state: ServiceState
  detail: string
}

type IntegrationResponse = {
  ok?: boolean
  state?: Exclude<IntegrationState, 'checking'>
  checkedAt?: string
  services?: IntegrationService[]
}

function formatCheckTime(value: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return '—'
  return new Intl.DateTimeFormat('pl-PL', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export default function DataStatus() {
  const [state, setState] = useState<IntegrationState>('checking')
  const [checkedAt, setCheckedAt] = useState<string | null>(null)
  const [services, setServices] = useState<IntegrationService[]>([])

  useEffect(() => {
    let active = true

    async function checkIntegrations() {
      try {
        const response = await fetch('/api/integration-status', { cache: 'no-store' })
        if (!response.ok) throw new Error('Integration status failed')
        const payload = await response.json() as IntegrationResponse

        if (active) {
          setState(payload.state || 'warning')
          setCheckedAt(payload.checkedAt || new Date().toISOString())
          setServices(payload.services || [])
        }
      } catch {
        if (active) {
          setState('offline')
          setCheckedAt(new Date().toISOString())
          setServices([])
        }
      }
    }

    void checkIntegrations()
    const interval = window.setInterval(() => void checkIntegrations(), 60_000)

    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [])

  const summary = useMemo(() => {
    if (state === 'checking') return 'Sprawdzanie…'
    if (!services.length) return 'Brak odpowiedzi'
    const online = services.filter((service) => service.state === 'online').length
    return online === services.length ? 'Wszystko działa' : `${online}/${services.length} aktywne`
  }, [services, state])

  return (
    <div className={`sync-pill integration-status-pill is-${state}`} title="Bieżący stan integracji i usług online">
      <b aria-hidden="true">⌁</b>
      <div className="integration-status-copy">
        <strong>Status integracji</strong>
        <small>{summary} · {formatCheckTime(checkedAt)}</small>
        {services.length > 0 && (
          <span className="integration-status-services" aria-label="Szczegóły statusu integracji">
            {services.map((service) => (
              <span
                key={service.id}
                className={`integration-service is-${service.state}`}
                title={`${service.label}: ${service.detail}`}
              >
                <em aria-hidden="true" />
                {service.label}
              </span>
            ))}
          </span>
        )}
      </div>
      <i className="integration-status-main-dot" aria-hidden="true" />
    </div>
  )
}
