import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import useReportCheck from '../hooks/useReportCheck.jsx'
import { trackEvent } from '../analytics'
import './LoadingPage.css'

function extractTone(raw) {
  try {
    const r = typeof raw === 'string' ? JSON.parse(raw) : raw
    return {
      personal_color: r?.personalColor ?? 'unknown',
      main_type: r?.mainType ?? 'unknown',
    }
  } catch {
    return { personal_color: 'unknown', main_type: 'unknown' }
  }
}

const STEPS = [
  '사진 품질 확인 중…',
  '피부톤 · 얼굴형 분석 중…',
  '스타일 리포트 생성 중…',
]
const VALIDATION_MS = 2000
const AI_STEP_MS = 5000
const EXPECTED_MS = 20_000   // 예상 총 소요시간 (초과 시 "곧 완료돼요" 표시)

const HERO_LABELS = [
  { title: '사진 검증 중', sub: '사진 품질과 얼굴 인식을 확인하고 있어요' },
  { title: 'AI 분석 중',   sub: '피부톤 · 얼굴형 · 분위기를 읽고 있어요' },
  { title: '리포트 생성 중', sub: '나만의 스타일 리포트를 만들고 있어요' },
]

const FACTS = [
  '퍼스널컬러를 알면 같은 옷도 더 어울려 보일 수 있습니다. 색 하나가 인상을 크게 바꾸기도 해요.',
  '얼굴형에 어울리는 헤어컷은 인상을 가장 빠르게 바꿔주는 변화 중 하나예요.',
  '상황별 코디는 색·길이·핏 세 가지만 잘 맞춰도 90%는 완성됩니다.',
]
const FACT_MS = 4200

const SEASONS = [
  { label: '봄 웜', color: '#d4906a' },
  { label: '여름 쿨', color: '#7fa8c2' },
  { label: '가을 웜', color: '#b86d38' },
  { label: '겨울 쿨', color: '#7288aa' },
]

