import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import './PaidReportPage.css'

const FALLBACK_DATA = {
  personalColor: '쿨톤 · 윈터 계열',
  conclusion: '당신은 쿨톤 계열, 딥·클리어 무드',
  description: '차분하고 선명한 컬러가 얼굴 윤곽을 또렷하게 만들어줄 가능성이 높습니다.',
  typeBreakdown: [{ label: '윈터', pct: 80 }, { label: '섬머', pct: 20 }],
  bestColors: [
    { hex: '#3a3f47', name: '차콜 그레이', usage: '상의·아우터 전반' },
    { hex: '#1f2a44', name: '딥 네이비', usage: '셔츠·데님' },
    { hex: '#2a4233', name: '딥 그린', usage: '맨투맨·후드' },
    { hex: '#5a1f2a', name: '버건디', usage: '포인트 아이템' },
    { hex: '#0f0f0f', name: '블랙', usage: '기본 베이스' },
  ],
  worstColors: [
    { hex: '#f4cad6', name: '밝은 파스텔 핑크', reason: '얼굴이 창백해 보일 수 있음' },
    { hex: '#cae842', name: '형광 라임', reason: '피부톤과 충돌' },
    { hex: '#f4e042', name: '밝은 옐로우', reason: '피부 노란기 강조' },
    { hex: '#dcd1b4', name: '회색빛 베이지', reason: '전체적으로 칙칙해 보임' },
    { hex: '#bee5d2', name: '연한 민트', reason: '얼굴색 가라앉힘' },
  ],
  clothing: {
    tops: ['차콜 니트', '네이비 옥스포드 셔츠', '딥그린 맨투맨', '블랙 미니멀 자켓'],
    bottoms: ['인디고 데님', '차콜 슬랙스', '네이비 치노 팬츠', '블랙 조거 팬츠'],
  },
  hair: {
    desc: '투블럭·슬릭백 — 선명하고 깔끔한 실루엣이 잘 맞습니다.',
    colorNote: '내추럴 블랙 또는 다크 브라운 권장',
    accessories: '실버 시계 · 블랙 프레임 안경 · 실버·건메탈 목걸이',
  },
  situations: [
    { label: '출근룩', outfit: '차콜 슬랙스 + 네이비 셔츠 + 블랙 더비슈즈', desc: '깔끔하고 신뢰감 있는 인상. 실버 시계 포인트 추천.' },
    { label: '데이트룩', outfit: '딥그린 맨투맨 + 인디고 데님 + 화이트 스니커즈', desc: '캐주얼하되 세련된 인상을 줍니다.' },
    { label: '데일리룩', outfit: '블랙 티셔츠 + 차콜 조거 팬츠 + 건메탈 스니커즈', desc: '편안하면서도 깔끔한 기본 코디.' },
  ],
  keywords: ['차콜 니트 남성', '네이비 옥스포드 셔츠', '딥그린 맨투맨', '블랙 미니멀 자켓', '인디고 슬림 데님', '실버 메탈 시계', '블랙 더비슈즈 남성', '투블럭 헤어 왁스', '건메탈 목걸이 남성', '차콜 울 코트'],
  rules: ['밝은 파스텔 단색 상하의 세트는 피하세요', '형광기 있는 색은 포인트 아이템으로도 피하세요', '흰 셔츠 + 밝은 베이지 팬츠 조합은 칙칙해 보일 수 있습니다'],
}

