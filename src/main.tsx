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

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
