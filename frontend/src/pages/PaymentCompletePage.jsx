import { useNavigate, useLocation } from 'react-router-dom'
import './PaymentCompletePage.css'

export default function PaymentCompletePage() {
  const navigate = useNavigate()
  const { state } = useLocation()
  const token = state?.token ?? ''

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'StyleFit 진단 결과', url: window.location.href })
      } catch { /* cancelled */ }
    }
  }

  return (
    <div className="pc-body">
      <div className="pc-frame">
        <header className="pc-nav">
          <span className="pc-nav-title">결제 완료</span>
        </header>

        <div className="pc-scroll">
          <div className="pc-success">
            <div className="pc-check" aria-hidden="true">✓</div>
            <h1 className="pc-success-title">결제가 완료되었습니다!</h1>
            <p className="pc-success-desc">
              상세 리포트가 준비되었습니다.<br />아래에서 바로 확인하실 수 있습니다.
            </p>
            {token && (
              <div className="pc-url-box">
                <p className="pc-url-note">이 페이지 URL을 저장하면 나중에<br />다시 리포트를 확인할 수 있습니다.</p>
                <p className="pc-url-text">/report/{token}</p>
              </div>
            )}
          </div>

          <div className="pc-section">
            <button
              type="button"
              className="pc-btn-primary"
              onClick={() => navigate('/paid-report', { state: { token } })}
            >
              상세 리포트 보기
            </button>
          </div>

          <div className="pc-section">
            <button
              type="button"
              className="pc-btn-secondary"
              onClick={() => {
                const link = document.createElement('a')
                link.href = `/api/report/${token}/image`
                link.download = 'stylefit-report.png'
                link.click()
              }}
            >
              리포트 이미지 다운로드
            </button>
          </div>

          <div className="pc-kakao">
            <div className="pc-kakao-card">
              <div className="pc-kakao-header">
                <span className="pc-kakao-icon" aria-hidden="true">K</span>
                <p className="pc-kakao-desc">리포트를 나중에 다시 보고 싶다면</p>
              </div>
              <button type="button" className="pc-kakao-btn">카카오로 저장하기</button>
              <p className="pc-kakao-hint">선택 사항입니다</p>
            </div>
          </div>

          <div className="pc-survey">
            <div className="pc-survey-card">
              <p className="pc-survey-text">
                리포트를 확인하셨나요?<br />만족도를 알려주세요 (1분)
              </p>
              <button type="button" className="pc-survey-link">설문 참여 →</button>
            </div>
          </div>

          <div className="pc-share">
            <button type="button" className="pc-share-wrap" onClick={handleShare}>
              <div className="pc-share-row">
                <span className="pc-share-icon" aria-hidden="true">↗</span>
                <div>
                  <p className="pc-share-desc">친구에게도 공유해보세요</p>
                  <p className="pc-share-btn-text">공유하기</p>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
