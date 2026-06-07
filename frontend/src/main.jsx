import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './App.css'
import { initGA, initRef, getRef } from './analytics'
import { APP_BASE, withAppBase } from './paths'

initGA()
initRef()

// 모든 API 요청에 X-Ref 헤더 자동 첨부.
// AnonymousCookieFilter가 신규 쿠키 발급 시 이 헤더를 읽어 <uuid>_<ref> 형태로 발급한다.
;(function interceptFetch() {
  const orig = window.fetch
  window.fetch = (url, opts = {}) => {
    const ref = getRef()
    const nextUrl = typeof url === 'string' ? withAppBase(url) : url
    if (!ref) return orig(nextUrl, opts)
    const headers = new Headers(opts.headers || {})
    if (!headers.has('X-Ref')) headers.set('X-Ref', ref)
    return orig(nextUrl, { ...opts, headers })
  }
})()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter basename={APP_BASE || undefined}>
      <App />
    </BrowserRouter>
  </StrictMode>
)
