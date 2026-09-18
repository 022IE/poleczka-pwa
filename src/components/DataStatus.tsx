import { useEffect, useState } from 'react'

type DataStatusState = 'checking' | 'online' | 'offline'

type HealthResponse = {
  ok?: boolean
  database?: boolean
  dbReachable?: boolean
}

function formatCheckTime(date: Date) {
  return new Intl.DateTimeFormat('pl-PL', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export default function DataStatus() {
  const [state, setState] = useState<DataStatusState>('checking')
  const [checkedAt, setCheckedAt] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function checkD1() {
      try {
        const response = await fetch('/api/health', { cache: 'no-store' })
        if (!response.ok) throw new Error('Health check failed')
        const payload = await response.json() as HealthResponse

        if (active) {
          setState(payload.ok === true && payload.database === true && payload.dbReachable === true ? 'online' : 'offline')
        }
      } catch {
        if (active) setState('offline')
      } finally {
        if (active) setCheckedAt(formatCheckTime(new Date()))
      }
    }

    void checkD1()
    const interval = window.setInterval(() => void checkD1(), 60_000)

    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [])

  const title = state === 'checking' ? 'Sprawdzanie D1' : state === 'online' ? 'D1 online' : 'D1 offline'
  const detail = state === 'checking'
    ? 'Łączenie…'
    : checkedAt
      ? `Sprawdzono ${checkedAt}`
      : 'Brak potwierdzenia'

  return (
    <div className={`sync-pill data-status-pill is-${state}`} title="Status połączenia aplikacji z bazą D1">
      <b aria-hidden="true">▤</b>
      <div><strong>{title}</strong><small>{detail}</small></div>
      <i aria-hidden="true" />
    </div>
  )
}
