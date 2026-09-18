import { useState } from 'react'
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

const kpis = [
  ['Sprzedaż dziś', '287,00 zł', '+12%', 'vs. wczoraj', '🛒', 'green'],
  ['Sprzedaż w kwartale', '6 842,30 zł', '+18%', 'vs. poprzedni kwartał', '▥', 'green'],
  ['Szacowany zysk', '2 314,80 zł', '+14%', 'marża 33,8%', '◉', 'gold'],
  ['Sprzedane sztuki', '28', '+27%', 'vs. wczoraj', '◇', 'rose'],
  ['Średni paragon', '47,83 zł', '+6%', 'vs. poprzedni tydzień', '◇', 'gold'],
  ['% zbytu', '68%', '+5 p.p.', 'vs. poprzedni tydzień', '↗', 'green'],
] as const

const bars = [14, 21, 36, 28, 34, 18, 23, 17, 29, 22, 36, 19, 25, 32, 24, 19, 35, 37, 36, 15, 28, 34, 22, 38, 37, 36, 25, 18, 28, 34, 39, 51]
const weeks = [
  { c: '#9eb89a', p: '15,48 90,34 165,56 240,42 315,50 390,32 465,58' },
  { c: '#d1a84f', p: '15,54 90,28 165,40 240,16 315,52 390,58 465,44' },
  { c: '#c98378', p: '15,58 90,43 165,52 240,41 315,46 390,30 465,47' },
  { c: '#7f9d8a', p: '15,44 90,31 165,46 240,34 315,43 390,22 465,38' },
  { c: '#46705a', p: '15,49 90,25 165,35 240,28 315,36 390,15 465,30' },
]

const heatDays = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Niedz'] as const
const heatHours = Array.from({ length: 14 }, (_, index) => index + 8)
const heat = [
  1,1,1,1,1,2,2,2,3,3,2,2,1,1,
  1,1,1,1,2,2,3,3,4,4,3,2,2,1,
  1,1,1,2,2,3,3,4,4,4,3,3,2,1,
  1,1,2,2,3,3,4,4,4,3,3,2,2,1,
  1,2,2,3,3,4,4,4,3,3,2,2,1,1,
  1,1,2,2,3,3,3,3,2,2,2,1,1,1,
  1,1,1,1,1,2,2,2,2,2,1,1,1,1,
]

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

function shiftPeriod(date: Date, period: ComparisonPeriod, amount: number) {
  const result = new Date(date)

  if (period === 'week') {
    result.setDate(result.getDate() - (7 * amount))
    return result
  }

  const day = result.getDate()
  result.setDate(1)

  if (period === 'month') {
    result.setMonth(result.getMonth() - amount)
  } else {
    result.setFullYear(result.getFullYear() - amount)
  }

  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate()
  result.setDate(Math.min(day, lastDay))
  return result
}

function formatPeriodDate(date: Date) {
  return new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'short', year: '2-digit' })
    .format(date)
    .replace('.', '')
}

