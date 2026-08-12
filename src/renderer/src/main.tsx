// Some npm packages (e.g. older TOML parsers) expect Node's `global`.
if (typeof (globalThis as { global?: unknown }).global === 'undefined') {
  ;(globalThis as { global: typeof globalThis }).global = globalThis
}

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/globals.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
