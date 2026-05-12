import { useEffect, useState } from 'react'
import './PurchaseIntentDialog.css'

// Stage 1: 결제 확인 (예/아니오)
// Stage 2: 베타 무료 안내 + 리포트 이미지 (예 누르면 전환)
export default function PurchaseIntentDialog({
  open,
  imageUrl,
  onClose,        // 다이얼로그 종료 (아니오/백드롭/X 어떤 경로든)
  onYes,          // "예" 클릭 시 호출 (서버 기록 트리거)
}) {
  const [stage, setStage] = useState(1)

  // 열릴 때마다 stage 초기화
  useEffect(() => {
    if (open) setStage(1)
  }, [open])

  if (!open) return null

  const handleYes = () => {
    onYes?.()
    setStage(2)
  }

  // onClose에 현재 stage를 전달 — 부모에서 GA 이벤트 분기에 사용
  const closeWithStage = () => onClose?.(stage)

  return (
    <div className="pid-backdrop" role="dialog" aria-modal="true" aria-labelledby="pid-title" onClick={closeWithStage}>
      <div className="pid-card" onClick={(e) => e.stopPropagation()}>
        {stage === 1 ? (
          <>
            <div className="pid-icon" aria-hidden="true">
              <svg viewBox="0 0 40 40" fill="none">
                <rect x="6" y="11" width="28" height="20" rx="2" stroke="currentColor" strokeWidth="1.6" />
                <line x1="6" y1="17" x2="34" y2="17" stroke="currentColor" strokeWidth="1.6" />
                <line x1="11" y1="25" x2="17" y2="25" stroke="currentColor" strokeWidth="1.6" />
              </svg>
            </div>
            <h2 id="pid-title" className="pid-title">1,990원을 결제하시겠습니까?</h2>
            <p className="pid-sub">
              결제 시 AI가 생성한 이미지 리포트를<br />
              고화질로 받아보실 수 있어요.
            </p>

            <div className="pid-actions">
              <button type="button" className="pid-btn ghost" onClick={closeWithStage}>아니오</button>
              <button type="button" className="pid-btn primary" onClick={handleYes}>
                예 <span className="pid-arrow">→</span>
              </button>
            </div>
          </>
        ) : (
          <>
            <span className="pid-pill">🎉 BETA</span>
            <h2 className="pid-title">베타 테스트 기간이라<br />무료로 제공됩니다!</h2>
            <p className="pid-sub">아래 리포트 이미지를 확인해주세요.</p>

            <div className="pid-image-wrap">
              {imageUrl ? (
                <img src={imageUrl} alt="리포트 이미지" />
              ) : (
                <div className="pid-image-fallback">리포트 이미지를 불러올 수 없습니다.</div>
              )}
            </div>

            <div className="pid-actions single">
              <button type="button" className="pid-btn primary" onClick={closeWithStage}>
                닫기
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