function getPeriodLabel(endDateValue: string, period: ComparisonPeriod, offset: number) {
  const baseEnd = new Date(`${endDateValue}T12:00:00`)
  const periodEnd = shiftPeriod(baseEnd, period, offset)
  const periodStart = shiftPeriod(periodEnd, period, 1)
  periodStart.setDate(periodStart.getDate() + 1)
  return `${formatPeriodDate(periodStart)} – ${formatPeriodDate(periodEnd)}`
}

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

  const comparisonLabels = Array.from({ length: comparisonCount }, (_, index) =>
    getPeriodLabel(comparisonEndDate, comparisonType, index),
  ).reverse()
  const comparisonSeries = weeks.slice(-comparisonCount)
  const comparisonAxis = comparisonType === 'week'
    ? ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sob', 'Nd']
    : comparisonType === 'month'
      ? ['1', '5', '10', '15', '20', '25', '30']
      : ['sty', 'mar', 'maj', 'lip', 'wrz', 'lis', 'gru']

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
          <button className="bell" aria-label="Powiadomienia">♟<span>3</span></button>
          <DataStatus />
          <div className="avatar">I</div>
        </div>
      </header>

      <section className="limit-card dashboard-summary-card">
        <div className="limit-dashboard-block">
          <div className="summary-title-row">
            <div>
              <span className="summary-eyebrow">Limit działalności nierejestrowanej</span>
              <strong>III kwartał 2026</strong>
            </div>
            <div className="limit-remaining"><span>Pozostało</span><b>3 971,20 zł</b></div>
          </div>
          <div className="limit-value">Wykorzystano <b>6 842,30 zł</b> z 10 813,50 zł</div>
          <div className="progress-row"><div className="progress"><span /></div><b>63%</b></div>
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
        {kpis.map(([label,value,change,caption,icon,tone]) => (
          <article className="kpi-card" key={label}>
            <div className={`kpi-icon ${tone}`}>{icon}</div>
            <div className="kpi-copy"><span>{label}</span><strong>{value}</strong><b>↑ {change}</b><small>{caption}</small></div>
          </article>
        ))}
      </section>

      <section className="charts-row primary">
        <article className="panel sales-panel">
          <div className="panel-head"><h2><span>▥</span> Sprzedaż w czasie</h2><select defaultValue="30"><option value="30">Ostatnie 30 dni</option></select></div>
          <div className="bar-chart">
            <div className="y-labels"><span>800</span><span>600</span><span>400</span><span>200</span><span>0</span></div>
            <div className="bars">{bars.map((h,i)=><i key={i} style={{height:`${h}%`}} className={i===24?'active':''} />)}</div>
          </div>
          <div className="x-labels"><span>22 cze</span><span>29 cze</span><span>6 lip</span><span>13 lip</span><span>20 lip</span></div>
          <div className="chart-summary"><div><span>Łączna sprzedaż</span><b>7 284,50 zł</b></div><div><span>Średnio dziennie</span><b>242,82 zł</b></div><div><span>Najlepszy dzień</span><b>18 lipca (642,00 zł)</b></div></div>
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
          <div className="legend">{comparisonLabels.map((label, index) => <span key={label}><i style={{ backgroundColor: comparisonSeries[index].c }} />{label}</span>)}</div>
          <div className="line-chart"><svg viewBox="0 0 480 80" preserveAspectRatio="none"><g className="gridlines"><line x1="0" y1="20" x2="480" y2="20"/><line x1="0" y1="40" x2="480" y2="40"/><line x1="0" y1="60" x2="480" y2="60"/></g>{comparisonSeries.map((series,i)=><polyline key={i} points={series.p} fill="none" stroke={series.c} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />)}</svg></div>
          <div className="week-days">{comparisonAxis.map((label) => <span key={label}>{label}</span>)}</div>
        </article>
      </section>

      <section className="charts-row secondary">
        <article className="panel category-panel">
          <div className="panel-head"><h2><span>◔</span> Sprzedaż wg kategorii</h2><select defaultValue="q3"><option value="q3">III kwartał 2026</option></select></div>
          <div className="category-body"><div className="donut"><div><b>6 842,30 zł</b><span>łącznie</span></div></div><div className="category-list"><p><i className="c1"/>GÓRA <b>2 462,90 zł</b><span>36%</span></p><p><i className="c2"/>DÓŁ <b>1 641,20 zł</b><span>24%</span></p><p><i className="c3"/>OBUWIE <b>1 053,60 zł</b><span>15%</span></p><p><i className="c4"/>AKCESORIA <b>873,40 zł</b><span>13%</span></p><p><i className="c5"/>HANDMADE <b>811,20 zł</b><span>12%</span></p></div></div>
        </article>

        <article className="panel heat-panel">
          <div className="panel-head heat-panel-head"><h2>Sprzedaż wg godziny (średnio)</h2></div>
          <div className="hourly-heat-layout">
            <div className="hourly-heat-y">{heatDays.map((day) => <span key={day}>{day}</span>)}</div>
            <div className="hourly-heat-main">
              <div className="hourly-heat-grid">{heat.map((value,index)=><i key={index} className={`h${value}`} />)}</div>
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
      <footer className="dashboard-footer"><span>PWA • wersja robocza</span><b>♡</b><strong>Półeczka Iwonki</strong><small>MAŁE RZECZY, WIELKIE HISTORIE</small></footer>
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