import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const PRODUCTS = [
  {
    code: 'PERSONAL_COLOR_DIAGNOSIS',
    title: '퍼스널 컬러 진단',
    description: '내 피부톤에 맞는 컬러와 스타일을 찾아드립니다.',
    icon: '🎨',
  },
]

export default function HomePage() {
  const navigate = useNavigate()
  const [loadingCode, setLoadingCode] = useState(null)

  const handleSelect = async (code) => {
    setLoadingCode(code)
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
      setLoadingCode(null)
    }
  }

  return (
    <div className="page">
      <h1 className="title">StyleFit</h1>
      <p className="subtitle">원하는 진단을 선택하세요</p>

      <div className="product-list">
        {PRODUCTS.map(p => (
          <button
            key={p.code}
            className="product-card"
            onClick={() => handleSelect(p.code)}
            disabled={loadingCode === p.code}
          >
            <span className="product-icon">{p.icon}</span>
            <div className="product-info">
              <p className="product-title">{p.title}</p>
              <p className="product-desc">{p.description}</p>
            </div>
            <span className="product-arrow">
              {loadingCode === p.code ? '...' : '›'}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
