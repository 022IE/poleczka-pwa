import { useEffect, useMemo, useState } from 'react'
import { NavLink, Route, Routes } from 'react-router-dom'
import BuildStatus from './components/BuildStatus'
import DataStatus from './components/DataStatus'
import SalesPage from './SalesPage'

// Widget publikacji jest narzędziem developerskim. W wersji finalnej ustawiamy false.
const SHOW_DEV_PIPELINE = false

type ComparisonPeriod = 'week' | 'month' | 'year'

const nav = [
  ['/', 'Strona główna', '⌂'],
  ['/sprzedaz', 'Sprzedaż', '▢'],
  ['/vinted', 'Vinted', 'V'],
  ['/dostawy', 'Dostawy', '▣'],
  ['/artykuly', 'Artykuły', '♧'],
  ['/kategorie', 'Kategorie', '◇'],
  ['/koszty', 'Koszty', '◉'],
  ['/analizy', 'Analizy', '▥'],
  ['/synchronizacja', 'Synchronizacja', '↻'],
  ['/narzedzia', 'Narzędzia', '⌘'],
  ['/ustawienia', 'Ustawienia', '⚙'],
] as const

type DashboardData = {
  ok: boolean
  generatedAt: string
  quarter: {
    label: string
    start: string
    end: string
    used: number
    limit: number
    remaining: number
    percent: number
  }
  kpis: {
    todaySales: number
    todaySalesChange: number | null
    quarterSales: number
    quarterSalesChange: number | null
    estimatedProfit: number | null
    estimatedProfitChange: number | null
    profitMargin: number | null
    costCoverage: number
    todayUnits: number
    todayUnitsChange: number | null
    averageReceipt: number
    averageReceiptChange: number | null
    sellThrough: number | null
    sellThroughChange: number | null
    sellThroughAvailable: boolean
  }
  sales30: {
    days: Array<{ date: string; value: number }>
    total: number
    average: number
    bestDay: { date: string; value: number }
  }
  comparison: {
    type: ComparisonPeriod
    count: number
    end: string
    axis: string[]
    series: Array<{ label: string; values: number[] }>
  }
  categories: {
    total: number
    items: Array<{ name: string; value: number; percent: number }>
  }
  heatmap: {
    days: string[]
    hours: number[]
    averages: number[]
    levels: number[]
  }
}

const comparisonColors = ['#9eb89a', '#d1a84f', '#c98378', '#7f9d8a', '#46705a'] as const
const categoryColors = ['#557b68', '#9db699', '#d9bb78', '#cf918a', '#9895c6'] as const

const moneyFormatter = new Intl.NumberFormat('pl-PL', {
  style: 'currency',
  currency: 'PLN',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const numberFormatter = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 1 })

function formatMoney(value: number | null | undefined) {
  return value === null || value === undefined ? '—' : moneyFormatter.format(value)
}

function formatPercent(value: number | null | undefined) {
  return value === null || value === undefined ? '—' : `${numberFormatter.format(value)}%`
}

function formatTrend(value: number | null | undefined) {
  if (value === null || value === undefined) return '—'
  if (value === 0) return '→ 0%'
  return `${value > 0 ? '↑' : '↓'} ${numberFormatter.format(Math.abs(value))}%`
}

function trendClass(value: number | null | undefined) {
  if (value === null || value === undefined || value === 0) return 'neutral'
  return value > 0 ? 'positive' : 'negative'
}

function formatChartDay(value: string) {
  const date = new Date(`${value}T12:00:00Z`)
  return new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'short', timeZone: 'UTC' })
    .format(date)
    .replace('.', '')
}

function formatBestDay(value: string, amount: number) {
  const date = new Date(`${value}T12:00:00Z`)
  const label = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(date)
  return `${label} (${formatMoney(amount)})`
}

