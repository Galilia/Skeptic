import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './app/App.tsx'

const rootEl = document.getElementById('root')!;
rootEl.style.background = '#0a0c0f';

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
