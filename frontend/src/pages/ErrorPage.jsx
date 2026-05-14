import { useLocation, useNavigate } from 'react-router-dom'
import useReportCheck from '../hooks/useReportCheck.jsx'
import { trackEvent } from '../analytics'
import './ErrorPage.css'

export default function ErrorPage() {
  const navigate = useNavigate()
  const { state } = useLocation()
  const warnings = state?.warnings ?? []
  const reason = state?.reason ?? 'unknown'
  const { checkReport, dialog } = useReportCheck('error_tabbar')

  const isRateLimited = reason === 'rate_limited'
  const isBanned = reason === 'banned'
  const headerTitle = isRateLimited ? '오늘 한도 도달' : (isBanned ? '이용 제한' : '분석 실패')
  const heading = isRateLimited ? '오늘 리포트 생성 한도에 도달했어요' : (isBanned ? '이용이 제한된 사용자입니다' : '분석에 실패했습니다')
  const subCopy = isRateLimited
    ? <>하루 최대 횟수까지 진단을 받으셨어요.<br />내일 다시 시도해주세요.</>
    : (isBanned
        ? <>현재 계정 또는 접속 환경에서는<br />사진 업로드를 이용할 수 없어요.</>
        : <>사진 품질 문제로<br />분석을 완료하지 못했습니다.</>)

  const goRetry = (location) => {
    trackEvent('retry_clicked', { reason, location })
    navigate('/upload')
  }

  return (
    <div className="er-frame" data-screen-label="Error">
      {dialog}
      <header className="er-topnav">
        <span />
        <h1 className="er-title">{headerTitle}</h1>
        <span />
      </header>

      <main className="er-main">
        <div className="er-x-wrap" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
            <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          </svg>
        </div>
        <h2>{heading}</h2>
        <p className="er-sub">{subCopy}</p>

        {!isRateLimited && !isBanned && warnings.length > 0 && (
          <ul className="er-warnings">
            {warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        )}

        <div className="er-actions">
          {!isRateLimited && !isBanned && (
            <button className="er-cta" type="button" onClick={() => goRetry('error_cta')}>
              다른 사진으로 다시 시도 <span className="er-cta-arrow">→</span>
            </button>
          )}
          <button className="er-link" type="button" onClick={() => navigate('/')}>
            처음으로 돌아가기
          </button>
        </div>

        {!isRateLimited && !isBanned && (
          <aside className="er-tip">
            <p className="er-tip-h">— a quick tip —</p>
            정면을 보고 찍은, 자연광에서의 사진이 가장 분석이 잘 됩니다. 선글라스·마스크·강한 보정은 피해주세요.
          </aside>
        )}
      </main>

      <nav className="er-tabbar" aria-label="탭바">
        <div className="er-tabbar-inner">
          <button className="er-tab" type="button" onClick={() => navigate('/')}>
            <span className="er-tico"><svg viewBox="0 0 24 24" fill="none"><path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1v-9z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg></span>홈
          </button>
          <button className="er-tab active er-cta-tab" type="button" onClick={() => goRetry('error_tabbar')}>
            <span className="er-tico"><svg viewBox="0 0 24 24" fill="none"><rect x="4" y="6" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" /><circle cx="12" cy="13" r="3.5" stroke="currentColor" strokeWidth="1.8" /></svg></span>진단하기
          </button>
          <button className="er-tab" type="button" onClick={checkReport}>
            <span className="er-tico"><svg viewBox="0 0 24 24" fill="none"><rect x="5" y="4" width="14" height="17" rx="2" stroke="currentColor" strokeWidth="1.6" /><line x1="8" y1="9" x2="16" y2="9" stroke="currentColor" strokeWidth="1.6" /><line x1="8" y1="13" x2="14" y2="13" stroke="currentColor" strokeWidth="1.6" /></svg></span>내 리포트
          </button>
        </div>
      </nav>
    </div>
  )
}
