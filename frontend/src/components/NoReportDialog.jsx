import './NoReportDialog.css'

export default function NoReportDialog({ onClose, onConfirm }) {
  return (
    <div className="nrd-backdrop" role="dialog" aria-modal="true" aria-labelledby="nrd-title" onClick={onClose}>
      <div className="nrd-card" onClick={(e) => e.stopPropagation()}>
        <div className="nrd-icon" aria-hidden="true">
          <svg viewBox="0 0 40 40" fill="none">
            <rect x="9" y="6" width="22" height="28" rx="2" stroke="currentColor" strokeWidth="1.6" />
            <line x1="13" y1="14" x2="27" y2="14" stroke="currentColor" strokeWidth="1.4" />
            <line x1="13" y1="20" x2="27" y2="20" stroke="currentColor" strokeWidth="1.4" />
            <line x1="13" y1="26" x2="22" y2="26" stroke="currentColor" strokeWidth="1.4" />
          </svg>
        </div>
        <h2 id="nrd-title" className="nrd-title">아직 진단 결과가 없어요</h2>
        <p className="nrd-sub">먼저 사진을 업로드해 진단을 받아주세요.</p>

        <div className="nrd-actions">
          <button type="button" className="nrd-btn ghost" onClick={onClose}>닫기</button>
          <button type="button" className="nrd-btn primary" onClick={onConfirm}>
            진단 받기 <span className="nrd-arrow">→</span>
          </button>
        </div>
      </div>
    </div>
  )
}
