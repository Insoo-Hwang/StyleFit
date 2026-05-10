import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import './ResultPage.css'

export default function ResultPage() {
  const { state } = useLocation()
  const navigate = useNavigate()
  const [data, setData] = useState(state ?? null)

  useEffect(() => {
    if (data) return
    fetch('/api/analysis/start', { method: 'POST' })
      .then(r => r.json())
      .then(res => {
        if (res.status === 'COMPLETED') {
          setData({ result: res.result, reportImageUrl: res.reportImageUrl })
        } else {
          navigate('/upload', { replace: true })
        }
      })
      .catch(() => navigate('/upload', { replace: true }))
  }, [])

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'StyleFit 진단 결과', url: window.location.href })
      } catch { /* cancelled */ }
    }
  }

  if (!data) {
    return (
      <div className="result-body">
        <div className="result-frame">
          <main className="result-page">
            <div className="result-loading">
              <div className="result-spinner" />
              <p className="result-loading-text">결과를 불러오는 중…</p>
            </div>
          </main>
        </div>
      </div>
    )
  }

  const r = data.result ?? {}
  const bestColors = r.bestColors ?? []
  const worstColors = r.worstColors ?? []
  const styles = r.recommendedStyles ?? []

  // "SPRING WARM" → "SPRING_WARM" 형태로 표시
  const [titleMain, titleSub] = (r.personalColor ?? '결과').split(' ')

  return (
    <div className="result-body">
      <div className="result-frame">
        <main className="result-page">

          <header className="result-head">
            <div className="result-top-row">
              <button
                className="result-back"
                onClick={() => navigate('/home')}
                aria-label="뒤로"
              >
                ←
              </button>
              <span>back to menu</span>
            </div>
            <h1 className="result-brand" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>STYLE<span className="dot">.</span></h1>
            <p className="result-crumb">— 퍼스널 컬러 진단 —</p>
          </header>

          <div className="result-section-title">진 단 결 과</div>

          <article className="result-card">
            <p className="result-eyebrow">your season is</p>
            <h2 className="result-title">
              {titleMain}
              {titleSub && <><span className="accent">_</span>{titleSub}</>}
            </h2>
            {r.description && <p className="result-sub">{r.description}</p>}

            <div className="result-divider" />

            {bestColors.length > 0 && (
              <>
                <p className="result-field-label">
                  어울리는 컬러 <span className="en">— best palette</span>
                </p>
                <div className="result-swatches">
                  {bestColors.map(c => (
                    <span key={c} className="result-swatch" style={{ background: c }} title={c} />
                  ))}
                </div>
              </>
            )}

            {worstColors.length > 0 && (
              <>
                <p className="result-field-label">
                  피해야 할 컬러 <span className="en">— avoid</span>
                </p>
                <div className="result-swatches">
                  {worstColors.map(c => (
                    <span key={c} className="result-swatch avoid" style={{ background: c }} title={c} />
                  ))}
                </div>
              </>
            )}

            {styles.length > 0 && (
              <>
                <p className="result-field-label">
                  추천 스타일 <span className="en">— mood</span>
                </p>
                <div className="result-chips">
                  {styles.map(s => (
                    <span key={s} className="result-chip">{s}</span>
                  ))}
                </div>
              </>
            )}

            {r.makeupTips && (
              <>
                <p className="result-field-label">
                  메이크업 팁 <span className="en">— tip</span>
                </p>
                <div className="result-tip">
                  <span className="result-tip-qmark" aria-hidden="true">"</span>
                  <span>{r.makeupTips}</span>
                </div>
              </>
            )}
          </article>

          <section className="result-report-wrap" aria-label="리포트 이미지">
            <p className="result-report-cap">— 리포트 이미지 —</p>
            {data.reportImageUrl ? (
              <img
                className="result-report-img"
                src={data.reportImageUrl}
                alt="진단 리포트"
              />
            ) : (
              <div className="result-report-placeholder">
                <svg className="result-report-mark" viewBox="0 0 40 40" fill="none" aria-hidden="true">
                  <rect x="6" y="9" width="28" height="24" rx="2" stroke="currentColor" strokeWidth="1.6" />
                  <line x1="6" y1="15" x2="34" y2="15" stroke="currentColor" strokeWidth="1.6" />
                  <circle cx="9" cy="12" r="1" fill="currentColor" />
                  <circle cx="12" cy="12" r="1" fill="currentColor" />
                  <line x1="11" y1="22" x2="29" y2="22" stroke="currentColor" strokeWidth="1.4" />
                  <line x1="11" y1="26" x2="24" y2="26" stroke="currentColor" strokeWidth="1.4" />
                </svg>
                <h3 className="result-report-ph-title">STYLE Report</h3>
                <p className="result-report-ph-sub">
                  {r.personalColor ? r.personalColor.toLowerCase().replace(' ', ' · ') : 'for you'}
                </p>
                {bestColors.length > 0 && (
                  <div className="result-report-mini-swatches" aria-hidden="true">
                    {bestColors.slice(0, 5).map(c => (
                      <span key={c} className="s" style={{ background: c }} />
                    ))}
                  </div>
                )}
                <div className="result-report-stamp">No. 0001</div>
              </div>
            )}
          </section>

          <div className="result-actions">
            <button className="result-btn ghost" type="button" onClick={handleShare}>
              공유하기
            </button>
            <button
              className="result-btn primary"
              type="button"
              onClick={() => navigate('/home')}
            >
              처음으로 →
            </button>
          </div>

          <p className="result-footnote">
            쿠키가 유지되는 동안 이 페이지로 직접 접속해도 결과가 표시됩니다.
          </p>

        </main>
      </div>
    </div>
  )
}
