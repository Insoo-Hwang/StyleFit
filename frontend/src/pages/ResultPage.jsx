import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import SatisfactionDialog from '../components/SatisfactionDialog.jsx'
import PurchaseIntentDialog from '../components/PurchaseIntentDialog.jsx'
import { trackEvent } from '../analytics'
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
  const viewTrackedRef = useRef(false)

  // 만족도 평가 다이얼로그 상태
  const [surveyOpen, setSurveyOpen] = useState(false)
  const [surveyInit, setSurveyInit] = useState({ rating: 0, gender: null, comment: '', isEdit: false })
  const [surveySubmitting, setSurveySubmitting] = useState(false)

  // 결제 의향 다이얼로그 상태
  const [purchaseOpen, setPurchaseOpen] = useState(false)

  // 스크롤 깊이 — 도달한 최대 인덱스만 갱신
  const maxScrollIndexRef = useRef(-1)
  const revisitMarkedRef = useRef(false)

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

  // 결과 로딩 완료 시 1회 result_view 전송 (personalColor/mainType만 — 카테고리값)
  useEffect(() => {
    if (!data || viewTrackedRef.current) return
    viewTrackedRef.current = true
    const r = data.result ?? {}
    trackEvent('result_view', {
      personal_color: r.personalColor ?? 'unknown',
      main_type: r.mainType ?? 'unknown',
    })
    // 결과 페이지 진입 카운트 — 마운트당 1회만
    if (!revisitMarkedRef.current) {
      revisitMarkedRef.current = true
      fetch('/api/user-behavior/result-revisit', { method: 'POST' }).catch(() => {})
    }
  }, [data])

  // 스크롤 깊이 추적 — IntersectionObserver로 각 N°XX 섹션 헤딩이 화면에 보일 때마다
  // 최대 도달 인덱스를 갱신한다. 같은 인덱스는 중복 전송하지 않는다.
  useEffect(() => {
    if (!data) return
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return
        const section = e.target.dataset.rpSection
        const index = Number(e.target.dataset.rpIndex)
        if (!section || Number.isNaN(index)) return
        if (index <= maxScrollIndexRef.current) return
        maxScrollIndexRef.current = index
        trackEvent('result_scroll_depth', { section, index })
        fetch('/api/user-behavior/scroll', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ section, index }),
        }).catch(() => {})
      })
    }, { threshold: 0.5 })
    document.querySelectorAll('[data-rp-section]').forEach((el) => obs.observe(el))
    return () => obs.disconnect()
  }, [data])

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

  const handlePurchaseOpen = async () => {
    trackEvent('purchase_dialog_open')
    try {
      await fetch('/api/purchase-intent/open', { method: 'POST' })
    } catch {
      // 서버 기록 실패해도 UX는 그대로 진행 (다이얼로그 노출)
    }
    setPurchaseOpen(true)
  }

  const handlePurchaseYes = async () => {
    trackEvent('purchase_choice', { choice: 'yes' })
    try {
      await fetch('/api/purchase-intent/yes', { method: 'POST' })
    } catch { /* 무시 — 다이얼로그는 stage 2로 진행 */ }
  }

  const handlePurchaseClose = (stage) => {
    // Stage 1에서 닫힘 = 사용자의 최종 선택은 'no' (서버 기본값과 일치).
    // Stage 2에서 닫힘 = 이미 'yes'를 누른 뒤 리포트를 보고 닫는 동작 — 별도 이벤트 불필요.
    if (stage === 1) trackEvent('purchase_choice', { choice: 'no' })
    setPurchaseOpen(false)
  }

  const handleSurvey = async () => {
    trackEvent('result_action', { action: 'survey_click' })
    try {
      const res = await fetch('/api/survey/satisfaction')
      const body = await res.json()
      const isEdit = !!body.exists
      setSurveyInit({
        rating: body.rating ?? 0,
        gender: body.gender ?? null,
        comment: body.comment ?? '',
        isEdit,
      })
      trackEvent('survey_open', { is_edit: isEdit })
      setSurveyOpen(true)
    } catch {
      setSurveyInit({ rating: 0, gender: null, comment: '', isEdit: false })
      trackEvent('survey_open', { is_edit: false, error: true })
      setSurveyOpen(true)
    }
  }

  const handleSurveySubmit = async ({ rating, gender, comment }) => {
    if (surveySubmitting) return
    setSurveySubmitting(true)
    try {
      const res = await fetch('/api/survey/satisfaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, gender, comment }),
      })
      if (!res.ok) throw new Error('save_failed')
      trackEvent('survey_submit', {
        rating,
        gender,
        comment_length: comment?.length ?? 0,
        is_edit: surveyInit.isEdit,
      })
      setSurveyOpen(false)
    } catch {
      trackEvent('survey_submit_failed', { rating, gender })
      alert('저장에 실패했어요. 잠시 후 다시 시도해주세요.')
    } finally {
      setSurveySubmitting(false)
    }
  }

  return (
    <div className="rp-frame" data-screen-label="Report">
      <SatisfactionDialog
        open={surveyOpen}
        isEdit={surveyInit.isEdit}
        initialRating={surveyInit.rating}
        initialGender={surveyInit.gender}
        initialComment={surveyInit.comment}
        submitting={surveySubmitting}
        onClose={() => !surveySubmitting && setSurveyOpen(false)}
        onSubmit={handleSurveySubmit}
      />
      <PurchaseIntentDialog
        open={purchaseOpen}
        imageUrl={data.reportImageUrl}
        onClose={handlePurchaseClose}
        onYes={handlePurchaseYes}
      />
      <header className="rp-topnav">
        <span />
        <h1 className="rp-title">내 스타일 리포트</h1>
        <span />
      </header>

      {/* HERO */}
      <section className="rp-hero" data-rp-section="hero" data-rp-index="0">
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
      <div className="rp-shead" data-rp-section="type" data-rp-index="1"><span className="rp-ix">N°01</span><h2>퍼스널컬러 타입</h2></div>
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
          <div className="rp-shead" data-rp-section="best_colors" data-rp-index="2"><span className="rp-ix">N°02</span><h2>베스트 컬러 {best.length}가지</h2></div>
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
          <div className="rp-shead" data-rp-section="worst_colors" data-rp-index="3"><span className="rp-ix">N°03</span><h2>피해야 할 컬러 {worst.length}가지</h2></div>
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
          <div className="rp-shead" data-rp-section="clothing" data-rp-index="4"><span className="rp-ix">N°04</span><h2>의류 추천</h2></div>
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
          <div className="rp-shead" data-rp-section="rules" data-rp-index="5"><span className="rp-ix">N°05</span><h2>실패 방지 규칙</h2></div>
          <aside className="rp-rules">
            <h3>이것만은 피하세요</h3>
            <ul>{rules.map((r, i) => <li key={i}>{r}</li>)}</ul>
          </aside>
        </>
      )}

      {/* N°06 HAIR & ACCESSORIES (Coming Soon) */}
      <div className="rp-shead" data-rp-section="hair_accessories" data-rp-index="6"><span className="rp-ix">N°06</span><h2>헤어 &amp; 액세서리 추천</h2></div>
      <ComingSoonCard />

      {/* N°07 SITUATION (Coming Soon) */}
      <div className="rp-shead" data-rp-section="situation" data-rp-index="7"><span className="rp-ix">N°07</span><h2>상황별 코디 가이드</h2></div>
      <ComingSoonCard />

      {/* N°08 SHOP (Coming Soon) */}
      <div className="rp-shead" data-rp-section="shop" data-rp-index="8"><span className="rp-ix">N°08</span><h2>쇼핑 검색어</h2></div>
      <ComingSoonCard />

      {/* N°09 SURVEY */}
      <div className="rp-shead" data-rp-section="survey" data-rp-index="9"><span className="rp-ix">N°09</span><h2>리포트 만족도</h2></div>
      <div className="rp-surv">
        <div className="rp-surv-l">
          리포트가 도움이 되셨나요?
          <span className="rp-surv-sub">1분 설문</span>
        </div>
        <button type="button" className="rp-surv-go" onClick={handleSurvey}>만족도 평가 →</button>
      </div>

      {/* N°10 PURCHASE — 베타 기간 동안은 결제 의향만 측정 */}
      <div className="rp-shead" data-rp-section="purchase" data-rp-index="10"><span className="rp-ix">N°10</span><h2>이미지 리포트</h2></div>
      <div className="rp-actions single">
        <button className="rp-btn-act" type="button" onClick={handlePurchaseOpen}>
          <svg viewBox="0 0 24 24" fill="none">
            <rect x="4" y="6" width="16" height="13" rx="2" stroke="currentColor" strokeWidth="1.8" />
            <line x1="4" y1="10" x2="20" y2="10" stroke="currentColor" strokeWidth="1.8" />
          </svg>
          1,990원으로 이미지 리포트 받아보기
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
