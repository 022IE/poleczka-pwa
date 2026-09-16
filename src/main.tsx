import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import BuildStatus from './components/BuildStatus'
import './styles.css'
import './overrides.css'
import './build-status.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
      <BuildStatus />
    </BrowserRouter>
  </React.StrictMode>,
)
