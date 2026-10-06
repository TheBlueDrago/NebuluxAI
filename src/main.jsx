import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
// Catches the browser's "install app" offer as soon as it's made (see Profile → Install app).
import '@/lib/installPrompt'
// Settings → Appearance → Chat font, before the first paint.
try { document.documentElement.dataset.chatFont = localStorage.getItem('nx-chat-font') || 'default' } catch { /* fine */ }

// Pages load on demand. After a new deploy, a tab opened earlier can ask for page files
// that no longer exist; reload once to pick up the new version instead of breaking.
window.addEventListener('vite:preloadError', (event) => {
  let last = 0
  try { last = Number(sessionStorage.getItem('bh-reloaded-at')) || 0 } catch { /* storage blocked */ }
  if (Date.now() - last < 10000) return
  try { sessionStorage.setItem('bh-reloaded-at', String(Date.now())) } catch { /* storage blocked */ }
  // No event.preventDefault(): that made the failed import "succeed" with nothing, and the
  // page crashed ("reading 'default'") before the reload. The error reaches lib/lazyRetry.js,
  // which keeps the spinner up while the page reloads.
  window.location.reload()
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
// The page background matches the theme from before the first frame (index.html) and follows
// it after (lib/theme.js applyThemeClass), so nothing white or black flashes while loading.

// The installed app was removed (owner, 2026-09-27): no service worker any more. Any that a
// device still has is removed here (and public/sw.js removes itself too), with its saved files.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations?.().then((regs) => regs.forEach((r) => r.unregister())).catch(() => {});
  globalThis.caches?.keys?.().then((keys) => keys.forEach((k) => caches.delete(k))).catch(() => {});
}
