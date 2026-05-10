import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './LandingPage.css'

const SITUATION_CHIPS = ['소개팅', '면접', '데이트', '프로필 사진', '데일리 코디']

const VALUE_CARDS = [
  { n: '①', title: '내 얼굴톤에 맞는 컬러', desc: "입을 때마다 '어울린다' 소리 듣는 색 조합" },
  { n: '②', title: '얼굴형 기반 헤어 추천', desc: '미용실 가기 전 방향 잡기' },
  { n: '③', title: '상황별 코디 제안', desc: '소개팅룩·면접룩·데일리룩 따로 정리' },
]

const TRUST_ITEMS = [
  'AI가 얼굴톤·얼굴형·\n분위기를 분석',
  '정면 사진 1장이면\n충분',
  '30초 안에 무료 결과\n확인',
]

const REPORT_LOCKED_ITEMS = [
  '베스트 컬러 팔레트 5가지 (색칩 + 이름)',
  '피해야 할 컬러 5가지',
  '추천 상의 / 하의 / 헤어 / 액세서리',
  '출근룩 · 데이트룩 · 데일리룩 코디',
  '쇼핑 검색어 10개',
  '실패 방지 규칙',
]

export default function LandingPage() {
  const navigate = useNavigate()
  const [activeChip, setActiveChip] = useState(null)

  const handleCta = () => navigate('/upload')

  return (
    <div className="landing-body">
      <div className="landing-frame">

        {/* S1 — TOP NAV */}
        <header className="landing-nav">
          <span className="landing-nav-title">AI 스타일 진단</span>
        </header>

        {/* S2 — HERO */}
        <section className="landing-hero">
          <h1 className="landing-hero-heading">
            소개팅 전날,<br />뭐 입을지 모르겠다면
          </h1>
          <p className="landing-hero-sub">
            사진 한 장으로 내 얼굴에 맞는<br />컬러·헤어·코디를 알려드립니다
          </p>
        </section>

        {/* S3 — SITUATION CHIPS */}
        <section className="landing-chips-wrap" aria-label="상황 선택">
          <div className="landing-chips">
            {SITUATION_CHIPS.map((chip, i) => (
              <button
                key={chip}
                type="button"
                className={`landing-chip${activeChip === i ? ' is-active' : ''}`}
                onClick={() => setActiveChip(activeChip === i ? null : i)}
              >
                {chip}
              </button>
            ))}
          </div>
        </section>

        {/* S4 — PRIMARY CTA */}
        <section className="landing-cta-section">
          <button className="landing-cta-primary" type="button" onClick={handleCta}>
            지금 무료로 진단받기
          </button>
          <p className="landing-cta-sub">무료 결과로 먼저 확인하고, 상세 리포트는 선택하세요</p>
        </section>

        {/* S5 — TRUST BADGES */}
        <section className="landing-trust" aria-label="서비스 특징">
          {TRUST_ITEMS.map((txt, i) => (
            <div key={i} className="landing-trust-item">
              <div className="landing-trust-icon" aria-hidden="true" />
              <p className="landing-trust-text">{txt}</p>
            </div>
          ))}
        </section>

        {/* S6 — VALUE PROPOSITION CARDS */}
        <section className="landing-value" aria-label="제공 혜택">
          {VALUE_CARDS.map((card) => (
            <div key={card.n} className="landing-value-card">
              <div className="landing-value-num" aria-hidden="true">{card.n}</div>
              <div className="landing-value-body">
                <h3 className="landing-value-title">{card.title}</h3>
                <p className="landing-value-desc">{card.desc}</p>
              </div>
            </div>
          ))}
        </section>

        {/* S7 — SAMPLE RESULT TEASER */}
        <section className="landing-teaser" aria-label="무료 결과 미리보기">
          <p className="landing-teaser-label">무료 결과 미리보기</p>
          <div className="landing-teaser-card">
            <div className="landing-teaser-content">
              <p className="landing-teaser-field-label">추정 타입</p>
              <p className="landing-teaser-type">쿨톤 계열</p>

              <p className="landing-teaser-field-label">무드 키워드</p>
              <div className="landing-teaser-chips">
                {['시크', '깔끔함', '미니멀'].map(k => (
                  <span key={k} className="landing-teaser-chip">{k}</span>
                ))}
              </div>

              <p className="landing-teaser-field-label">피하면 좋은 색</p>
              <p className="landing-teaser-avoid">밝은 파스텔, 형광 계열</p>

              <div className="landing-teaser-palette-row">
                <p className="landing-teaser-field-label">추천 컬러 팔레트</p>
                <div className="landing-teaser-swatches">
                  {[0, 1, 2, 3, 4].map(i => <span key={i} className="landing-teaser-swatch" />)}
                </div>
              </div>
            </div>

            {/* blur / lock overlay */}
            <div className="landing-teaser-blur" aria-hidden="true">
              <button className="landing-teaser-unlock" type="button" onClick={handleCta}>
                상세 리포트에서 더 확인하세요 →
              </button>
            </div>

            <span className="landing-teaser-lock-badge" aria-hidden="true">🔒 locked</span>
          </div>
        </section>

        {/* S7b — LOCKED REPORT CHECKLIST */}
        <section className="landing-locked-list" aria-label="상세 리포트 항목">
          <h2 className="landing-locked-title">상세 리포트에서 확인할 수 있는 항목</h2>
          <ul className="landing-locked-items">
            {REPORT_LOCKED_ITEMS.map((item, i) => (
              <li key={i}>
                <span aria-hidden="true">🔒</span>
                {item}
              </li>
            ))}
          </ul>
        </section>

        {/* S8 — SECONDARY CTA */}
        <section className="landing-cta-section landing-cta-section--bottom">
          <button className="landing-cta-primary" type="button" onClick={handleCta}>
            지금 무료로 진단받기
          </button>
          <p className="landing-cta-sub">결제 없이 먼저 무료 결과 확인 가능</p>
        </section>

        {/* S9 — FOOTER */}
        <footer className="landing-footer">
          <nav className="landing-footer-links" aria-label="법적 링크">
            <a href="#privacy">개인정보 처리방침</a>
            <span aria-hidden="true">/</span>
            <a href="#terms">이용약관</a>
          </nav>
          <p className="landing-footer-copy">© 2026 StyleFit</p>
        </footer>

        {/* S10 — BOTTOM TAB BAR */}
        <nav className="landing-tabbar" aria-label="주요 메뉴">
          {[
            { label: '홈', active: true },
            { label: '진단하기', active: false, action: handleCta },
            { label: '내 리포트', active: false },
          ].map(tab => (
            <button
              key={tab.label}
              type="button"
              className={`landing-tab${tab.active ? ' is-active' : ''}`}
              onClick={tab.action ?? undefined}
            >
              <span className="landing-tab-icon" aria-hidden="true" />
              <span className="landing-tab-label">{tab.label}</span>
            </button>
          ))}
        </nav>

      </div>
    </div>
  )
}
