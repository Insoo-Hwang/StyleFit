import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import useReportCheck from '../hooks/useReportCheck.jsx'
import { trackEvent } from '../analytics'
import './NotFoundPage.css'

export default function NotFoundPage() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { checkReport, dialog } = useReportCheck('notfound_tabbar')

  // 어떤 잘못된 경로로 들어왔는지 카테고리 정도만 기록 — pathname 원본은 PII 우려가 적지만 길이만 보냄
  useEffect(() => {
    trackEvent('not_found_view', { path_length: pathname?.length ?? 0 })
  }, [pathname])

  const goHome = (location) => {
    trackEvent('not_found_action', { action: 'home', location })
    navigate('/', { replace: true })
  }

  const goDiagnose = (location) => {
    trackEvent('not_found_action', { action: 'diagnose', location })
    navigate('/upload', { replace: true })
  }

  return (
    <div className="nf-frame" data-screen-label="NotFound">
      {dialog}
      <header className="nf-topnav">
        <span />
        <h1 className="nf-title">페이지를 찾을 수 없어요</h1>
        <span />
      </header>

      <main className="nf-main">
        <div className="nf-code" aria-hidden="true">404</div>

        <div className="nf-card">
          <div className="nf-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeWidth="1.8" />
              <line x1="12" y1="8" x2="12" y2="13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <circle cx="12" cy="16.4" r="1.1" fill="currentColor" />
            </svg>
          </div>
          <h2>이 페이지는 존재하지 않아요</h2>
          <p className="nf-sub">
            주소를 잘못 입력하셨거나,<br />
            페이지가 이동·삭제되었을 수 있어요.
          </p>
        </div>

        <div className="nf-actions">
          <button className="nf-cta" type="button" onClick={() => goHome('nf_cta')}>
            홈으로 돌아가기 <span className="nf-cta-arrow">→</span>
          </button>
          <button className="nf-link" type="button" onClick={() => goDiagnose('nf_link')}>
            진단 받으러 가기
          </button>
        </div>
      </main>

      <nav className="nf-tabbar" aria-label="탭바">
        <div className="nf-tabbar-inner">
          <button className="nf-tab" type="button" onClick={() => goHome('nf_tabbar')}>
            <span className="nf-tico">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1v-9z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
              </svg>
            </span>홈
          </button>
          <button className="nf-tab" type="button" onClick={() => goDiagnose('nf_tabbar')}>
            <span className="nf-tico">
              <svg viewBox="0 0 24 24" fill="none">
                <rect x="4" y="6" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
                <circle cx="12" cy="13" r="3.5" stroke="currentColor" strokeWidth="1.6" />
              </svg>
            </span>진단하기
          </button>
          <button className="nf-tab" type="button" onClick={checkReport}>
            <span className="nf-tico">
              <svg viewBox="0 0 24 24" fill="none">
                <rect x="5" y="4" width="14" height="17" rx="2" stroke="currentColor" strokeWidth="1.6" />
                <line x1="8" y1="9" x2="16" y2="9" stroke="currentColor" strokeWidth="1.6" />
                <line x1="8" y1="13" x2="14" y2="13" stroke="currentColor" strokeWidth="1.6" />
              </svg>
            </span>내 리포트
          </button>
        </div>
      </nav>
    </div>
  )
}
