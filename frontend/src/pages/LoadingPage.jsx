import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './LoadingPage.css'

const FACTS = [
  '퍼스널컬러를 알면 같은 옷도 더 어울려 보일 수 있습니다. 색 하나가 인상을 크게 바꾸기도 해요.',
  '쿨톤은 청량하고 선명한 색이, 웜톤은 따뜻하고 부드러운 색이 잘 어울리는 경향이 있습니다.',
  '얼굴형에 맞는 헤어스타일만 찾아도 인상이 달라 보인다는 연구 결과가 있습니다.',
]

const STEPS = [
  { sym: '✓', text: '사진 품질 확인 완료', state: 'done' },
  { sym: '⟳', text: '피부톤 · 얼굴형 분석 중…', state: 'active' },
  { sym: '○', text: '스타일 리포트 생성', state: 'pending' },
]

export default function LoadingPage() {
  const navigate = useNavigate()
  const [factIdx, setFactIdx] = useState(0)

  // Rotate facts every 5 s
  useEffect(() => {
    const id = setInterval(() => setFactIdx(i => (i + 1) % FACTS.length), 5000)
    return () => clearInterval(id)
  }, [])

  // Poll for analysis completion
  useEffect(() => {
    let stopped = false
    const poll = async () => {
      try {
        const res = await fetch('/api/analysis/status')
        const data = await res.json()
        if (stopped) return
        if (data.status === 'COMPLETED') {
          navigate('/result', { state: { result: data.result, reportImageUrl: data.reportImageUrl } })
        } else if (data.status === 'FAILED') {
          navigate('/upload', { state: { error: data.message ?? '분석에 실패했습니다.' } })
        }
      } catch {
        // network error — keep polling
      }
    }
    const id = setInterval(poll, 3000)
    poll()
    return () => { stopped = true; clearInterval(id) }
  }, [navigate])

  return (
    <div className="loading-body">
      <div className="loading-frame">

        {/* S1 — TOP NAV (no back button while analysing) */}
        <header className="loading-nav">
          <span className="loading-nav-title">AI 분석 중</span>
        </header>

        {/* S2 — STEP PROGRESS */}
        <div className="loading-progress-bar">
          {[
            { n: 1, label: '사진 업로드' },
            { n: 2, label: 'AI 분석' },
            { n: 3, label: '결과 확인' },
          ].map((s, i) => {
            const done = s.n < 2
            const active = s.n === 2
            return (
              <div key={s.n} className="loading-progress-group">
                <div className={`loading-progress-dot${done ? ' done' : active ? ' active' : ''}`}>
                  {done ? '✓' : s.n}
                </div>
                <span className={`loading-progress-label${active ? ' active' : ''}`}>{s.label}</span>
                {i < 2 && <div className="loading-progress-line" />}
              </div>
            )
          })}
        </div>

        {/* S3 — HERO / SPINNER */}
        <section className="loading-hero">
          <div className="loading-spinner" aria-label="분석 중" />
          <h1 className="loading-hero-title">AI가 분석 중입니다</h1>
          <p className="loading-hero-sub">얼굴톤 · 얼굴형 · 분위기를 읽고 있어요</p>
          <p className="loading-hero-time">약 20~30초 소요됩니다</p>
        </section>

        {/* S4 — ANALYSIS STEP LIST */}
        <section className="loading-checklist" aria-label="분석 진행 상황">
          <p className="loading-checklist-header">분석 항목</p>
          {STEPS.map((s, i) => (
            <div key={i} className={`loading-checklist-row${i ? ' sep' : ''}`}>
              <div className={`loading-checklist-icon state-${s.state}`}>{s.sym}</div>
              <span className={`loading-checklist-text state-${s.state}`}>{s.text}</span>
            </div>
          ))}
        </section>

        {/* S5 — DID YOU KNOW */}
        <section className="loading-fact" aria-live="polite">
          <h2 className="loading-fact-title">잠깐, 알고 계셨나요?</h2>
          <p className="loading-fact-body">{FACTS[factIdx]}</p>
          <div className="loading-fact-dots" aria-hidden="true">
            {FACTS.map((_, i) => (
              <span key={i} className={`loading-fact-dot${i === factIdx ? ' active' : ''}`} />
            ))}
          </div>
        </section>

      </div>
    </div>
  )
}
