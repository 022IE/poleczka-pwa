import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './styles.css'
import './overrides.css'
import './quote-fix.css'
import './comparison-controls.css'
import './vinted-dashboard.css'
import './hourly-heatmap.css'
import './build-status.css'
import './sales.css'
import './deliveries.css'
import './analysis.css'
import './anomaly-radar.css'
import './readability.css'

// Gdy nowy service worker przejmie kontrolę po publikacji, odświeżamy otwartą kartę raz.
// Zapobiega to pozostawaniu użytkownika na starym bundle UI po wdrożeniu nowej wersji PWA.
if ('serviceWorker' in navigator) {
  let reloadingForUpdate = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloadingForUpdate) return
    reloadingForUpdate = true
    window.location.reload()
  })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
