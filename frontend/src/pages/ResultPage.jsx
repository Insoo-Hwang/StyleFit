import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import SatisfactionDialog from '../components/SatisfactionDialog.jsx'
import PurchaseIntentDialog from '../components/PurchaseIntentDialog.jsx'
import ShareDialog from '../components/ShareDialog.jsx'
import { trackEvent, getRef } from '../analytics'
import { appOriginPath, withAppBase } from '../paths'
import './ResultPage.css'

function parseResult(raw) {
  if (!raw) return null
  if (typeof raw === 'string') {
    try { return JSON.parse(raw) } catch { return null }
  }
  return raw
}

function toSurveyGender(g) {
  if (g === 'male') return 'MALE'
  if (g === 'female') return 'FEMALE'
  return null
}

function formatToday() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`
}


export default function ResultPage() {
  const { state } = useLocation()
  const navigate = useNavigate()
  const [data, setData] = useState(() => state ? { ...state, result: parseResult(state.result) } : null)
  const analysisGender = state?.gender ?? null
  const viewTrackedRef = useRef(false)

  // 만족도 평가 다이얼로그 상태
  const [surveyOpen, setSurveyOpen] = useState(false)
  const [surveyInit, setSurveyInit] = useState({ rating: 0, gender: null, comment: '', isEdit: false })
  const [surveySubmitting, setSurveySubmitting] = useState(false)
  const [surveyDone, setSurveyDone] = useState(null)

  // 결제 의향 다이얼로그 상태
  const [purchaseOpen, setPurchaseOpen] = useState(false)
  const [reportDownloading, setReportDownloading] = useState(false)
  const [hasViewedReport, setHasViewedReport] = useState(false)
  const [reportImageUrl, setReportImageUrl] = useState(state?.reportImageUrl ?? null)
  const [reportGenerating, setReportGenerating] = useState(false)

  // 공유 토큰
  const [shareToken, setShareToken] = useState(null)
  const [shareBusy, setShareBusy] = useState(false)
  const [shareDialogOpen, setShareDialogOpen] = useState(false)

  // 스크롤 깊이 — 도달한 최대 인덱스만 갱신
  const maxScrollIndexRef = useRef(-1)
  const revisitMarkedRef = useRef(false)

  useEffect(() => {
    if (data) return
    fetch('/api/analysis/start', { method: 'POST' })
      .then(r => r.json())
      .then(res => {
        if (res.status === 'COMPLETED') {
          setData({
            result: parseResult(res.result),
            reportImageCached: res.reportImageCached,
          })
          setReportImageUrl(res.reportImageUrl ?? null)
        } else {
          navigate('/upload', { replace: true })
        }
      })
      .catch(() => navigate('/upload', { replace: true }))
  }, [])

  // 결과 로딩 후 만족도 완료 여부 확인 — N°10 섹션 독려 문구 제어용
  useEffect(() => {
    if (!data) return
    let alive = true
    fetch('/api/survey/satisfaction')
      .then(r => r.ok ? r.json() : null)
      .then(b => { if (alive) setSurveyDone(b ? !!b.exists : false) })
      .catch(() => {})
    return () => { alive = false }
  }, [data])

  // 결과 로딩 완료 시 1회 result_view 전송 (personalColor/mainType만 — 카테고리값)
  useEffect(() => {
    if (!data || viewTrackedRef.current) return
    viewTrackedRef.current = true
    const r = data.result ?? {}
    trackEvent('result_view', {
      personal_color: r.personalColor ?? 'unknown',
      main_type: r.mainType ?? 'unknown',
    })
    // 리포트 이미지가 새로 생성된 건지 / DB 캐시 재사용인지 추적 (캐시 적중률 측정)
    if (typeof data.reportImageCached === 'boolean') {
      trackEvent('report_image_resolved', {
        source: data.reportImageCached ? 'cached' : 'generated',
      })
    }
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

  // 이미지가 없을 때 생성 API를 호출하는 공통 함수
  // handlePurchaseYes(Stage 1 → 2)와 handlePurchaseOpen(Stage 2 직접 진입) 양쪽에서 사용
  const fetchReportImageIfNeeded = async () => {
    if (reportImageUrl) return
    setReportGenerating(true)
    try {
      const res = await fetch('/api/analysis/report-image', { method: 'POST' })
      if (res.status === 429) {
        trackEvent('rate_limit_blocked', { location: 'report_image' })
        alert('오늘 리포트 생성 한도에 도달했어요. 내일 다시 시도해주세요.')
      } else if (res.ok) {
        const body = await res.json()
        setReportImageUrl(body.reportImageUrl ?? null)
        trackEvent('report_image_resolved', { source: body.cached ? 'cached' : 'generated' })
      } else {
        trackEvent('report_image_resolved', { source: 'error', status: res.status })
      }
    } catch {
      trackEvent('report_image_resolved', { source: 'network_error' })
    } finally {
      setReportGenerating(false)
    }
  }

  const handlePurchaseOpen = async () => {
    trackEvent('purchase_dialog_open')
    fetch('/api/purchase-intent/open', { method: 'POST' }).catch(() => {})
    setPurchaseOpen(true)
    // Stage 2로 직접 진입하는 경우(이전에 "예"를 눌렀지만 이미지 생성 실패)에도 재시도
    if (hasViewedReport && !reportImageUrl) {
      fetchReportImageIfNeeded()
    }
  }

  const handlePurchaseYes = async () => {
    trackEvent('purchase_choice', { choice: 'yes' })
    setHasViewedReport(true)
    fetch('/api/purchase-intent/yes', { method: 'POST' }).catch(() => {})
    await fetchReportImageIfNeeded()
  }

  const handlePurchaseClose = (stage) => {
    // Stage 1에서 닫힘 = 사용자의 최종 선택은 'no' (서버 기본값과 일치).
    // Stage 2에서 닫힘 = 이미 'yes'를 누른 뒤 리포트를 보고 닫는 동작 — 별도 이벤트 불필요.
    if (stage === 1) trackEvent('purchase_choice', { choice: 'no' })
    setPurchaseOpen(false)
  }

  const handleReportDownload = async () => {
    const url = withAppBase(reportImageUrl)
    if (!url || reportDownloading) return
    trackEvent('report_download_click', { location: 'purchase_dialog_stage2' })
    setReportDownloading(true)
    try {
      let blob
      if (url.startsWith('data:')) {
        // data URI → base64 디코딩해서 Blob 생성
        const [meta, b64] = url.split(',')
        const mime = meta.split(':')[1]?.split(';')[0] ?? 'image/png'
        const binary = atob(b64)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
        blob = new Blob([bytes], { type: mime })
      } else {
        const res = await fetch(url, { mode: 'cors' })
        if (!res.ok) throw new Error('fetch_failed')
        blob = await res.blob()
      }
      const ext = (blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg')
      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = `stylefit_report_${formatToday().replace(/\./g, '')}.${ext}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(objectUrl)
      trackEvent('report_download_success', { size_kb: Math.round(blob.size / 1024) })
    } catch {
      // CORS 등으로 실패하면 새 탭으로 폴백 — 사용자가 직접 저장
      trackEvent('report_download_failed', { reason: 'fetch_or_cors' })
      window.open(url, '_blank', 'noopener,noreferrer')
    } finally {
      setReportDownloading(false)
    }
  }

  const handleShareCreate = async () => {
    if (shareBusy) return
    trackEvent('share_create_click', { has_token: !!shareToken })
    if (shareToken) {
      setShareDialogOpen(true)
      return
    }
    setShareBusy(true)
    try {
      const res = await fetch('/api/share/create', { method: 'POST' })
      if (!res.ok) throw new Error('create_failed')
      const body = await res.json()
      setShareToken(body.token)
      setShareDialogOpen(true)
    } catch {
      trackEvent('share_create_failed', { reason: 'network' })
      alert('공유 링크 생성에 실패했어요. 잠시 후 다시 시도해주세요.')
    } finally {
      setShareBusy(false)
    }
  }

  useEffect(() => {
    const ac = new AbortController()
    fetch('/api/share/me', { signal: ac.signal })
      .then(r => r.ok ? r.json() : null)
      .then(b => { if (b?.token) setShareToken(b.token) })
      .catch(() => {})
    return () => ac.abort()
  }, [])

  const handleSurvey = async () => {
    trackEvent('result_action', { action: 'survey_click' })
    try {
      const res = await fetch('/api/survey/satisfaction')
      const body = await res.json()
      const isEdit = !!body.exists
      const surveyGender = body.gender ?? toSurveyGender(analysisGender)
      setSurveyInit({
        rating: body.rating ?? 0,
        gender: surveyGender,
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
      setSurveyDone(true)
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
      {shareToken && (
        <ShareDialog
          open={shareDialogOpen}
          shareUrl={appOriginPath(`/share/${shareToken}?ref=${getRef() ? `${getRef()}_share` : 'share'}`)}
          reportImageUrl={withAppBase(reportImageUrl)}
          personalColor={r.personalColor}
          onClose={() => setShareDialogOpen(false)}
        />
      )}
      <PurchaseIntentDialog
        open={purchaseOpen}
        imageUrl={withAppBase(reportImageUrl)}
        onClose={handlePurchaseClose}
        onYes={handlePurchaseYes}
        onDownload={handleReportDownload}
        downloading={reportDownloading}
        imageLoading={reportGenerating}
        surveyDone={surveyDone}
        onSurveyClick={handleSurvey}
        skipPayment={!!reportImageUrl || hasViewedReport}
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
          <div className="rp-type-main">
            {r.representativeHex && (
              <span className="rp-rep-swatch" style={{ background: r.representativeHex }} title={r.personalColor} />
            )}
            <span className="rp-v">{r.personalColor ?? '—'}</span>
          </div>
          {r.confidence > 0 && (
            <span className="rp-confidence">{r.confidence}% 확신</span>
          )}
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

      {/* N°04 SHARE — 결과 공유 토큰 */}
      <div className="rp-shead" data-rp-section="share" data-rp-index="4"><span className="rp-ix">N°04</span><h2>친구에게 공유</h2></div>
      <div className="rp-share">
        <div className="rp-share-l">
          {shareToken
            ? '공유 링크가 발급되어 있어요'
            : '내 진단 결과를 친구에게 보여주세요'}
          <span className="rp-share-sub">
            {'링크를 받은 친구도 자기 진단을 받을 수 있어요'}
          </span>
        </div>
        <div className="rp-share-actions">
          <button type="button" className="rp-share-go" onClick={handleShareCreate} disabled={shareBusy}>
            {shareToken ? '공유하기' : '공유 링크 만들기'}
          </button>
        </div>
      </div>

      {/* N°05 SURVEY */}
      <div className="rp-shead" data-rp-section="survey" data-rp-index="5"><span className="rp-ix">N°05</span><h2>리포트 만족도</h2></div>
      <div className="rp-surv">
        <div className="rp-surv-l">
          리포트가 도움이 되셨나요?
          <span className="rp-surv-sub">1분 설문</span>
        </div>
        <button type="button" className="rp-surv-go" onClick={handleSurvey}>만족도 평가 →</button>
      </div>

      {/* N°06 PURCHASE — 베타 기간 동안은 결제 의향만 측정 */}
      <div className="rp-shead" data-rp-section="purchase" data-rp-index="6"><span className="rp-ix">N°06</span><h2>이미지 리포트</h2></div>
      <div className="rp-actions single">
        <button className="rp-btn-act" type="button" onClick={handlePurchaseOpen}>
          <svg viewBox="0 0 24 24" fill="none">
            <rect x="4" y="6" width="16" height="13" rx="2" stroke="currentColor" strokeWidth="1.8" />
            <line x1="4" y1="10" x2="20" y2="10" stroke="currentColor" strokeWidth="1.8" />
          </svg>
          {reportImageUrl ? '이미지 리포트 보기' : '1,990원으로 이미지 리포트 받아보기'}
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
