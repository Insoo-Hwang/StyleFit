import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './MenuPage.css'

const MENU_ITEMS = [
  {
    key: 'personal-color',
    title: '퍼스널 컬러 진단',
    tag: '3장 사진',
    desc: '내 피부톤에 맞는 컬러와 스타일을 찾아드려요.',
    soon: false,
    icon: (
      <svg viewBox="0 0 32 32" fill="none">
        <path
          d="M16 4C9.4 4 4 8.9 4 15c0 3.6 3.1 6 6 6 1.7 0 2-1 2-2 0-1.4-1-2-1-3 0-1.1.9-2 2-2h3c5 0 9-3.1 9-7 0-1.7-3.1-3-9-3z"
          stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"
        />
        <circle cx="9.5" cy="13" r="1.2" fill="currentColor" />
        <circle cx="13" cy="9" r="1.2" fill="currentColor" />
        <circle cx="18" cy="8" r="1.2" fill="currentColor" />
        <circle cx="22" cy="11" r="1.2" fill="currentColor" />
      </svg>
    ),
  },
  {
    key: 'hair',
    title: '헤어스타일 추천',
    tag: '준비 중',
    desc: '얼굴형·이미지에 어울리는 헤어를 제안합니다.',
    soon: true,
    icon: (
      <svg viewBox="0 0 32 32" fill="none">
        <circle cx="9" cy="22" r="4" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="23" cy="22" r="4" stroke="currentColor" strokeWidth="1.5" />
        <line x1="12" y1="19" x2="25" y2="6" stroke="currentColor" strokeWidth="1.5" />
        <line x1="20" y1="19" x2="7" y2="6" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    key: 'outfit',
    title: '코디 추천',
    tag: '준비 중',
    desc: '상황과 무드에 맞는 옷차림을 골라드려요.',
    soon: true,
    icon: (
      <svg viewBox="0 0 32 32" fill="none">
        <path
          d="M11 10c0-2.8 2.2-5 5-5s5 2.2 5 5c0 1.7-1.3 3-3 3"
          stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
        />
        <path
          d="M16 13l-12 9c-1 .8-.5 2 .8 2h22.4c1.3 0 1.8-1.2.8-2L16 13z"
          stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    key: 'frame',
    title: '안경테 추천',
    tag: '준비 중',
    desc: '얼굴형에 어울리는 프레임을 찾아보세요.',
    soon: true,
    icon: (
      <svg viewBox="0 0 32 32" fill="none">
        <circle cx="9" cy="18" r="5" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="23" cy="18" r="5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M14 18h4" stroke="currentColor" strokeWidth="1.5" />
        <path d="M4 14l3-4M28 14l-3-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
]

export default function MenuPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)

  const handleSelect = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/analysis/start', { method: 'POST' })
      const data = await res.json()
      if (data.status === 'COMPLETED') {
        navigate('/result', { state: { result: data.result, reportImageUrl: data.reportImageUrl } })
      } else {
        navigate('/upload')
      }
    } catch {
      navigate('/upload')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="menu-body">
      <div className="menu-frame">
        <main className="menu-page">
          <header className="menu-head">
            <h1 className="menu-brand" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
              STYLE<span className="dot">.</span>
              <span className="em-en">menu</span>
            </h1>
            <p className="menu-lede">원하는 진단을 골라주세요.</p>
          </header>

          <div className="menu-section-title">진 단 메 뉴</div>

          <nav className="menu-list" aria-label="진단 메뉴">
            {MENU_ITEMS.map(item => (
              item.soon ? (
                <div key={item.key} className="menu-item is-soon">
                  <div className="menu-item-icon" aria-hidden="true">{item.icon}</div>
                  <div className="menu-item-body">
                    <div className="menu-item-title-row">
                      <h2 className="menu-item-title">{item.title}</h2>
                      <span className="menu-item-tag soon">{item.tag}</span>
                    </div>
                    <p className="menu-item-desc">{item.desc}</p>
                  </div>
                  <span className="menu-chev" aria-hidden="true">›</span>
                </div>
              ) : (
                <button
                  key={item.key}
                  className="menu-item"
                  onClick={handleSelect}
                  disabled={loading}
                >
                  <div className="menu-item-icon" aria-hidden="true">{item.icon}</div>
                  <div className="menu-item-body">
                    <div className="menu-item-title-row">
                      <h2 className="menu-item-title">{item.title}</h2>
                      <span className="menu-item-tag">{item.tag}</span>
                    </div>
                    <p className="menu-item-desc">{item.desc}</p>
                  </div>
                  <span className="menu-chev" aria-hidden="true">
                    {loading ? '…' : '›'}
                  </span>
                </button>
              )
            ))}

            <div className="menu-add-hint" aria-hidden="true">
              <span className="plus">+</span> 진단 항목은 계속 추가될 예정이에요.
            </div>
          </nav>
        </main>
      </div>
    </div>
  )
}
