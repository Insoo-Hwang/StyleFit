import { useEffect, useState, useRef } from 'react'
import { trackEvent } from '../analytics'
import { appOriginPath } from '../paths'
import './ShareDialog.css'

let kakaoReady = null

async function initKakao(appKey) {
  if (!kakaoReady) {
    kakaoReady = new Promise((resolve, reject) => {
      if (window.Kakao) { resolve(); return }
      const s = document.createElement('script')
      s.src = 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js'
      s.crossOrigin = 'anonymous'
      s.onload = resolve
      s.onerror = () => { kakaoReady = null; s.remove(); reject(new Error('sdk_load_failed')) }
      document.head.appendChild(s)
    })
  }
  await kakaoReady
  if (!window.Kakao.isInitialized()) window.Kakao.init(appKey)
}

const toAbsUrl = (url) =>
  url ? (url.startsWith('http') ? url : appOriginPath(url)) : null

export default function ShareDialog({ open, shareUrl, reportImageUrl, personalColor, onClose }) {
  const [urlCopied, setUrlCopied] = useState(false)
  const [kakaoLoading, setKakaoLoading] = useState(false)
  const copyTimerRef = useRef(null)

  useEffect(() => () => clearTimeout(copyTimerRef.current), [])

  if (!open) return null

  const handleUrlCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
    } catch {
      // clipboard API 차단 시 (HTTP 환경 등) textarea + execCommand로 조용히 복사
      const ta = document.createElement('textarea')
      ta.value = shareUrl
      ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0'
      document.body.appendChild(ta)
      ta.focus()
      ta.select()
      document.execCommand('copy')
      ta.remove()
    }
    setUrlCopied(true)
    trackEvent('share_link_copied')
    clearTimeout(copyTimerRef.current)
    copyTimerRef.current = setTimeout(() => setUrlCopied(false), 2000)
  }

  const handleKakaoShare = async () => {
    trackEvent('share_kakao_click')
    const appKey = import.meta.env.VITE_KAKAO_APP_KEY
    if (!appKey) {
      alert('카카오 공유 설정이 되어 있지 않습니다.')
      return
    }
    setKakaoLoading(true)
    try {
      await initKakao(appKey)
      const shareLink = { mobileWebUrl: shareUrl, webUrl: shareUrl }
      window.Kakao.Share.sendDefault({
        objectType: 'feed',
        content: {
          title: `내 퍼스널 컬러 — ${personalColor || '진단 결과'}`,
          description: '사진 한 장으로 확인한 나만의 컬러 · 코디 가이드',
          ...(toAbsUrl(reportImageUrl) ? { imageUrl: toAbsUrl(reportImageUrl) } : {}),
          link: shareLink,
        },
        buttons: [
          { title: '결과 보기', link: shareLink },
          { title: '나도 진단받기', link: { mobileWebUrl: appOriginPath('/'), webUrl: appOriginPath('/') } },
        ],
      })
    } catch {
      alert('카카오 공유 중 오류가 발생했어요.')
    } finally {
      setKakaoLoading(false)
    }
  }

  return (
    <div className="shd-backdrop" role="dialog" aria-modal="true" aria-labelledby="shd-title" onClick={onClose}>
      <div className="shd-card" onClick={e => e.stopPropagation()}>
        <button className="shd-close" type="button" aria-label="닫기" onClick={onClose}>
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <line x1="5" y1="5" x2="19" y2="19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <line x1="19" y1="5" x2="5" y2="19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>

        <div className="shd-icon" aria-hidden="true">
          <svg viewBox="0 0 40 40" fill="none">
            <circle cx="30" cy="10" r="4.5" stroke="currentColor" strokeWidth="1.6" />
            <circle cx="10" cy="20" r="4.5" stroke="currentColor" strokeWidth="1.6" />
            <circle cx="30" cy="30" r="4.5" stroke="currentColor" strokeWidth="1.6" />
            <line x1="14.2" y1="18.2" x2="25.8" y2="12.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            <line x1="14.2" y1="21.8" x2="25.8" y2="27.8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </div>

        <h2 id="shd-title" className="shd-title">결과 공유하기</h2>
        <p className="shd-sub">공유 방법을 선택하세요</p>

        <div className="shd-actions">
          <button
            type="button"
            className="shd-btn shd-kakao"
            onClick={handleKakaoShare}
            disabled={kakaoLoading}
          >
            <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18" aria-hidden="true">
              <path d="M12 2C6.48 2 2 5.58 2 10c0 2.78 1.72 5.23 4.34 6.67L5.25 20l4.39-2.84c.77.11 1.55.17 2.36.17 5.52 0 10-3.58 10-8S17.52 2 12 2z" />
            </svg>
            {kakaoLoading ? '불러오는 중…' : '카카오톡으로 공유'}
          </button>
          <button
            type="button"
            className={`shd-btn shd-url${urlCopied ? ' copied' : ''}`}
            onClick={handleUrlCopy}
          >
            {urlCopied ? (
              <>
                <svg viewBox="0 0 24 24" fill="none" width="18" height="18" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                복사됨 ✓
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" fill="none" width="18" height="18" aria-hidden="true">
                  <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="1.7" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="1.7" />
                </svg>
                URL 복사
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
