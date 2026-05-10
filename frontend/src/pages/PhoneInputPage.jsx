import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import './PhoneInputPage.css'

function formatPhone(digits) {
  const d = digits.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`
}

const PHONE_RE = /^010-\d{4}-\d{4}$/

export default function PhoneInputPage() {
  const navigate = useNavigate()
  const { state } = useLocation()

  const [digits, setDigits] = useState('')
  const [requiredChecked, setRequiredChecked] = useState(false)
  const [marketingChecked, setMarketingChecked] = useState(false)
  const [error, setError] = useState('')

  const formatted = formatPhone(digits)
  const phoneValid = PHONE_RE.test(formatted)
  const canSubmit = phoneValid && requiredChecked

  const handlePhoneChange = (e) => {
    setDigits(e.target.value.replace(/\D/g, ''))
    setError('')
  }

  const handleSubmit = () => {
    if (!phoneValid) {
      setError('올바른 번호 형식으로 입력해주세요')
      return
    }
    navigate('/payment', {
      state: { ...state, phone: formatted, marketingConsent: marketingChecked },
    })
  }

  return (
    <div className="phone-body">
      <div className="phone-frame">

        {/* S1 — TOP NAV */}
        <header className="phone-nav">
          <button className="phone-nav-back" type="button" onClick={() => navigate(-1)} aria-label="뒤로">←</button>
          <span className="phone-nav-title">결제 정보 입력</span>
          <span className="phone-nav-spacer" aria-hidden="true" />
        </header>

        {/* S2 — 2-STEP FUNNEL */}
        <div className="phone-funnel">
          <div className="phone-funnel-step">
            <span className="phone-funnel-dot is-active">1</span>
            <span className="phone-funnel-label is-active">번호 입력</span>
          </div>
          <div className="phone-funnel-line" />
          <div className="phone-funnel-step">
            <span className="phone-funnel-dot">2</span>
            <span className="phone-funnel-label">결제</span>
          </div>
        </div>

        {/* S3 — CONTEXT REMINDER */}
        <section className="phone-context">
          <div className="phone-context-card">
            <div className="phone-context-thumb" aria-hidden="true" />
            <div className="phone-context-body">
              <p className="phone-context-title">상세 리포트</p>
              <p className="phone-context-desc">베스트 컬러 · 헤어 · 코디 · 쇼핑 검색어 포함</p>
              <p className="phone-context-price">990원</p>
            </div>
          </div>
        </section>

        {/* S4 — PHONE INPUT */}
        <section className="phone-input-section">
          <label className="phone-input-label" htmlFor="phone-field">휴대폰 번호</label>
          <div className={`phone-input-wrap${error ? ' is-error' : phoneValid ? ' is-valid' : ''}`}>
            <input
              id="phone-field"
              className="phone-input-field"
              type="tel"
              inputMode="numeric"
              placeholder="010-0000-0000"
              value={formatted}
              onChange={handlePhoneChange}
              maxLength={13}
              aria-describedby="phone-hint"
              aria-invalid={!!error}
            />
            {phoneValid && <span className="phone-input-valid-icon" aria-label="유효한 번호">✓</span>}
          </div>
          {error && <p className="phone-input-error" role="alert">{error}</p>}
          <p className="phone-input-hint" id="phone-hint">
            리포트 전달 및 결제 문의 시에만 사용되며, 마케팅 목적으로 활용되지 않습니다.
          </p>
        </section>

        {/* S5 — CONSENT */}
        <section className="phone-consent-section">
          <label className="phone-consent-row" htmlFor="consent-required">
            <input
              id="consent-required"
              type="checkbox"
              className="phone-consent-input"
              checked={requiredChecked}
              onChange={e => setRequiredChecked(e.target.checked)}
            />
            <span className={`phone-consent-box${requiredChecked ? ' checked' : ''}`} aria-hidden="true">
              {requiredChecked ? '✓' : ''}
            </span>
            <span className="phone-consent-text">
              [필수] 개인정보 수집 및 이용에 동의합니다
              <a href="#privacy" className="phone-consent-link"> 보기 →</a>
            </span>
          </label>
          <label className="phone-consent-row" htmlFor="consent-marketing">
            <input
              id="consent-marketing"
              type="checkbox"
              className="phone-consent-input"
              checked={marketingChecked}
              onChange={e => setMarketingChecked(e.target.checked)}
            />
            <span className={`phone-consent-box${marketingChecked ? ' checked' : ''}`} aria-hidden="true">
              {marketingChecked ? '✓' : ''}
            </span>
            <span className="phone-consent-text">[선택] 마케팅 정보 수신에 동의합니다</span>
          </label>
        </section>

        {/* S6 — CTA */}
        <section className="phone-cta-section">
          <button
            className="phone-cta"
            type="button"
            disabled={!canSubmit}
            onClick={handleSubmit}
          >
            결제하기
          </button>
        </section>

      </div>
    </div>
  )
}
