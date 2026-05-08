import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Spinner from '../components/Spinner.jsx'

export default function ResultPage() {
  const { state } = useLocation()
  const navigate = useNavigate()
  const [data, setData] = useState(state ?? null)

  // 직접 URL로 접근한 경우 start API로 데이터 다시 조회
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

  if (!data) {
    return (
      <div className="center-screen">
        <Spinner />
        <p className="muted">결과를 불러오는 중...</p>
      </div>
    )
  }

  const r = data.result ?? {}

  return (
    <div className="page">
      <h1 className="title">StyleFit</h1>

      <div className="result-card">
        <p className="result-label">진단 결과</p>
        <h2 className="color-type">{r.personalColor ?? '-'}</h2>
        <p className="muted">{r.description}</p>

        <div className="section">
          <p className="section-label">어울리는 컬러</p>
          <div className="color-row">
            {(r.bestColors ?? []).map(c => (
              <div key={c} className="swatch" style={{ background: c }} title={c} />
            ))}
          </div>
        </div>

        <div className="section">
          <p className="section-label">피해야 할 컬러</p>
          <div className="color-row">
            {(r.worstColors ?? []).map(c => (
              <div key={c} className="swatch" style={{ background: c }} title={c} />
            ))}
          </div>
        </div>

        <div className="section">
          <p className="section-label">추천 스타일</p>
          <div className="tag-row">
            {(r.recommendedStyles ?? []).map(s => <span key={s} className="tag">{s}</span>)}
          </div>
        </div>

        {r.makeupTips && (
          <div className="section">
            <p className="section-label">메이크업 팁</p>
            <p>{r.makeupTips}</p>
          </div>
        )}
      </div>

      {data.reportImageUrl && (
        <div className="section">
          <p className="section-label center">리포트 이미지</p>
          <img src={data.reportImageUrl} alt="리포트" className="report-img" />
        </div>
      )}

      <p className="muted small center">쿠키가 유지되는 동안 이 페이지로 직접 접속해도 결과가 표시됩니다.</p>
    </div>
  )
}
