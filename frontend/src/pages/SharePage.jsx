import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { trackEvent } from '../analytics'
import './SharePage.css'

function parseResult(raw) {
  if (!raw) return null
  if (typeof raw === 'string') {
    try { return JSON.parse(raw) } catch { return null }
  }
  return raw
}

export default function SharePage() {
  const { token } = useParams()
  const navigate = useNavigate()
  const [state, setState] = useState({ loading: true, data: null, error: null, isOwner: false })
  const [hasMyResult, setHasMyResult] = useState(false)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const res = await fetch(`/api/share/${encodeURIComponent(token)}`)
        if (!res.ok) {
          if (alive) setState({ loading: false, data: null, error: res.status === 404 ? 'not_found' : 'unknown', isOwner: false })
          trackEvent('share_view_failed', { reason: res.status === 404 ? 'not_found' : 'error' })
          return
        }
        const body = await res.json()
        const parsed = parseResult(body.result)
        if (alive) {
          setState({
            loading: false,
            data: { ...body, result: parsed },
            error: null,
            isOwner: !!body.isOwner,
          })
          trackEvent('share_view', {
            personal_color: parsed?.personalColor ?? null,
            main_type: parsed?.mainType ?? null,
            is_owner: !!body.isOwner,
          })
        }
      } catch {
        if (alive) setState({ loading: false, data: null, error: 'network', isOwner: false })
        trackEvent('share_view_failed', { reason: 'network' })
      }
    })()
    return () => { alive = false }
  }, [token])

  // 본인 진단 결과 보유 여부 확인 — 있으면 "내 결과와 비교" 버튼 활성화
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const res = await fetch('/api/analysis/start', { method: 'POST' })
        if (!res.ok) return
        const body = await res.json()
        if (alive) setHasMyResult(body?.status === 'COMPLETED')
      } catch { /* ignore */ }
    })()
    return () => { alive = false }
  }, [])

  const handleDiagnose = () => {
    trackEvent('share_diagnose_click', { has_my_report: hasMyResult })
    navigate('/upload')
  }

  const handleCompare = () => {
    trackEvent('share_compare_click')
    navigate(`/compare/${encodeURIComponent(token)}`)
  }

  if (state.loading) {
    return (
      <div className="sp-frame">
        <header className="sp-header"><h1>공유된 진단 결과</h1></header>
        <div className="sp-loading">불러오는 중…</div>
      </div>
    )
  }

  if (state.error) {
    return (
      <div className="sp-frame">
        <header className="sp-header"><h1>공유된 진단 결과</h1></header>
        <div className="sp-empty">
          <div className="sp-empty-x">×</div>
          <p className="sp-empty-msg">
            {state.error === 'not_found'
              ? '공유 링크가 만료되었거나 폐기되었습니다.'
              : '결과를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.'}
          </p>
          <button className="sp-cta" type="button" onClick={() => navigate('/')}>홈으로 돌아가기</button>
        </div>
      </div>
    )
  }

  const r = state.data?.result || {}
  const bestColors = r.bestColors || []
  const worstColors = r.worstColors || []

  return (
    <div className="sp-frame">
      <header className="sp-header">
        <h1>공유된 진단 결과</h1>
        <p className="sp-sub">🔗 친구가 공유한 퍼스널 컬러 결과예요</p>
      </header>

      <section className="sp-hero">
        <div className="sp-hero-tag">PERSONAL COLOR</div>
        <h2 className="sp-hero-title">{r.personalColor || '-'}</h2>
        <p className="sp-hero-lede">{r.heroLede || r.tagline}</p>
        <div className="sp-hero-type">
          <span className="sp-hero-type-main">{r.mainType}</span>
          <span className="sp-hero-type-pct">{r.mainPercent}%</span>
          {r.secondaryType && (
            <span className="sp-hero-type-sub">+ {r.secondaryType} {r.secondaryPercent}%</span>
          )}
        </div>
      </section>

      {bestColors.length > 0 && (
        <section className="sp-section">
          <div className="sp-shead"><h3>잘 어울리는 컬러</h3></div>
          <ul className="sp-colors">
            {bestColors.map((c, i) => (
              <li key={i}>
                <span className="sp-swatch" style={{ background: c.hex }} />
                <div>
                  <strong>{c.name}</strong>
                  <span>{c.use}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {worstColors.length > 0 && (
        <section className="sp-section">
          <div className="sp-shead"><h3>피해야 할 컬러</h3></div>
          <ul className="sp-colors">
            {worstColors.map((c, i) => (
              <li key={i}>
                <span className="sp-swatch" style={{ background: c.hex }} />
                <div>
                  <strong>{c.name}</strong>
                  <span>{c.reason}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="sp-cta-block">
        <button className="sp-cta" type="button" onClick={handleDiagnose}>
          나도 검사해보기 <span className="sp-cta-arrow">→</span>
        </button>
        {hasMyResult && (
          <button className="sp-cta sp-cta-ghost" type="button" onClick={handleCompare}>
            내 결과와 비교해보기
          </button>
        )}
      </div>

      <nav className="sp-tabbar" aria-label="탭바">
        <div className="sp-tabbar-inner">
          <button className="sp-tab" type="button" onClick={() => navigate('/')}>
            <span className="sp-tico"><svg viewBox="0 0 24 24" fill="none"><path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1v-9z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg></span>홈
          </button>
          <button className="sp-tab active" type="button" onClick={handleDiagnose}>
            <span className="sp-tico"><svg viewBox="0 0 24 24" fill="none"><rect x="4" y="6" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" /><circle cx="12" cy="13" r="3.5" stroke="currentColor" strokeWidth="1.6" /></svg></span>진단하기
          </button>
          <button className="sp-tab" type="button" onClick={() => navigate('/result')}>
            <span className="sp-tico"><svg viewBox="0 0 24 24" fill="none"><rect x="5" y="4" width="14" height="17" rx="2" stroke="currentColor" strokeWidth="1.8" /><line x1="8" y1="9" x2="16" y2="9" stroke="currentColor" strokeWidth="1.8" /><line x1="8" y1="13" x2="14" y2="13" stroke="currentColor" strokeWidth="1.8" /></svg></span>내 리포트
          </button>
        </div>
      </nav>
    </div>
  )
}