function comparisonPoints(values: number[], max: number) {
  if (!values.length) return ''
  const xStart = 15
  const xEnd = 465
  const yBottom = 68
  const yRange = 53
  const denominator = Math.max(1, values.length - 1)

  return values.map((value, index) => {
    const x = xStart + ((xEnd - xStart) * index / denominator)
    const y = max > 0 ? yBottom - ((Math.max(0, value) / max) * yRange) : yBottom
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
}

function categoryGradient(items: DashboardData['categories']['items']) {
  if (!items.length) return '#edf1ea'

  let cursor = 0
  const stops = items.map((item, index) => {
    const start = cursor
    cursor += item.percent
    return `${categoryColors[index % categoryColors.length]} ${start}% ${Math.min(100, cursor)}%`
  })
  if (cursor < 100) stops.push(`#edf1ea ${cursor}% 100%`)
  return `conic-gradient(${stops.join(',')})`
}

const quickLinks = [
  ['/sprzedaz','Sprzedaż','Dodaj i przeglądaj','🛒','mint'],
  ['/vinted','Vinted','Sprzedaż z Vinted','V','aqua'],
  ['/dostawy','Dostawy','Nowa dostawa','▣','blue'],
  ['/artykuly','Artykuły','Zarządzaj asortymentem','♧','mint'],
  ['/kategorie','Kategorie','Porządkuj produkty','◇','gold'],
  ['/koszty','Koszty','Dodaj wydatek','◉','blue'],
  ['/analizy','Analizy','Poznaj swoje wyniki','▥','lavender'],
  ['/synchronizacja','Synchronizacja','Przepływ danych i importy','↻','aqua'],
  ['/narzedzia','Narzędzia','Przydatne funkcje','⌘','gold'],
  ['/ustawienia','Ustawienia','Dostosuj aplikację','⚙','gray'],
] as const

function Placeholder({ title, text }: { title: string; text: string }) {
  return (
    <section className="page-card">
      <p className="eyebrow">Półeczka Iwonki</p>
      <h1>{title}</h1>
      <p>{text}</p>
    </section>
  )
}

function Dashboard() {
  const now = new Date()
  const weekday = new Intl.DateTimeFormat('pl-PL', { weekday: 'long' }).format(now)
  const date = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' }).format(now)
  const todayValue = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const [comparisonEndDate, setComparisonEndDate] = useState(todayValue)
  const [comparisonCount, setComparisonCount] = useState(4)
  const [comparisonType, setComparisonType] = useState<ComparisonPeriod>('week')
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [dashboardError, setDashboardError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    const params = new URLSearchParams({
      comparisonEnd: comparisonEndDate,
      comparisonCount: String(comparisonCount),
      comparisonType,
    })

    setDashboardError(null)

    fetch(`/api/dashboard?${params.toString()}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = await response.json() as DashboardData & { error?: string }
        if (!response.ok || !payload.ok) throw new Error(payload.error || 'Nie udało się pobrać danych dashboardu')
        return payload
      })
      .then((payload) => setDashboardData(payload))
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setDashboardError(error instanceof Error ? error.message : 'Nie udało się pobrać danych dashboardu')
      })

    return () => controller.abort()
  }, [comparisonEndDate, comparisonCount, comparisonType])

  const kpis = useMemo(() => {
    const data = dashboardData?.kpis
    const profitCaption = data?.estimatedProfit === null || data?.estimatedProfit === undefined
      ? 'brak wiarygodnych kosztów w D1'
      : `marża ${formatPercent(data.profitMargin)} • koszt ${formatPercent(data.costCoverage)} szt.`

    return [
      {
        label: 'Sprzedaż dziś',
        value: data ? formatMoney(data.todaySales) : '—',
        change: data?.todaySalesChange,
        caption: 'vs. wczoraj',
        icon: '🛒',
        tone: 'green',
      },
      {
        label: 'Sprzedaż w kwartale',
        value: data ? formatMoney(data.quarterSales) : '—',
        change: data?.quarterSalesChange,
        caption: 'vs. poprzedni kwartał',
        icon: '▥',
        tone: 'green',
      },
      {
        label: 'Szacowany zysk',
        value: data ? formatMoney(data.estimatedProfit) : '—',
        change: data?.estimatedProfitChange,
        caption: profitCaption,
        icon: '◉',
        tone: 'gold',
      },
      {
        label: 'Sprzedane sztuki',
        value: data ? numberFormatter.format(data.todayUnits) : '—',
        change: data?.todayUnitsChange,
        caption: 'vs. wczoraj',
        icon: '◇',
        tone: 'rose',
      },
      {
        label: 'Średni paragon',
        value: data ? formatMoney(data.averageReceipt) : '—',
        change: data?.averageReceiptChange,
        caption: 'ostatnie 7 dni vs. poprzednie 7',
        icon: '◇',
        tone: 'gold',
      },
      {
        label: '% zbytu',
        value: data?.sellThroughAvailable ? formatPercent(data.sellThrough) : '—',
        change: data?.sellThroughChange,
        caption: data?.sellThroughAvailable ? 'wg danych dostaw' : 'brak tabeli dostaw w D1',
        icon: '↗',
        tone: 'green',
      },
    ]
  }, [dashboardData])

  const salesDays = dashboardData?.sales30.days || []
  const maxSalesDay = Math.max(0, ...salesDays.map((item) => item.value))
  const salesAxisIndexes = salesDays.length
    ? Array.from(new Set([0, 7, 14, 21, salesDays.length - 1])).filter((index) => index >= 0 && index < salesDays.length)
    : []
  const yMax = maxSalesDay > 0 ? Math.ceil(maxSalesDay / 50) * 50 : 0
  const yLabels = [yMax, yMax * .75, yMax * .5, yMax * .25, 0]

  const comparisonSeries = dashboardData?.comparison.series || []
  const comparisonMax = Math.max(0, ...comparisonSeries.flatMap((series) => series.values))
  const comparisonAxis = dashboardData?.comparison.axis || []
  const categoryItems = dashboardData?.categories.items || []
  const heatDays = dashboardData?.heatmap.days || ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Niedz']
  const heatHours = dashboardData?.heatmap.hours || Array.from({ length: 14 }, (_, index) => index + 8)
  const heatLevels = dashboardData?.heatmap.levels || Array(98).fill(1)

  return (
    <div className="dashboard-wrap">
      <header className="dashboard-header">
        <div className="header-title-block">
          <span className="page-title-icon" aria-hidden="true">⌂</span>
          <div>
            <h1>Dzień dobry, Iwonko! <span>👋</span></h1>
            <p>Cieszę się, że tu jesteś. Dobry dzień na piękne rzeczy!</p>
          </div>
        </div>
        {SHOW_DEV_PIPELINE && <div className="header-build-slot"><BuildStatus /></div>}
        <div className="header-actions">
          <div className="date-block"><span className="header-icon">▣</span><div><b>{weekday}</b><span>{date}</span></div></div>
          <div className="header-divider" />
          <button className="bell" aria-label="Powiadomienia">♟</button>
          <DataStatus />
          <div className="avatar">I</div>
        </div>
      </header>

      {dashboardError && <div className="dashboard-data-note is-error">Dane z D1 są chwilowo niedostępne: {dashboardError}</div>}

      <section className="limit-card dashboard-summary-card">
        <div className="limit-dashboard-block">
          <div className="summary-title-row">
            <div>
              <span className="summary-eyebrow">Limit działalności nierejestrowanej</span>
              <strong>{dashboardData?.quarter.label || '—'}</strong>
            </div>
            <div className="limit-remaining"><span>Pozostało</span><b>{formatMoney(dashboardData?.quarter.remaining)}</b></div>
          </div>
          <div className="limit-value">Wykorzystano <b>{formatMoney(dashboardData?.quarter.used)}</b> z {formatMoney(dashboardData?.quarter.limit)}</div>
          <div className="progress-row">
            <div className="progress"><span style={{ width: `${Math.min(100, dashboardData?.quarter.percent || 0)}%` }} /></div>
            <b>{formatPercent(dashboardData?.quarter.percent)}</b>
          </div>
        </div>
        <div className="dashboard-summary-divider" />
        <div className="vinted-summary">
          <NavLink to="/vinted" className="vinted-summary-brand" aria-label="Przejdź do modułu Vinted">
            <img src="/assets/vinted-logo.png" alt="Vinted" />
            <div><strong>Vinted</strong><span>Podsumowanie aukcji</span></div>
          </NavLink>
          <div className="vinted-summary-stats">
            <div><span>Trwające aukcje</span><b>0</b></div>
            <div><span>Sprzedane — do wysyłki</span><b>0</b></div>
            <div><span>Sprzedane — zakończone</span><b>0</b></div>
            <div className="money"><span>Suma aktywnych aukcji</span><b>0,00 zł</b></div>
            <div className="money"><span>Suma sprzedanych</span><b>0,00 zł</b></div>
          </div>
        </div>
      </section>

      <section className="kpi-grid">
        {kpis.map((kpi) => (
          <article className="kpi-card" key={kpi.label}>
            <div className={`kpi-icon ${kpi.tone}`}>{kpi.icon}</div>
            <div className="kpi-copy">
              <span>{kpi.label}</span>
              <strong>{kpi.value}</strong>
              <b className={`kpi-trend ${trendClass(kpi.change)}`}>{formatTrend(kpi.change)}</b>
              <small>{kpi.caption}</small>
            </div>
          </article>
        ))}
      </section>

      <section className="charts-row primary">
        <article className="panel sales-panel">
          <div className="panel-head"><h2><span>▥</span> Sprzedaż w czasie</h2><select defaultValue="30"><option value="30">Ostatnie 30 dni</option></select></div>
          <div className="bar-chart">
            <div className="y-labels">{yLabels.map((value, index) => <span key={index}>{numberFormatter.format(value)}</span>)}</div>
            <div className="bars">
              {salesDays.map((day) => (
                <i
                  key={day.date}
                  style={{ height: `${maxSalesDay > 0 ? Math.max(day.value > 0 ? 3 : 0, (day.value / maxSalesDay) * 100) : 0}%` }}
                  className={day.date === dashboardData?.sales30.bestDay.date ? 'active' : ''}
                  title={`${formatChartDay(day.date)}: ${formatMoney(day.value)}`}
                />
              ))}
            </div>
          </div>
          <div className="x-labels">{salesAxisIndexes.map((index) => <span key={salesDays[index].date}>{formatChartDay(salesDays[index].date)}</span>)}</div>
          <div className="chart-summary">
            <div><span>Łączna sprzedaż</span><b>{formatMoney(dashboardData?.sales30.total)}</b></div>
            <div><span>Średnio dziennie</span><b>{formatMoney(dashboardData?.sales30.average)}</b></div>
            <div><span>Najlepszy dzień</span><b>{dashboardData ? formatBestDay(dashboardData.sales30.bestDay.date, dashboardData.sales30.bestDay.value) : '—'}</b></div>
          </div>
        </article>

        <article className="panel weeks-panel">
          <div className="panel-head comparison-head">
            <h2><span>↗</span> Porównanie okresów</h2>
            <div className="comparison-controls">
              <label className="comparison-date"><span>Do</span><input type="date" value={comparisonEndDate} onChange={(event) => setComparisonEndDate(event.target.value)} aria-label="Data końcowa porównania" /></label>
              <label className="comparison-count"><span>Ile</span><select value={comparisonCount} onChange={(event) => setComparisonCount(Number(event.target.value))} aria-label="Liczba okresów">{[1,2,3,4,5].map((count) => <option key={count} value={count}>{count}</option>)}</select></label>
              <label className="comparison-type"><span>Typ</span><select value={comparisonType} onChange={(event) => setComparisonType(event.target.value as ComparisonPeriod)} aria-label="Typ okresu"><option value="week">Tydzień</option><option value="month">Miesiąc</option><option value="year">Rok</option></select></label>
            </div>
          </div>
          <div className="legend">
            {comparisonSeries.map((series, index) => <span key={series.label}><i style={{ backgroundColor: comparisonColors[index % comparisonColors.length] }} />{series.label}</span>)}
          </div>
          <div className="line-chart">
            <svg viewBox="0 0 480 80" preserveAspectRatio="none">
              <g className="gridlines"><line x1="0" y1="20" x2="480" y2="20"/><line x1="0" y1="40" x2="480" y2="40"/><line x1="0" y1="60" x2="480" y2="60"/></g>
              {comparisonSeries.map((series, index) => (
                <polyline
                  key={series.label}
                  points={comparisonPoints(series.values, comparisonMax)}
                  fill="none"
                  stroke={comparisonColors[index % comparisonColors.length]}
                  strokeWidth="2.4"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              ))}
            </svg>
          </div>
          <div className="week-days">{comparisonAxis.map((label, index) => <span key={`${label}-${index}`}>{label}</span>)}</div>
        </article>
      </section>

      <section className="charts-row secondary">
        <article className="panel category-panel">
          <div className="panel-head"><h2><span>◔</span> Sprzedaż wg kategorii</h2><select defaultValue="quarter"><option value="quarter">{dashboardData?.quarter.label || 'Bieżący kwartał'}</option></select></div>
          <div className="category-body">
            <div className="donut" style={{ background: categoryGradient(categoryItems) }}><div><b>{formatMoney(dashboardData?.categories.total)}</b><span>łącznie</span></div></div>
            <div className="category-list">
              {categoryItems.length > 0
                ? categoryItems.map((item, index) => (
                  <p key={item.name}>
                    <i style={{ background: categoryColors[index % categoryColors.length] }} />
                    {item.name.toLocaleUpperCase('pl-PL')}
                    <b>{formatMoney(item.value)}</b>
                    <span>{formatPercent(item.percent)}</span>
                  </p>
                ))
                : <p><i style={{ background: '#d9ddd9' }} />BRAK SPRZEDAŻY <b>—</b><span>—</span></p>}
            </div>
          </div>
        </article>

        <article className="panel heat-panel">
          <div className="panel-head heat-panel-head"><h2>Sprzedaż wg godziny (średnio)</h2></div>
          <div className="hourly-heat-layout">
            <div className="hourly-heat-y">{heatDays.map((day) => <span key={day}>{day}</span>)}</div>
            <div className="hourly-heat-main">
              <div className="hourly-heat-grid">{heatLevels.map((value,index)=><i key={index} className={`h${value}`} title={dashboardData ? `${formatMoney(dashboardData.heatmap.averages[index])} średnio` : undefined} />)}</div>
              <div className="hourly-heat-x">{heatHours.map((hour) => <span key={hour}>{hour}</span>)}</div>
            </div>
          </div>
          <div className="hourly-heat-legend"><span>Mniejsza sprzedaż</span><i aria-hidden="true"/><span>Większa sprzedaż</span></div>
        </article>

        <aside className="right-stack">
          <div className="quote-card"><span>Mały biznes</span><b>Wielkie marzenia</b><em>♡</em></div>
          <div className="company-mode"><div className="mode-icon">♧</div><div><span>Tryb firmy</span><b>działalność nierejestrowana</b><small>Działasz zgodnie z obowiązującymi limitami przychodów (kwartalnie).</small></div></div>
        </aside>
      </section>

      <section className="quick-grid">
        {quickLinks.map(([to,title,desc,icon,tone]) => <NavLink to={to} key={to} className={`quick-card ${tone}`}><span className="quick-icon">{icon}</span><div><b>{title}</b><small>{desc}</small></div></NavLink>)}
      </section>
      <footer className="dashboard-footer"><span>PWA • dane operacyjne: D1</span><b>♡</b><strong>Półeczka Iwonki</strong><small>MAŁE RZECZY, WIELKIE HISTORIE</small></footer>
    </div>
  )
}
function App() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block"><div className="brand-symbol">♡</div><strong>Półeczka<br/>Iwonki</strong><span>MAŁE RZECZY<br/>WIELKIE HISTORIE</span></div>
        <nav>{nav.map(([to,label,icon]) => <NavLink key={to} to={to} end={to==='/' }><span>{icon}</span>{label}</NavLink>)}</nav>
        <div className="sidebar-quote"><span>♧</span><p>Piękne rzeczy<br/>zawsze znajdują<br/>swoich ludzi</p><b>♡</b></div>
        <div className="sidebar-thanks">Dziękuję, że tworzysz<br/>to miejsce razem ze mną. ♡</div>
      </aside>
      <main className="main-area"><Routes>
        <Route path="/" element={<Dashboard/>}/>
        <Route path="/sprzedaz" element={<SalesPage/>}/>
        <Route path="/vinted" element={<Placeholder title="Vinted" text="Monitoring sprzedaży z Vinted i integracja z ewidencją sprzedaży."/>}/>
        <Route path="/dostawy" element={<Placeholder title="Dostawy" text="Dostawy, zbyt, zwroty, sprzedaż i zysk."/>}/>
        <Route path="/artykuly" element={<Placeholder title="Artykuły" text="Zarządzanie asortymentem i danymi artykułów."/>}/>
        <Route path="/kategorie" element={<Placeholder title="Kategorie" text="Kategorie wykorzystywane w sprzedaży, filtrach i analizach."/>}/>
        <Route path="/koszty" element={<Placeholder title="Koszty" text="Koszty oraz dokumenty powiązane z Google Drive."/>}/>
        <Route path="/analizy" element={<Placeholder title="Analizy" text="Porównania okresów, heatmapy, histogramy i analizy dostaw."/>}/>
        <Route path="/synchronizacja" element={<Placeholder title="Synchronizacja" text="Przepływ Loyverse / Vinted → D1, importy, kolejki i historia zdarzeń."/>}/>
        <Route path="/narzedzia" element={<Placeholder title="Narzędzia" text="Przydatne funkcje i narzędzia pomocnicze."/>}/>
        <Route path="/ustawienia" element={<Placeholder title="Ustawienia" text="Firma, limit działalności, integracje, słowniki i wygląd."/>}/>
      </Routes></main>
    </div>
  )
}

export default App