export default function LoadingPage() {
  const navigate = useNavigate()
  const { state } = useLocation()
  const [activeStep, setActiveStep] = useState(0)
  const [factIdx, setFactIdx] = useState(0)
  const [barProgress, setBarProgress] = useState(0)
  const [secondsLeft, setSecondsLeft] = useState(Math.ceil(EXPECTED_MS / 1000))
  const [seasonBars, setSeasonBars] = useState([34, 27, 48, 21])
  const startedRef = useRef(false)
  const { checkReport, dialog } = useReportCheck('loading_tabbar')

  // 단계 진행 타이머 — startedRef 가드와 분리해야 StrictMode 이중 호출에서도 정상 동작
  useEffect(() => {
    if (!state?.file) return
    const t1 = setTimeout(() => setActiveStep(1), VALIDATION_MS)
    const t2 = setTimeout(() => setActiveStep(2), VALIDATION_MS + AI_STEP_MS)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [!!state?.file]) // eslint-disable-line react-hooks/exhaustive-deps

  // 진행 바 + 카운트다운 타이머
  useEffect(() => {
    if (!state?.file) return
    const origin = Date.now()
    const id = setInterval(() => {
      const elapsed = Date.now() - origin
      const raw = Math.min(1, elapsed / EXPECTED_MS)
      setBarProgress(Math.min(0.88, 1 - Math.pow(1 - raw, 0.55)))
      setSecondsLeft(Math.max(0, Math.ceil((EXPECTED_MS - elapsed) / 1000)))
    }, 500)
    return () => clearInterval(id)
  }, [!!state?.file]) // eslint-disable-line react-hooks/exhaustive-deps

  // 계절 타입 확률 바 랜덤 흔들기
  useEffect(() => {
    const id = setInterval(() => {
      setSeasonBars(prev => prev.map(v => {
        const d = (Math.random() - 0.45) * 14
        return Math.min(88, Math.max(8, v + d))
      }))
    }, 700)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    const file = state?.file
    if (!file) {
      navigate('/upload', { replace: true })
      return
    }

    const formData = new FormData()
    formData.append('file', file)
    formData.append('gender', state?.gender ?? 'unisex')

    trackEvent('loading_teaser_shown', { expected_seconds: EXPECTED_MS / 1000 })

    const startedAt = Date.now()
    const fetchPromise = fetch('/api/analysis/submit-photo', {
      method: 'POST',
      body: formData,
    }).then(async (res) => {
      if (res.status === 409) {
        return { kind: 'error', reason: 'in_progress_409', warnings: ['이미 처리 중입니다. 잠시 후 다시 시도해주세요.'] }
      }
      if (res.status === 429) {
        // 일일 한도 초과 — ErrorPage에서 전용 카피로 안내
        return { kind: 'error', reason: 'rate_limited', warnings: ['오늘 리포트 생성 한도에 도달했어요.'] }
      }
      if (res.status === 403) {
        return { kind: 'error', reason: 'banned', warnings: ['이용이 제한된 사용자입니다.'] }
      }
      const data = await res.json()
      if (data.status === 'COMPLETED') {
        return { kind: 'completed', result: data.result, reportImageUrl: data.reportImageUrl, reportImageCached: data.reportImageCached, faceImageSaved: data.faceImageSaved }
      }
      if (data.status === 'VALIDATION_FAILED') {
        return { kind: 'error', reason: 'validation_failed', warnings: data.validationWarnings ?? [] }
      }
      return { kind: 'error', reason: 'unknown', warnings: ['분석 중 오류가 발생했습니다.'] }
    }).catch(() => ({ kind: 'error', reason: 'network', warnings: ['서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.'] }))

    fetchPromise.then((result) => {
      const elapsed_ms = Date.now() - startedAt
      if (result.kind === 'completed') {
        trackEvent('analysis_completed', { ...extractTone(result.result), elapsed_ms, face_image_saved: result.faceImageSaved ?? false, gender: state?.gender ?? 'unisex' })
        navigate('/result', {
          replace: true,
          state: { result: result.result, reportImageUrl: result.reportImageUrl, reportImageCached: result.reportImageCached, gender: state?.gender ?? null },
        })
      } else {
        // rate_limited / banned 는 검증 실패가 아니므로 failed_attempts 카운터는 올리지 않는다.
        const isValidationFailure = result.reason !== 'rate_limited' && result.reason !== 'banned'
        if (isValidationFailure) {
          fetch('/api/user-behavior/analysis-failed', { method: 'POST' })
            .then(r => r.ok ? r.json() : null)
            .catch(() => null)
            .then((body) => {
              trackEvent('analysis_failed', {
                reason: result.reason,
                elapsed_ms,
                attempt_no: body?.failedAttempts ?? null,
              })
            })
        } else if (result.reason === 'rate_limited') {
          trackEvent('rate_limit_blocked', { location: 'analysis_submit', elapsed_ms })
        } else {
          // banned (백엔드 인터셉터가 막은 경우)
          trackEvent('ban_blocked', { location: 'analysis_submit' })
        }
        navigate('/error', { replace: true, state: { warnings: result.warnings, reason: result.reason } })
      }
    })

  }, [navigate, state])

  // 팩트 캐러셀
  useEffect(() => {
    const id = setInterval(() => setFactIdx(i => (i + 1) % FACTS.length), FACT_MS)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="ld-frame" data-screen-label="Loading">
      {dialog}
      <header className="ld-topnav">
        <span />
        <h1 className="ld-title">AI 분석 중</h1>
        <span />
      </header>

      <div className="ld-steps">
        <div className="ld-step done"><span className="ld-dot">✓</span>사진 업로드</div>
        <span className="ld-line" />
        <div className="ld-step active"><span className="ld-dot">2</span>AI 분석</div>
        <span className="ld-line" />
        <div className="ld-step"><span className="ld-dot">3</span>결과 확인</div>
      </div>

      <section className="ld-hero">
        <div className="ld-spin-wrap">
          <svg className="ld-spin" viewBox="0 0 100 100" fill="none">
            <circle className="ld-spin-track" cx="50" cy="50" r="40" strokeWidth="6" />
            <circle className="ld-spin-arc" cx="50" cy="50" r="40" strokeWidth="6" strokeDasharray="90 251" />
          </svg>
        </div>
        <h2 key={`h2-${activeStep}`}>{HERO_LABELS[activeStep].title}</h2>
        <p key={`p-${activeStep}`} className="ld-sub">{HERO_LABELS[activeStep].sub}</p>
        <div className="ld-progress-wrap">
          <div className="ld-progress-bar" style={{ width: `${Math.round(barProgress * 100)}%` }} />
        </div>
        <p className="ld-eta">
          {secondsLeft > 0 ? `약 ${secondsLeft}초 남았어요` : '곧 완료돼요 ✦'}
        </p>
      </section>

      <div className="ld-alist">
        <p className="ld-alab">— 분석 항목 —</p>
        <ul>
          {STEPS.map((label, i) => {
            const status = i < activeStep ? 'done' : i === activeStep ? 'active' : 'todo'
            const cleanLabel = status === 'done'
              ? label.replace('…', ' 완료').replace('중', '확인')
              : label
            return (
              <li key={i} className={`ld-li ${status}`}>
                <span className={`ld-b ${status}`} aria-hidden="true">
                  {status === 'done' && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path d="M5 12l5 5L20 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                {cleanLabel}
              </li>
            )
          })}
        </ul>
      </div>

      <section className="ld-seasons">
        <p className="ld-seasons-lab">— 어떤 타입이 나올까요? —</p>
        <ul className="ld-seasons-list">
          {SEASONS.map((s, i) => (
            <li key={s.label} className="ld-season-row">
              <span className="ld-sn">{s.label}</span>
              <div className="ld-st">
                <div className="ld-sf" style={{ width: `${Math.round(seasonBars[i])}%`, background: s.color }} />
              </div>
              <span className="ld-sp">{Math.round(seasonBars[i])}%</span>
            </li>
          ))}
        </ul>
        <p className="ld-seasons-note">AI가 분석하는 중이에요...</p>
      </section>

      <section className="ld-fact">
        <h3>잠깐, 알고 계셨나요?</h3>
        <div className="ld-fact-card">{FACTS[factIdx]}</div>
        <div className="ld-dots">
          {FACTS.map((_, i) => (
            <span key={i} className={i === factIdx ? 'on' : ''} />
          ))}
        </div>
      </section>

      <nav className="ld-tabbar" aria-label="탭바">
        <div className="ld-tabbar-inner">
          <button className="ld-tab" type="button">
            <span className="ld-tico"><svg viewBox="0 0 24 24" fill="none"><path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1v-9z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg></span>홈
          </button>
          <button className="ld-tab active ld-cta-tab" type="button">
            <span className="ld-tico"><svg viewBox="0 0 24 24" fill="none"><rect x="4" y="6" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" /><circle cx="12" cy="13" r="3.5" stroke="currentColor" strokeWidth="1.8" /></svg></span>진단하기
          </button>
          <button className="ld-tab" type="button" onClick={checkReport}>
            <span className="ld-tico"><svg viewBox="0 0 24 24" fill="none"><rect x="5" y="4" width="14" height="17" rx="2" stroke="currentColor" strokeWidth="1.6" /><line x1="8" y1="9" x2="16" y2="9" stroke="currentColor" strokeWidth="1.6" /><line x1="8" y1="13" x2="14" y2="13" stroke="currentColor" strokeWidth="1.6" /></svg></span>내 리포트
          </button>
        </div>
      </nav>
    </div>
  )
}
