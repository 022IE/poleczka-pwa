import { useEffect, useState } from 'react'

const dateFormatter = new Intl.DateTimeFormat('pl-PL', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Europe/Warsaw',
})

const weekdayFormatter = new Intl.DateTimeFormat('pl-PL', {
  weekday: 'long',
  timeZone: 'Europe/Warsaw',
})

const timeFormatter = new Intl.DateTimeFormat('pl-PL', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
  timeZone: 'Europe/Warsaw',
})

export default function HeaderDateTime() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <div className="date-block">
      <span className="header-icon" aria-hidden="true">🗓️</span>
      <div className="date-copy">
        <b>{weekdayFormatter.format(now)}</b>
        <span>{dateFormatter.format(now)}</span>
        <time className="header-clock" dateTime={now.toISOString()}>{timeFormatter.format(now)}</time>
      </div>
    </div>
  )
}
