import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './App.css'
import { initGA, initRef, getRef } from './analytics'

initGA()
initRef()

// 모든 API 요청에 X-Ref 헤더 자동 첨부.
// AnonymousCookieFilter가 신규 쿠키 발급 시 이 헤더를 읽어 <uuid>_<ref> 형태로 발급한다.
;(function interceptFetch() {
  const orig = window.fetch
  window.fetch = (url, opts = {}) => {
    const ref = getRef()
    if (!ref) return orig(url, opts)
    const headers = new Headers(opts.headers || {})
    if (!headers.has('X-Ref')) headers.set('X-Ref', ref)
    return orig(url, { ...opts, headers })
  }
})()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
)
