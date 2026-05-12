import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useReportCheck from '../hooks/useReportCheck.jsx'
import { trackEvent } from '../analytics'
import './HomePage.css'

export default function HomePage() {
  const navigate = useNavigate()
  const goUpload = (location) => {
    trackEvent('cta_click', { cta: 'go_diagnose', location })
    navigate('/upload')
  }
  const { checkReport, dialog } = useReportCheck('home_tabbar')

  // 결제 의향 / 만족도 / 행동 신호 (MVP 디버그 표시 — 운영에선 제거)
  const [purchaseIntent, setPurchaseIntent] = useState(null)
  const [satisfaction, setSatisfaction] = useState(null)
  const [behavior, setBehavior] = useState(null)
  useEffect(() => {
    fetch('/api/purchase-intent').then(r => r.json()).then(setPurchaseIntent)
      .catch(() => setPurchaseIntent({ exists: false, dialogCount: 0 }))
    fetch('/api/survey/satisfaction').then(r => r.json()).then(setSatisfaction)
      .catch(() => setSatisfaction({ exists: false }))
    fetch('/api/user-behavior').then(r => r.json()).then(setBehavior)
      .catch(() => setBehavior({ exists: false }))
  }, [])

  return (
    <div className="hm-frame" data-screen-label="Home">
      {dialog}
      <header className="hm-topnav">
        <div className="hm-lg">STYLE<span className="hm-dot">.</span></div>
        <span className="hm-beta" aria-label="베타 테스트">
          BETA TEST<span className="hm-star">✦</span>
        </span>
      </header>

      <section className="hm-hero">
        <h1>
          소개팅 전날,<br />
          <em>뭐 입을지</em> 모르겠다면
        </h1>
        <p>
          사진 한 장으로 내 얼굴에 맞는<br />
          컬러 · 헤어 · 코디를 알려드립니다.
        </p>
        <div className="hm-tagline">— your style, found in one photo —</div>
      </section>

      <div className="hm-trust">
        <div className="hm-t">
          <span className="hm-tico" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="9" r="4" stroke="currentColor" strokeWidth="1.6" />
              <path d="M4 21c1.5-4 5-6 8-6s6.5 2 8 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </span>
          <span className="hm-tlab">AI가 얼굴톤·얼굴형·<br />분위기를 분석</span>
        </div>
        <div className="hm-t">
          <span className="hm-tico" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <rect x="4" y="7" width="16" height="13" rx="2" stroke="currentColor" strokeWidth="1.6" />
              <rect x="9" y="4" width="6" height="3" stroke="currentColor" strokeWidth="1.6" />
              <circle cx="12" cy="14" r="3.5" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </span>
          <span className="hm-tlab">정면 사진 1장이면<br />충분</span>
        </div>
        <div className="hm-t">
          <span className="hm-tico" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.6" />
              <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </span>
          <span className="hm-tlab">30초 안에 무료 결과<br />확인</span>
        </div>
      </div>

      <div className="hm-section-title">왜 &nbsp;STYLE.&nbsp;인 가</div>
      <div className="hm-values">
        <div className="hm-val">
          <span className="hm-num">1</span>
          <div>
            <h3>내 얼굴톤에 맞는 컬러</h3>
            <p>입을 때마다 '어울린다' 소리 듣는 색 조합</p>
          </div>
        </div>
        <div className="hm-val">
          <span className="hm-num">2</span>
          <div>
            <h3>얼굴형 기반 헤어 추천</h3>
            <p>미용실 가기 전 방향 잡기</p>
          </div>
        </div>
        <div className="hm-val">
          <span className="hm-num">3</span>
          <div>
            <h3>상황별 코디 제안</h3>
            <p>소개팅룩·면접룩·데일리룩 따로 정리</p>
          </div>
        </div>
      </div>

      <div className="hm-teaser-wrap">
        <p className="hm-teaser-lab">무료 결과 미리보기</p>
        <section className="hm-preview-hero">
          <span className="hm-ph-pill">AI 스타일 분석 결과</span>
          <h2 className="hm-ph-h">
            당신은 <em>쿨톤 · 윈터 계열</em>,<br />
            딥 · 클리어 무드
          </h2>
          <p className="hm-ph-lede">차분하고 선명한 컬러가 얼굴 윤곽을 또렷하게 만들어줄 가능성이 높습니다.</p>
          <div className="hm-ph-meta">
            <span>Report N°01</span>
            <span>🔒 preview</span>
          </div>
          <div className="hm-preview-cut">
            <span className="hm-more-label">아래 버튼을 눌러 진단 받으세요 ↓</span>
          </div>
        </section>
      </div>

      <div className="hm-cta-block hm-cta-bottom">
        <button className="hm-cta" type="button" onClick={() => goUpload('home_hero_cta')}>
          지금 무료로 진단받기 <span className="hm-cta-arrow">→</span>
        </button>
        <p className="hm-cta-sub">결제 없이 먼저 무료 결과 확인 가능</p>
      </div>

      {/* [디버그] 사용자 데이터 — MVP 검증용. 운영 전 제거 */}
      <aside className="hm-debug">
        <div className="hm-debug-h">[DEBUG] 결제 의향</div>
        {purchaseIntent === null ? (
          <div className="hm-debug-row">불러오는 중…</div>
        ) : !purchaseIntent.exists ? (
          <div className="hm-debug-row">아직 누르지 않음</div>
        ) : (
          <>
            <div className="hm-debug-row">
              <span>최종 선택</span>
              <strong>{purchaseIntent.lastChoice === 'YES' ? '예' : '아니오'}</strong>
            </div>
            <div className="hm-debug-row">
              <span>다이얼로그 노출 횟수</span>
              <strong>{purchaseIntent.dialogCount}회</strong>
            </div>
          </>
        )}

        <div className="hm-debug-h">[DEBUG] 만족도 조사</div>
        {satisfaction === null ? (
          <div className="hm-debug-row">불러오는 중…</div>
        ) : !satisfaction.exists ? (
          <div className="hm-debug-row">아직 작성하지 않음</div>
        ) : (
          <>
            <div className="hm-debug-row">
              <span>별점</span>
              <strong>{satisfaction.rating} / 5</strong>
            </div>
            <div className="hm-debug-row">
              <span>성별</span>
              <strong>{satisfaction.gender === 'MALE' ? '남자' : satisfaction.gender === 'FEMALE' ? '여자' : '-'}</strong>
            </div>
            <div className="hm-debug-row">
              <span>의견</span>
              <strong className="hm-debug-comment">{satisfaction.comment || '(없음)'}</strong>
            </div>
          </>
        )}

        <div className="hm-debug-h">[DEBUG] 행동 신호</div>
        {behavior === null ? (
          <div className="hm-debug-row">불러오는 중…</div>
        ) : !behavior.exists ? (
          <div className="hm-debug-row">아직 기록 없음</div>
        ) : (
          <>
            <div className="hm-debug-row">
              <span>최대 스크롤 도달</span>
              <strong>{behavior.maxScrollSection ? `${behavior.maxScrollSection} (#${behavior.maxScrollIndex})` : '-'}</strong>
            </div>
            <div className="hm-debug-row">
              <span>마지막 사진 망설임</span>
              <strong>{behavior.lastPhotoDwellMs != null ? `${behavior.lastPhotoDwellMs} ms` : '-'}</strong>
            </div>
            <div className="hm-debug-row">
              <span>누적 검증 실패</span>
              <strong>{behavior.failedAttempts ?? 0}회</strong>
            </div>
            <div className="hm-debug-row">
              <span>결과 페이지 진입</span>
              <strong>{behavior.resultRevisitCount ?? 0}회</strong>
            </div>
            <div className="hm-debug-row">
              <span>마지막 세션 사진 교체</span>
              <strong>{behavior.lastPhotoReplaced ?? 0}회</strong>
            </div>
          </>
        )}
      </aside>

      <footer className="hm-footer">
        <a href="#">개인정보 처리방침</a>
        <span className="hm-sep">/</span>
        <a href="#">이용약관</a>
        <br />
        © 2026 STYLE — copyright placeholder
      </footer>

      <nav className="hm-tabbar" aria-label="탭바">
        <div className="hm-tabbar-inner">
          <button className="hm-tab active" type="button">
            <span className="hm-tico-tab">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1v-9z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
              </svg>
            </span>
            홈
          </button>
          <button className="hm-tab" type="button" onClick={() => goUpload('home_tabbar')}>
            <span className="hm-tico-tab">
              <svg viewBox="0 0 24 24" fill="none">
                <rect x="4" y="6" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" />
                <circle cx="12" cy="13" r="3.5" stroke="currentColor" strokeWidth="1.8" />
              </svg>
            </span>
            진단하기
          </button>
          <button className="hm-tab" type="button" onClick={checkReport}>
            <span className="hm-tico-tab">
              <svg viewBox="0 0 24 24" fill="none">
                <rect x="5" y="4" width="14" height="17" rx="2" stroke="currentColor" strokeWidth="1.6" />
                <line x1="8" y1="9" x2="16" y2="9" stroke="currentColor" strokeWidth="1.6" />
                <line x1="8" y1="13" x2="14" y2="13" stroke="currentColor" strokeWidth="1.6" />
              </svg>
            </span>
            내 리포트
          </button>
        </div>
      </nav>
    </div>
  )
}
