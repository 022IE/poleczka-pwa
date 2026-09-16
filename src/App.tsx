import { NavLink, Route, Routes } from 'react-router-dom'

const nav = [
  ['/', 'Start'],
  ['/sprzedaz', 'Sprzedaż'],
  ['/dostawy', 'Dostawy'],
  ['/koszty', 'Koszty'],
  ['/analizy', 'Analizy'],
  ['/ustawienia', 'Ustawienia'],
]

function Placeholder({ title, text }: { title: string; text: string }) {
  return (
    <section className="page-card">
      <p className="eyebrow">Półeczka Iwonki</p>
      <h1>{title}</h1>
      <p>{text}</p>
    </section>
  )
}

function App() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">PI</div>
          <div>
            <strong>Półeczka Iwonki</strong>
            <span>PWA v0.1.0</span>
          </div>
        </div>
        <nav>
          {nav.map(([to, label]) => (
            <NavLink key={to} to={to} end={to === '/'}>
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div>
            <span className="status-dot" />
            Fundament projektu gotowy
          </div>
          <span className="muted">dev</span>
        </header>

        <Routes>
          <Route path="/" element={<Placeholder title="Dzień dobry" text="Tu powstanie ekran startowy z najważniejszymi wskaźnikami i wykresami." />} />
          <Route path="/sprzedaz" element={<Placeholder title="Sprzedaż" text="Pierwszy wdrażany moduł: KPI, filtry, paragony i rozwijane pozycje." />} />
          <Route path="/dostawy" element={<Placeholder title="Dostawy" text="Moduł dostaw zostanie dołączony po ukończeniu sprzedaży." />} />
          <Route path="/koszty" element={<Placeholder title="Koszty" text="Koszty wraz z dokumentami przechowywanymi w Google Drive." />} />
          <Route path="/analizy" element={<Placeholder title="Analizy" text="Porównania okresów, heatmapy, histogramy i analizy dostaw." />} />
          <Route path="/ustawienia" element={<Placeholder title="Ustawienia" text="Firma, limit działalności nierejestrowanej, rabaty i integracje." />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
