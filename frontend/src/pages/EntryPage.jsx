import { useNavigate } from 'react-router-dom'
import './EntryPage.css'

export default function EntryPage() {
  const navigate = useNavigate()
  const handleStart = () => {
    navigate('/home')
  }

  return (
    <div className="entry-body">
      <div className="entry-frame">
        <main className="entry-page">
          <div className="entry-pole left" />
          <div className="entry-pole right" />

          <section className="entry-hero">
            <svg className="entry-mark" viewBox="0 0 40 40" fill="none" aria-hidden="true">
              <rect x="6" y="12" width="28" height="20" rx="3" stroke="#1c1c1a" strokeWidth="1.5" />
              <circle cx="20" cy="22" r="5" stroke="#1c1c1a" strokeWidth="1.5" />
              <circle cx="20" cy="22" r="1.6" fill="#1c1c1a" />
              <rect x="16" y="9" width="8" height="3" stroke="#1c1c1a" strokeWidth="1.5" />
            </svg>

            <h1 className="entry-wordmark">
              STYLE<span className="dot">.</span>
            </h1>

            <div className="entry-rule" />

            <p className="entry-lede">
              사진 3장이면 충분합니다.<br />
              당신에게 어울리는<br />
              <em>헤어 · 컬러 · 무드</em>를 찾아드려요.
            </p>

            <div className="entry-tagline">your style, found in three photos.</div>
          </section>

          <div className="entry-cta-wrap">
            <button
              className="entry-cta"
              type="button"
              onClick={handleStart}
            >
              시작하기
              <span className="entry-cta-arrow">→</span>
            </button>
          </div>
        </main>
      </div>
    </div>
  )
}
