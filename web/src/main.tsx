import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Só o subconjunto latino (cobre o português). Os subconjuntos pequenos (cirílico, vietnamita) o Vite
// embutiria como data: URI, que a CSP `font-src 'self'` do Caddy bloqueia (o e2e confere).
import '@fontsource/geist/latin-400.css'
import '@fontsource/geist/latin-500.css'
import '@fontsource/geist/latin-600.css'
import '@fontsource/geist/latin-700.css'
import './ui/tokens.css'
import './ui/global.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
