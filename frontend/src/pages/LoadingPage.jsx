import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import useReportCheck from '../hooks/useReportCheck.jsx'
import './LoadingPage.css'

const STEPS = [
  '사진 품질 확인 중…',
  '피부톤 · 얼굴형 분석 중…',
  '스타일 리포트 생성 중…',
]
const STEP_MS = 5000   // 5초마다 다음 단계 (총 15초)

const FACTS = [
  '퍼스널컬러를 알면 같은 옷도 더 어울려 보일 수 있습니다. 색 하나가 인상을 크게 바꾸기도 해요.',
  '얼굴형에 어울리는 헤어컷은 인상을 가장 빠르게 바꿔주는 변화 중 하나예요.',
  '상황별 코디는 색·길이·핏 세 가지만 잘 맞춰도 90%는 완성됩니다.',
]
const FACT_MS = 4200

export default function LoadingPage() {
  const navigate = useNavigate()
  const { state } = useLocation()
  const [activeStep, setActiveStep] = useState(0)
  const [factIdx, setFactIdx] = useState(0)
  const startedRef = useRef(false)
  const { checkReport, dialog } = useReportCheck()

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    const file = state?.file
    if (!file) {
      navigate('/upload', { replace: true })
      return
    }

    // 단계 진행 타이머: 5s, 10s 시점에 active 단계 진행
    const t1 = setTimeout(() => setActiveStep(1), STEP_MS)
    const t2 = setTimeout(() => setActiveStep(2), STEP_MS * 2)
    const minWait = new Promise(resolve => setTimeout(resolve, STEP_MS * STEPS.length))

    const formData = new FormData()
    formData.append('file', file)

    const fetchPromise = fetch('/api/analysis/submit-photo', {
      method: 'POST',
      body: formData,
    }).then(async (res) => {
      if (res.status === 409) {
        return { kind: 'error', warnings: ['이미 처리 중입니다. 잠시 후 다시 시도해주세요.'] }
      }
      const data = await res.json()
      if (data.status === 'COMPLETED') {
        return { kind: 'completed', result: data.result, reportImageUrl: data.reportImageUrl }
      }
      if (data.status === 'VALIDATION_FAILED') {
        return { kind: 'error', warnings: data.validationWarnings ?? [] }
      }
      return { kind: 'error', warnings: ['분석 중 오류가 발생했습니다.'] }
    }).catch(() => ({ kind: 'error', warnings: ['서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.'] }))

    Promise.all([fetchPromise, minWait]).then(([result]) => {
      if (result.kind === 'completed') {
        navigate('/result', {
          replace: true,
          state: { result: result.result, reportImageUrl: result.reportImageUrl },
        })
      } else {
        navigate('/error', { replace: true, state: { warnings: result.warnings } })
      }
    })

    return () => { clearTimeout(t1); clearTimeout(t2) }
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
        <h2>AI가 분석 중입니다</h2>
        <p className="ld-sub">얼굴톤 · 얼굴형 · 분위기를 읽고 있어요</p>
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
