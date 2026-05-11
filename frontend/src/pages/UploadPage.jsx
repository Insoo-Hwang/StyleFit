import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useReportCheck from '../hooks/useReportCheck.jsx'
import './UploadPage.css'

const MAX_DIM = 1280
const MAX_BYTES = 10 * 1024 * 1024            // 10MB
const ACCEPTED_TYPES = ['image/jpeg', 'image/png']
const ACCEPTED_EXT = /\.(jpe?g|png)$/i

async function resizeImage(file) {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = () => reject(new Error('이미지 로드 실패'))
      i.src = url
    })
    let { width, height } = img
    if (width > MAX_DIM || height > MAX_DIM) {
      const scale = Math.min(MAX_DIM / width, MAX_DIM / height)
      width = Math.round(width * scale)
      height = Math.round(height * scale)
    }
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    canvas.getContext('2d').drawImage(img, 0, 0, width, height)
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(b => b ? resolve(b) : reject(new Error('canvas.toBlob 실패')), 'image/jpeg', 0.85)
    })
    return new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' })
  } finally {
    URL.revokeObjectURL(url)
  }
}

export default function UploadPage() {
  const navigate = useNavigate()
  const [photo, setPhoto] = useState(null)   // { file, url } | null
  const [isDrag, setIsDrag] = useState(false)
  const [warning, setWarning] = useState('')
  const fileInputRef = useRef(null)
  const { checkReport, dialog } = useReportCheck()

  const setFile = (file) => {
    setPhoto(prev => {
      if (prev) URL.revokeObjectURL(prev.url)
      return { file, url: URL.createObjectURL(file) }
    })
    setWarning('')
  }

  const addFiles = (fileList) => {
    const incoming = Array.from(fileList)[0]
    if (!incoming) return

    const typeOk = ACCEPTED_TYPES.includes(incoming.type) || ACCEPTED_EXT.test(incoming.name)
    if (!typeOk) {
      setWarning('JPG 또는 PNG 형식의 사진만 업로드할 수 있어요.')
      return
    }
    if (incoming.size > MAX_BYTES) {
      const mb = (incoming.size / 1024 / 1024).toFixed(1)
      setWarning(`사진 용량은 최대 10MB까지 가능해요. (현재 ${mb}MB)`)
      return
    }

    setFile(incoming)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDrag(false)
    if (e.dataTransfer?.files) addFiles(e.dataTransfer.files)
  }

  const handleSubmit = async () => {
    if (!photo) return

    // 한 번 진단 받은 사용자는 다시 분석하지 않고 DB에 저장된 결과를 바로 보여준다
    try {
      const r = await fetch('/api/analysis/start', { method: 'POST' })
      const data = await r.json()
      if (data.status === 'COMPLETED') {
        navigate('/result', {
          state: { result: data.result, reportImageUrl: data.reportImageUrl },
        })
        return
      }
    } catch {
      // 선체크 실패해도 일반 흐름으로 계속 진행
    }

    try {
      const resized = await resizeImage(photo.file)
      navigate('/loading', { state: { file: resized } })
    } catch {
      navigate('/error', { state: { warnings: ['이미지 처리 중 문제가 발생했습니다. 다른 사진으로 시도해주세요.'] } })
    }
  }

  const canSubmit = !!photo

  return (
    <div className="up-frame" data-screen-label="Upload">
      {dialog}
      <header className="up-topnav">
        <span />
        <h1 className="up-title">사진 업로드</h1>
        <span />
      </header>

      <div className="up-steps">
        <div className="up-step active"><span className="up-dot">1</span>사진 업로드</div>
        <span className="up-line" />
        <div className="up-step"><span className="up-dot">2</span>AI 분석</div>
        <span className="up-line" />
        <div className="up-step"><span className="up-dot">3</span>결과 확인</div>
      </div>

      <label
        className={`up-drop${isDrag ? ' is-drag' : ''}`}
        onDragEnter={(e) => { e.preventDefault(); setIsDrag(true) }}
        onDragOver={(e) => { e.preventDefault(); setIsDrag(true) }}
        onDragLeave={(e) => { e.preventDefault(); setIsDrag(false) }}
        onDrop={handleDrop}
      >
        {photo ? (
          <div className="up-preview">
            <img src={photo.url} alt="첨부 사진" />
            <button
              className="up-preview-rm"
              type="button"
              aria-label="사진 삭제"
              onClick={(e) => {
                e.preventDefault()
                setPhoto(prev => { if (prev) URL.revokeObjectURL(prev.url); return null })
                if (fileInputRef.current) fileInputRef.current.value = ''
              }}
            >×</button>
          </div>
        ) : (
          <>
            <span className="up-drop-ico" aria-hidden="true">
              <svg viewBox="0 0 40 40" fill="none">
                <rect x="5" y="12" width="30" height="22" rx="3" stroke="currentColor" strokeWidth="1.6" />
                <rect x="15" y="8" width="10" height="4" stroke="currentColor" strokeWidth="1.6" />
                <circle cx="20" cy="23" r="6" stroke="currentColor" strokeWidth="1.6" />
                <circle cx="20" cy="23" r="2" fill="currentColor" />
              </svg>
            </span>
            <h2>사진을 업로드하세요</h2>
            <p className="up-hint">탭하여 갤러리에서 선택</p>
            <p className="up-or">또는 카메라로 바로 촬영</p>
          </>
        )}
        <input
          ref={fileInputRef}
          className="up-file-input"
          type="file"
          accept="image/jpeg,image/png,.jpg,.jpeg,.png"
          onChange={(e) => { addFiles(e.target.files); e.target.value = '' }}
        />
      </label>
      <div className="up-meta-row">JPG · PNG · 최대 10MB</div>
      {warning && <div className="up-warn-row">⚠ {warning}</div>}

      <aside className="up-priv">
        <span className="up-lock" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <rect x="5" y="10" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.6" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.6" />
          </svg>
        </span>
        <div>
          업로드한 사진은 분석 후 즉시 삭제되며, 외부에 공유되지 않습니다.<br />
          <a href="#">개인정보 처리방침 보기 →</a>
        </div>
      </aside>

      <div className="up-cta-block">
        <button
          className="up-cta"
          type="button"
          disabled={!canSubmit}
          onClick={handleSubmit}
        >
          분석 시작하기 <span className="up-cta-arrow">→</span>
        </button>
      </div>

      <div className="up-section-title">
        <span className="up-em">📋 좋은 사진 조건</span>
      </div>
      <div className="up-guide">
        <div className="up-gcard">
          <div className="up-htitle"><span className="up-mark">✓</span>이런 사진</div>
          <div className="up-gphoto">
            <svg viewBox="0 0 40 40" fill="none">
              <path d="M8 21l8 8 16-18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <ul>
            <li>정면 얼굴이 잘 보이는 사진</li>
            <li>자연광 또는 밝은 실내</li>
            <li>필터/보정 없는 사진</li>
          </ul>
        </div>
        <div className="up-gcard bad">
          <div className="up-htitle"><span className="up-mark">×</span>피해야 할 사진</div>
          <div className="up-gphoto">
            <svg viewBox="0 0 40 40" fill="none">
              <line x1="10" y1="10" x2="30" y2="30" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
              <line x1="30" y1="10" x2="10" y2="30" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
            </svg>
          </div>
          <ul>
            <li>선글라스·마스크 착용</li>
            <li>너무 어둡거나 역광</li>
            <li>여러 명이 찍힌 사진</li>
          </ul>
        </div>
      </div>

      <nav className="up-tabbar" aria-label="탭바">
        <div className="up-tabbar-inner">
          <button className="up-tab" type="button" onClick={() => navigate('/')}>
            <span className="up-tico"><svg viewBox="0 0 24 24" fill="none"><path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1v-9z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg></span>홈
          </button>
          <button className="up-tab active up-cta-tab" type="button">
            <span className="up-tico"><svg viewBox="0 0 24 24" fill="none"><rect x="4" y="6" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" /><circle cx="12" cy="13" r="3.5" stroke="currentColor" strokeWidth="1.8" /></svg></span>진단하기
          </button>
          <button className="up-tab" type="button" onClick={checkReport}>
            <span className="up-tico"><svg viewBox="0 0 24 24" fill="none"><rect x="5" y="4" width="14" height="17" rx="2" stroke="currentColor" strokeWidth="1.6" /><line x1="8" y1="9" x2="16" y2="9" stroke="currentColor" strokeWidth="1.6" /><line x1="8" y1="13" x2="14" y2="13" stroke="currentColor" strokeWidth="1.6" /></svg></span>내 리포트
          </button>
        </div>
      </nav>
    </div>
  )
}
