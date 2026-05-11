import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import './ResultPage.css'

function parseResult(raw) {
  if (!raw) return null
  if (typeof raw === 'string') {
    try { return JSON.parse(raw) } catch { return null }
  }
  return raw
}

function formatToday() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`
}

function ComingSoonCard() {
  return (
    <div className="rp-soon">
      <div className="rp-soon-pattern" aria-hidden="true" />
      <span className="rp-soon-pill">
        <span className="rp-soon-dot" aria-hidden="true" />
        Coming Soon
      </span>
    </div>
  )
}

export default function ResultPage() {
  const { state } = useLocation()
  const navigate = useNavigate()
  const [data, setData] = useState(() => state ? { ...state, result: parseResult(state.result) } : null)

  useEffect(() => {
    if (data) return
    fetch('/api/analysis/start', { method: 'POST' })
      .then(r => r.json())
      .then(res => {
        if (res.status === 'COMPLETED') {
          setData({ result: parseResult(res.result), reportImageUrl: res.reportImageUrl })
        } else {
          navigate('/upload', { replace: true })
        }
      })
      .catch(() => navigate('/upload', { replace: true }))
  }, [])

  if (!data) {
    return (
      <div className="rp-frame">
        <div className="rp-loading">
          <div className="rp-spinner" />
          <p>결과를 불러오는 중…</p>
        </div>
      </div>
    )
  }

  const r = data.result ?? {}
  const best = r.bestColors ?? []
  const worst = r.worstColors ?? []
  const top = r.clothing?.top ?? []
  const bottom = r.clothing?.bottom ?? []
  const rules = r.avoidRules ?? []

  const handleShare = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: 'STYLE — 내 스타일 리포트', url: window.location.href }) }
      catch { /* cancelled */ }
    }
  }

  return (
    <div className="rp-frame" data-screen-label="Report">
      <header className="rp-topnav">
        <span />
        <h1 className="rp-title">내 스타일 리포트</h1>
        <span />
      </header>

      {/* HERO */}
      <section className="rp-hero">
        <span className="rp-pill">AI 스타일 분석 결과</span>
        <h1 className="rp-hero-h">
          당신은 <em>{r.personalColor ?? '쿨톤 계열'}</em>,<br />
          {r.tagline ?? ''}
        </h1>
        {r.heroLede && <p className="rp-lede">{r.heroLede}</p>}
        <div className="rp-meta">
          <span>Report N°01</span>
          <span>{formatToday()}</span>
        </div>
      </section>

      {/* N°01 TYPE */}
      <div className="rp-shead"><span className="rp-ix">N°01</span><h2>퍼스널컬러 타입</h2></div>
      <div className="rp-type-card">
        <div className="rp-type-row">
          <span className="rp-lab">추정 퍼스널컬러</span>
          <span className="rp-v">{r.personalColor ?? '—'}</span>
        </div>
        {r.mainType && (
          <div className="rp-bar">
            <span>{r.mainType}</span>
            <span className="rp-track"><span className="rp-fill" style={{ width: `${r.mainPercent ?? 0}%` }} /></span>
            <span className="rp-pct">{r.mainPercent ?? 0}%</span>
          </div>
        )}
        {r.secondaryType && (
          <div className="rp-bar secondary">
            <span>{r.secondaryType}</span>
            <span className="rp-track"><span className="rp-fill" style={{ width: `${r.secondaryPercent ?? 0}%` }} /></span>
            <span className="rp-pct">{r.secondaryPercent ?? 0}%</span>
          </div>
        )}
        <p className="rp-note">* 정면 사진 기반 추정이며, 조명 환경에 따라 달라질 수 있습니다.</p>
      </div>

      {/* N°02 BEST */}
      {best.length > 0 && (
        <>
          <div className="rp-shead"><span className="rp-ix">N°02</span><h2>베스트 컬러 {best.length}가지</h2></div>
          <div className="rp-clist">
            {best.map((c, i) => (
              <div key={i} className="rp-crow">
                <span className="rp-sw" style={{ background: c.hex }} />
                <div>
                  <div className="rp-cname">{c.name}</div>
                  <div className="rp-cuse">{c.use}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* N°03 WORST */}
      {worst.length > 0 && (
        <>
          <div className="rp-shead"><span className="rp-ix">N°03</span><h2>피해야 할 컬러 {worst.length}가지</h2></div>
          <div className="rp-clist">
            {worst.map((c, i) => (
              <div key={i} className="rp-crow bad">
                <span className="rp-sw" style={{ background: c.hex }}>
                  <span className="rp-cx">×</span>
                </span>
                <div>
                  <div className="rp-cname">{c.name}</div>
                  <div className="rp-cuse">{c.reason}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* N°04 CLOTH */}
      {(top.length > 0 || bottom.length > 0) && (
        <>
          <div className="rp-shead"><span className="rp-ix">N°04</span><h2>의류 추천</h2></div>
          <div className="rp-cloth-grid">
            <div className="rp-cloth-card">
              <h3>상의 추천</h3>
              <ul>{top.map((t, i) => <li key={i}>{t}</li>)}</ul>
            </div>
            <div className="rp-cloth-card">
              <h3>하의 추천</h3>
              <ul>{bottom.map((t, i) => <li key={i}>{t}</li>)}</ul>
            </div>
          </div>
        </>
      )}

      {/* N°05 RULES (실패 방지 규칙 — Coming Soon 위로 이동) */}
      {rules.length > 0 && (
        <>
          <div className="rp-shead"><span className="rp-ix">N°05</span><h2>실패 방지 규칙</h2></div>
          <aside className="rp-rules">
            <h3>이것만은 피하세요</h3>
            <ul>{rules.map((r, i) => <li key={i}>{r}</li>)}</ul>
          </aside>
        </>
      )}

      {/* N°06 HAIR & ACCESSORIES (Coming Soon) */}
      <div className="rp-shead"><span className="rp-ix">N°06</span><h2>헤어 &amp; 액세서리 추천</h2></div>
      <ComingSoonCard />

      {/* N°07 SITUATION (Coming Soon) */}
      <div className="rp-shead"><span className="rp-ix">N°07</span><h2>상황별 코디 가이드</h2></div>
      <ComingSoonCard />

      {/* N°08 SHOP (Coming Soon) */}
      <div className="rp-shead"><span className="rp-ix">N°08</span><h2>쇼핑 검색어</h2></div>
      <ComingSoonCard />

      {/* N°09 SURVEY */}
      <div className="rp-shead"><span className="rp-ix">N°09</span><h2>리포트 만족도</h2></div>
      <div className="rp-surv">
        <div className="rp-surv-l">
          리포트가 도움이 되셨나요?
          <span className="rp-surv-sub">1분 설문</span>
        </div>
        <button type="button" className="rp-surv-go">만족도 평가 →</button>
      </div>

      {/* N°10 DOWNLOAD / SHARE */}
      <div className="rp-shead"><span className="rp-ix">N°10</span><h2>저장 &amp; 공유</h2></div>
      <div className="rp-actions">
        <button className="rp-btn-act" type="button" onClick={() => data.reportImageUrl && window.open(data.reportImageUrl, '_blank')}>
          <svg viewBox="0 0 24 24" fill="none"><path d="M12 4v12m0 0l-5-5m5 5l5-5M5 20h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          이미지 다운로드
        </button>
        <button className="rp-btn-act ghost" type="button" onClick={handleShare}>
          <svg viewBox="0 0 24 24" fill="none"><circle cx="6" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.8" /><circle cx="18" cy="6" r="2.5" stroke="currentColor" strokeWidth="1.8" /><circle cx="18" cy="18" r="2.5" stroke="currentColor" strokeWidth="1.8" /><path d="M8 11l8-4M8 13l8 4" stroke="currentColor" strokeWidth="1.8" /></svg>
          공유하기
        </button>
      </div>

      <div style={{ height: 20 }} />

      <nav className="rp-tabbar" aria-label="탭바">
        <div className="rp-tabbar-inner">
          <button className="rp-tab" type="button" onClick={() => navigate('/')}>
            <span className="rp-tico"><svg viewBox="0 0 24 24" fill="none"><path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1v-9z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg></span>홈
          </button>
          <button className="rp-tab" type="button" onClick={() => navigate('/upload')}>
            <span className="rp-tico"><svg viewBox="0 0 24 24" fill="none"><rect x="4" y="6" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" /><circle cx="12" cy="13" r="3.5" stroke="currentColor" strokeWidth="1.6" /></svg></span>진단하기
          </button>
          <button className="rp-tab active" type="button">
            <span className="rp-tico"><svg viewBox="0 0 24 24" fill="none"><rect x="5" y="4" width="14" height="17" rx="2" stroke="currentColor" strokeWidth="1.8" /><line x1="8" y1="9" x2="16" y2="9" stroke="currentColor" strokeWidth="1.8" /><line x1="8" y1="13" x2="14" y2="13" stroke="currentColor" strokeWidth="1.8" /></svg></span>내 리포트
          </button>
        </div>
      </nav>
    </div>
  )
}
