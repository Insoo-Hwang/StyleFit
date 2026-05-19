// Google Analytics 4 헬퍼
// - VITE_GA_ID가 설정된 환경에서만 동작 (dev는 .env에 비워두면 호출 자체가 NO-OP)
// - PII(사진, 얼굴, 쿠키 raw값, 이메일 등)는 절대 파라미터로 보내지 말 것
// - SPA 라우트 변경은 AnalyticsTracker가 useLocation으로 page_view를 수동 전송
// - UTM 파라미터: trackPageView가 page_location 에 전체 URL을 포함해 GA4가 자동 처리
// - ?ref= 파라미터: initRef() 로 sessionStorage에 보관, 모든 이벤트에 자동 첨부

const GA_ID = import.meta.env.VITE_GA_ID
let initialized = false

// --- ref 유입 경로 추적 ---
const REF_KEY = 'sf_ref'

/** 앱 초기화 시 1회 호출. ?ref= 값을 sessionStorage에 저장해 SPA 전환 중에도 유지. */
export function initRef() {
  try {
    const ref = new URLSearchParams(window.location.search).get('ref')
    if (ref) sessionStorage.setItem(REF_KEY, ref.slice(0, 100))
  } catch { /* 무시 */ }
}

/** 현재 세션의 ref 값 반환. 없으면 null. */
export function getRef() {
  try { return sessionStorage.getItem(REF_KEY) } catch { return null }
}

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
  const ref = getRef()
  window.gtag('event', name, ref ? { ref, ...params } : params)
}

export function setUserId(uid) {
  if (!initialized || !window.gtag || !uid) return
  window.gtag('set', { user_id: uid })
}
