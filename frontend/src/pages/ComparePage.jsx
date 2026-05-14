import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { trackEvent } from '../analytics'
import './ComparePage.css'

function parseResult(raw) {
  if (!raw) return null
  if (typeof raw === 'string') {
    try { return JSON.parse(raw) } catch { return null }
  }
  return raw
}

function ColorRow({ label, items }) {
  return (
    <div className="cp-color-block">
      <div className="cp-color-label">{label}</div>
      <div className="cp-color-list">
        {(items || []).slice(0, 3).map((c, i) => (
          <span key={i} className="cp-color-chip" title={c.name}>
            <span className="cp-color-sw" style={{ background: c.hex }} />
            <span>{c.name}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

function ResultColumn({ heading, data }) {
  if (!data) {
    return <div className="cp-col cp-col-empty">결과 없음</div>
  }
  return (
    <div className="cp-col">
      <div className="cp-col-h">{heading}</div>
      <div className="cp-col-personal">{data.personalColor || '-'}</div>
      <div className="cp-col-type">
        {data.mainType} {data.mainPercent}%
        {data.secondaryType && (
          <span className="cp-col-type-sub"> · {data.secondaryType} {data.secondaryPercent}%</span>
        )}
      </div>
      <ColorRow label="베스트" items={data.bestColors} />
      <ColorRow label="워스트" items={data.worstColors} />
    </div>
  )
}

export default function ComparePage() {
  const { token } = useParams()
  const navigate = useNavigate()
  const [mine, setMine] = useState(null)
  const [mineExtra, setMineExtra] = useState({})
  const [other, setOther] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const [mineRes, otherRes] = await Promise.all([
          fetch('/api/analysis/start', { method: 'POST' }),
          fetch(`/api/share/${encodeURIComponent(token)}`),
        ])
        if (!alive) return
        if (!mineRes.ok) { setError('mine_fetch'); setLoading(false); return }
        const mineBody = await mineRes.json()
        if (mineBody.status !== 'COMPLETED') {
          setError('no_my_result'); setLoading(false); return
        }
        if (!otherRes.ok) {
          setError(otherRes.status === 404 ? 'not_found' : 'other_fetch')
          setLoading(false); return
        }
        const otherBody = await otherRes.json()
        if (!alive) return
        setMine(parseResult(mineBody.result))
        setMineExtra({ reportImageUrl: mineBody.reportImageUrl, reportImageCached: mineBody.reportImageCached })
        setOther(parseResult(otherBody.result))
        setLoading(false)
        trackEvent('share_compare_view', {
          my_color: parseResult(mineBody.result)?.personalColor ?? null,
          other_color: parseResult(otherBody.result)?.personalColor ?? null,
        })
      } catch {
        if (alive) { setError('network'); setLoading(false) }
      }
    })()
    return () => { alive = false }
  }, [token])

  if (loading) {
    return <div className="cp-frame"><div className="cp-loading">불러오는 중…</div></div>
  }

  if (error) {
    const msg = {
      no_my_result: '비교하려면 먼저 본인 진단을 받아주세요.',
      not_found: '공유 링크가 만료되었거나 폐기되었습니다.',
    }[error] || '비교 결과를 불러오지 못했습니다.'
    return (
      <div className="cp-frame">
        <header className="cp-header"><h1>결과 비교</h1></header>
        <div className="cp-empty">
          <p>{msg}</p>
          <button className="cp-cta" type="button" onClick={() => navigate('/upload')}>
            진단하러 가기
          </button>
        </div>
      </div>
    )
  }

  const sameColor = mine?.personalColor && other?.personalColor
      && mine.personalColor === other.personalColor

  return (
    <div className="cp-frame">
      <header className="cp-header">
        <h1>결과 비교</h1>
        <p className="cp-sub">{sameColor
          ? '같은 톤이에요! 컬러 궁합이 비슷할 가능성이 높아요.'
          : '서로 다른 톤이에요. 상대에게 잘 어울리는 컬러가 본인에게는 어색할 수 있어요.'}</p>
      </header>

      <div className="cp-cols">
        <ResultColumn heading="내 결과" data={mine} />
        <ResultColumn heading="공유받은 결과" data={other} />
      </div>

      <div className="cp-cta-block">
        <button className="cp-cta cp-cta-ghost" type="button" onClick={() => navigate(`/share/${encodeURIComponent(token)}`)}>
          공유받은 결과 자세히 보기
        </button>
        <button className="cp-cta" type="button" onClick={() => navigate('/result', { state: { result: mine, ...mineExtra } })}>
          내 결과 자세히 보기
        </button>
      </div>
    </div>
  )
}