export default function PaidReportPage() {
  const navigate = useNavigate()
  const { state } = useLocation()
  const token = state?.token ?? ''

  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeSit, setActiveSit] = useState(0)

  useEffect(() => {
    if (!token) {
      setReport(FALLBACK_DATA)
      setLoading(false)
      return
    }
    fetch(`/api/report/${token}`)
      .then(r => r.json())
      .then(data => {
        setReport(data ?? FALLBACK_DATA)
        setLoading(false)
      })
      .catch(() => {
        setReport(FALLBACK_DATA)
        setLoading(false)
      })
  }, [token])

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'StyleFit 상세 리포트', url: window.location.href })
      } catch { /* cancelled */ }
    }
  }

  const handleDownload = () => {
    const link = document.createElement('a')
    link.href = `/api/report/${token}/image`
    link.download = 'stylefit-report.png'
    link.click()
  }

  if (loading) {
    return (
      <div className="pr-body">
        <div className="pr-frame">
          <div className="pr-loading">
            <div className="pr-spinner" />
            <p className="pr-loading-text">리포트를 불러오는 중…</p>
          </div>
        </div>
      </div>
    )
  }

  const r = report
  const currentSit = r.situations?.[activeSit] ?? r.situations?.[0]

  return (
    <div className="pr-body">
      <div className="pr-frame">
        <header className="pr-nav">
          <button className="pr-nav-icon" type="button" onClick={handleShare} aria-label="공유">↗</button>
          <span className="pr-nav-title">내 스타일 리포트</span>
          <button className="pr-nav-icon" type="button" onClick={handleDownload} aria-label="다운로드">↓</button>
        </header>

        <div className="pr-scroll">
          <div className="pr-hero">
            <span className="pr-hero-badge">AI 스타일 분석 결과</span>
            <h1 className="pr-hero-title">{r.conclusion}</h1>
            <p className="pr-hero-sub">{r.description}</p>
          </div>

          <section className="pr-section" aria-label="퍼스널컬러 타입">
            <div className="pr-type-card">
              <div className="pr-type-row">
                <span className="pr-type-label">추정 퍼스널컬러</span>
                <span className="pr-type-value">{r.personalColor}</span>
              </div>
              {r.typeBreakdown?.map(b => (
                <div key={b.label} className="pr-bar-row">
                  <span className="pr-bar-name">{b.label}</span>
                  <div className="pr-bar-track">
                    <div className="pr-bar-fill" style={{ width: `${b.pct}%` }} />
                  </div>
                  <span className="pr-bar-pct">{b.pct}%</span>
                </div>
              ))}
              <p className="pr-type-note">* 정면 사진 기반 추정이며, 조명 환경에 따라 달라질 수 있습니다.</p>
            </div>
          </section>

          {r.bestColors?.length > 0 && (
            <section className="pr-section" aria-label="베스트 컬러">
              <p className="pr-section-title">베스트 컬러 {r.bestColors.length}가지</p>
              <div className="pr-color-list">
                {r.bestColors.map(c => (
                  <div key={c.name} className="pr-color-row">
                    <div className="pr-color-swatch" style={{ background: c.hex }} />
                    <div>
                      <p className="pr-color-name">{c.name}</p>
                      <p className="pr-color-tip">{c.usage}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {r.worstColors?.length > 0 && (
            <section className="pr-section" aria-label="피해야 할 컬러">
              <p className="pr-section-title">피해야 할 컬러 {r.worstColors.length}가지</p>
              <div className="pr-color-list">
                {r.worstColors.map(c => (
                  <div key={c.name} className="pr-color-row">
                    <div className="pr-color-swatch" style={{ background: c.hex }}>✗</div>
                    <div>
                      <p className="pr-color-name">{c.name}</p>
                      <p className="pr-color-tip">{c.reason}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {r.clothing && (
            <section className="pr-section" aria-label="의류 추천">
              <p className="pr-section-title">의류 추천</p>
              <div className="pr-cloth-grid">
                <div className="pr-cloth-card">
                  <p className="pr-cloth-title">상의 추천</p>
                  {r.clothing.tops?.map(it => <p key={it} className="pr-cloth-item">· {it}</p>)}
                </div>
                <div className="pr-cloth-card">
                  <p className="pr-cloth-title">하의 추천</p>
                  {r.clothing.bottoms?.map(it => <p key={it} className="pr-cloth-item">· {it}</p>)}
                </div>
              </div>
            </section>
          )}

          {r.hair && (
            <section className="pr-section" aria-label="헤어 & 액세서리">
              <p className="pr-section-title">헤어 &amp; 액세서리 추천</p>
              <div className="pr-hair-cards">
                <div className="pr-hair-card">
                  <div className="pr-hair-img" aria-hidden="true" />
                  <p className="pr-hair-desc">
                    {r.hair.desc}
                    {r.hair.colorNote && <><br /><span style={{ color: '#777' }}>컬러: {r.hair.colorNote}</span></>}
                  </p>
                </div>
                {r.hair.accessories && (
                  <div className="pr-hair-card">
                    <p className="pr-cloth-title">액세서리</p>
                    <p className="pr-hair-desc">{r.hair.accessories}</p>
                  </div>
                )}
              </div>
            </section>
          )}

          {r.situations?.length > 0 && (
            <section className="pr-section" aria-label="상황별 코디">
              <p className="pr-section-title">상황별 코디 가이드</p>
              <div className="pr-sit-tabs" role="tablist">
                {r.situations.map((s, i) => (
                  <button
                    key={s.label}
                    type="button"
                    role="tab"
                    aria-selected={activeSit === i}
                    className={`pr-sit-tab${activeSit === i ? ' active' : ''}`}
                    onClick={() => setActiveSit(i)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              {currentSit && (
                <div className="pr-sit-card" role="tabpanel">
                  <div className="pr-sit-img" aria-hidden="true" />
                  <p className="pr-sit-outfit">{currentSit.outfit}</p>
                  <p className="pr-sit-desc">{currentSit.desc}</p>
                </div>
              )}
            </section>
          )}

          {r.keywords?.length > 0 && (
            <section className="pr-section" aria-label="쇼핑 검색어">
              <p className="pr-section-title">쇼핑 검색어 {r.keywords.length}개</p>
              <p className="pr-section-sub">아래 키워드로 바로 검색해보세요</p>
              <div className="pr-keywords-grid">
                {r.keywords.map(k => (
                  <button key={k} type="button" className="pr-keyword">{k}</button>
                ))}
              </div>
            </section>
          )}

          {r.rules?.length > 0 && (
            <section className="pr-section" aria-label="실패 방지 규칙">
              <p className="pr-section-title">실패 방지 규칙</p>
              <div className="pr-rules-card">
                {r.rules.map(rule => (
                  <p key={rule} className="pr-rule-item">· {rule}</p>
                ))}
              </div>
            </section>
          )}

          <section className="pr-section" aria-label="만족도 설문">
            <div className="pr-survey-card">
              <p className="pr-survey-text">리포트가 도움이 되셨나요?<br /><span style={{ color: '#777' }}>1분 설문</span></p>
              <button type="button" className="pr-survey-link">만족도 평가 →</button>
            </div>
          </section>

          <section className="pr-section" aria-label="다운로드 및 공유">
            <div className="pr-actions-grid">
              <button type="button" className="pr-btn-dl" onClick={handleDownload}>이미지 다운로드</button>
              <button type="button" className="pr-btn-share" onClick={handleShare}>공유하기</button>
            </div>
          </section>

          <section className="pr-section" aria-label="추가 리포트">
            <div className="pr-upsell">
              <p className="pr-upsell-title">다른 상황별 리포트도 받아보세요</p>
              <div className="pr-upsell-chips">
                {['소개팅룩 리포트', '면접룩 리포트', '헤어 추천 리포트'].map(t => (
                  <span key={t} className="pr-upsell-chip">{t}</span>
                ))}
              </div>
              <p className="pr-upsell-note">준비 중 — 관심 있으시면 알림 신청하세요</p>
              <button type="button" className="pr-upsell-cta">관심 있어요 →</button>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
