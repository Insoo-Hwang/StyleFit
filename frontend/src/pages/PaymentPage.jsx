import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import './PaymentPage.css'

const METHODS = [
  { id: 'kakaopay', label: '카카오페이' },
  { id: 'card', label: '신용카드 / 체크카드' },
  { id: 'tosspay', label: '토스페이' },
]

const TRUST_ITEMS = [
  { icon: '🔒', text: 'SSL 보안 결제' },
  { icon: '✓', text: '결제 후 즉시 리포트' },
  { icon: '↩', text: '실패 시 전액 환불' },
]

const PREVIEW_CHIPS = ['컬러 팔레트', '코디 추천', '쇼핑 검색어']

export default function PaymentPage() {
  const navigate = useNavigate()
  const { state } = useLocation()

  const [selectedMethod, setSelectedMethod] = useState('kakaopay')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState('')

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const handlePay = async () => {
    if (loading) return
    setLoading(true)
    try {
      const res = await fetch('/api/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: state?.phone,
          method: selectedMethod,
          marketingConsent: state?.marketingConsent ?? false,
        }),
      })
      const data = await res.json()
      if (data.status === 'SUCCESS') {
        navigate('/payment-complete', { state: { token: data.token } })
      } else {
        showToast('결제에 실패했습니다. 다시 시도해주세요.')
      }
    } catch {
      showToast('결제에 실패했습니다. 다시 시도해주세요.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="pay-body">
      <div className="pay-frame">
        <header className="pay-nav">
          <button className="pay-nav-back" type="button" onClick={() => navigate(-1)} aria-label="뒤로">←</button>
          <span className="pay-nav-title">결제</span>
          <span className="pay-nav-spacer" aria-hidden="true" />
        </header>

        <div className="pay-scroll">
          <section className="pay-order" aria-label="주문 요약">
            <div className="pay-order-card">
              <div className="pay-order-row">
                <div className="pay-order-thumb" aria-hidden="true" />
                <div className="pay-order-info">
                  <p className="pay-order-name">AI 퍼스널컬러 상세 리포트</p>
                  <p className="pay-order-desc">상세 리포트 1회</p>
                </div>
                <span className="pay-order-price-right">990원</span>
              </div>
              <div className="pay-order-divider" />
              <div className="pay-order-total">
                <span className="pay-order-total-label">결제 금액</span>
                <span className="pay-order-total-amount">990원</span>
              </div>
            </div>
          </section>

          <section className="pay-method" aria-label="결제 수단">
            <p className="pay-section-label">결제 수단</p>
            <div className="pay-method-list">
              {METHODS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={`pay-method-item${selectedMethod === m.id ? ' selected' : ''}`}
                  onClick={() => setSelectedMethod(m.id)}
                >
                  <span className={`pay-method-radio${selectedMethod === m.id ? ' selected' : ''}`} aria-hidden="true" />
                  <span className={`pay-method-name${selectedMethod === m.id ? ' selected' : ''}`}>{m.label}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="pay-trust" aria-label="결제 안내">
            <div className="pay-trust-grid">
              {TRUST_ITEMS.map((t) => (
                <div key={t.text} className="pay-trust-item">
                  <span className="pay-trust-icon" aria-hidden="true">{t.icon}</span>
                  <span className="pay-trust-text">{t.text}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="pay-mini" aria-label="리포트 미리보기">
            <div className="pay-mini-card">
              <button
                type="button"
                className="pay-mini-header"
                onClick={() => setPreviewOpen(o => !o)}
                aria-expanded={previewOpen}
              >
                <span className="pay-mini-title">리포트에 포함된 내용</span>
                <span className={`pay-mini-toggle${previewOpen ? ' open' : ''}`} aria-hidden="true">▼</span>
              </button>
              {previewOpen && (
                <div className="pay-mini-chips">
                  {PREVIEW_CHIPS.map((c) => (
                    <span key={c} className="pay-mini-chip">{c}</span>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="pay-cta-bar">
          <button
            type="button"
            className="pay-cta-btn"
            onClick={handlePay}
            disabled={loading}
          >
            {loading ? '처리 중…' : '990원 결제하기'}
          </button>
          <p className="pay-cta-note">위 내용에 동의하고 결제합니다</p>
        </div>

        {toast && (
          <div className="pay-toast" role="alert">{toast}</div>
        )}
      </div>
    </div>
  )
}
