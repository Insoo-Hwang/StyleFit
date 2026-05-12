// Google Analytics 4 헬퍼
// - VITE_GA_ID가 설정된 환경에서만 동작 (dev는 .env에 비워두면 호출 자체가 NO-OP)
// - PII(사진, 얼굴, 쿠키 raw값, 이메일 등)는 절대 파라미터로 보내지 말 것
// - SPA 라우트 변경은 AnalyticsTracker가 useLocation으로 page_view를 수동 전송

const GA_ID = import.meta.env.VITE_GA_ID
let initialized = false

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.async = true
    s.src = src
    s.onload = resolve
    s.onerror = reject
    document.head.appendChild(s)
  })
}

export function initGA() {
  if (initialized || !GA_ID || typeof window === 'undefined') return
  initialized = true

  window.dataLayer = window.dataLayer || []
  window.gtag = function gtag() { window.dataLayer.push(arguments) }
  window.gtag('js', new Date())
  // send_page_view: false — SPA에서는 AnalyticsTracker가 수동 전송
  window.gtag('config', GA_ID, { send_page_view: false, anonymize_ip: true })

  loadScript(`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`).catch(() => {
    initialized = false
  })
}

export function trackPageView(path) {
  if (!initialized || !window.gtag) return
  window.gtag('event', 'page_view', {
    page_path: path,
    page_location: window.location.href,
    page_title: document.title,
  })
}

export function trackEvent(name, params = {}) {
  if (!initialized || !window.gtag) return
  window.gtag('event', name, params)
}

export function setUserId(uid) {
  if (!initialized || !window.gtag || !uid) return
  window.gtag('set', { user_id: uid })
}
