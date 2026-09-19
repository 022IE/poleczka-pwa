import BuildStatus from './components/BuildStatus'
import DataStatus from './components/DataStatus'
import LeonRecommendations from './components/LeonRecommendations'
import LeonRecommendationHistory from './components/LeonRecommendationHistory'
import HeaderDateTime from './components/HeaderDateTime'

const SHOW_DEV_PIPELINE = false

function AnalysisHeader() {
  return (
    <header className="dashboard-header analysis-header">
      <div className="header-title-block">
        <span className="page-title-icon" aria-hidden="true">▥</span>
        <div>
          <h1>Analizy</h1>
          <p>Dane zamieniamy tu w konkretne decyzje dla Półeczki.</p>
        </div>
      </div>
      {SHOW_DEV_PIPELINE && <div className="header-build-slot"><BuildStatus /></div>}
      <div className="header-actions">
        <HeaderDateTime />
        <div className="header-divider" />
        <button className="bell" aria-label="Powiadomienia">♟</button>
        <DataStatus />
        <div className="avatar">I</div>
      </div>
    </header>
  )
}

export default function AnalysisPage() {
  return (
    <div className="analysis-wrap">
      <AnalysisHeader />
      <LeonRecommendations />
      <LeonRecommendationHistory />
      <section className="analysis-roadmap">
        <div>
          <span>NASTĘPNE WARSTWY</span>
          <h2>Analizy, które będziemy dokładać</h2>
          <p>Historia decyzji i ich efektów, kandydaci do promocji, radar anomalii, Pareto 80/20 oraz podpowiadacz wyceny.</p>
        </div>
      </section>
    </div>
  )
}
