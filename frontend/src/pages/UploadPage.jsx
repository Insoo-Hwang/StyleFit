import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import './UploadPage.css'

const MAX = 3
const MAX_DIM = 1280

// 업로드 전에 이미지를 캔버스로 리사이즈/JPEG 압축
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
  const [photos, setPhotos] = useState([])   // { file, url }[]
  const [warnings, setWarnings] = useState([])
  const [uploading, setUploading] = useState(false)
  const [isDrag, setIsDrag] = useState(false)
  const fileInputRef = useRef(null)

  const addFiles = (fileList) => {
    const incoming = Array.from(fileList)
      .filter(f => f.type.startsWith('image/'))
      .slice(0, MAX - photos.length)
    if (incoming.length === 0) return
    setPhotos(prev => [...prev, ...incoming.map(f => ({ file: f, url: URL.createObjectURL(f) }))])
    setWarnings([])
  }

  const removePhoto = (i) => {
    setPhotos(prev => prev.filter((_, idx) => idx !== i))
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDrag(false)
    if (e.dataTransfer?.files) addFiles(e.dataTransfer.files)
  }

  const handleSubmit = async () => {
    if (photos.length === 0 || uploading) return
    setUploading(true)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 60000)

    try {
      const resized = await Promise.all(photos.map(p => resizeImage(p.file)))
      const formData = new FormData()
      resized.forEach(f => formData.append('files', f))

      const res = await fetch('/api/analysis/submit-photo', { method: 'POST', body: formData, signal: controller.signal })
      clearTimeout(timeout)

      if (res.status === 409) {
        setWarnings(['이미 처리 중입니다. 잠시 후 다시 시도해주세요.'])
        setUploading(false)
        return
      }

      const data = await res.json()

      if (data.status === 'COMPLETED') {
        navigate('/result', { state: { result: data.result, reportImageUrl: data.reportImageUrl } })
      } else if (data.status === 'VALIDATION_FAILED') {
        setWarnings(data.validationWarnings ?? [])
        setPhotos([])
        setUploading(false)
        if (fileInputRef.current) fileInputRef.current.value = ''
      } else {
        setWarnings(['오류가 발생했습니다. 다시 시도해주세요.'])
        setUploading(false)
      }
    } catch {
      clearTimeout(timeout)
      setWarnings(['서버에 문제가 발생했습니다. 잠시 후 다시 시도해주세요.'])
      setUploading(false)
    }
  }

  const canSubmit = photos.length > 0 && !uploading

  return (
    <div className="upload-body">
      <div className="upload-frame">
        <main className="upload-page">

          {uploading ? (
            <div className="upload-loading">
              <div className="upload-spinner" />
              <p className="upload-loading-text">사진을 분석하고 있습니다…</p>
              <p className="upload-loading-sub">잠시만 기다려주세요</p>
            </div>
          ) : (
            <>
              <header className="upload-head">
                <div className="upload-top-row">
                  <button
                    className="upload-back"
                    onClick={() => navigate('/home')}
                    aria-label="뒤로"
                  >
                    ←
                  </button>
                  <span>back to menu</span>
                </div>
                <h1 className="upload-brand" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>STYLE<span className="dot">.</span></h1>
                <p className="upload-crumb">— 퍼스널 컬러 진단 —</p>
              </header>

              <div className="upload-section-title">사 진 첨 부</div>

              {/* Drop zone */}
              <div
                className={`upload-drop${isDrag ? ' is-drag' : ''}`}
                onClick={() => fileInputRef.current?.click()}
                onDragEnter={(e) => { e.preventDefault(); setIsDrag(true) }}
                onDragOver={(e) => { e.preventDefault(); setIsDrag(true) }}
                onDragLeave={(e) => { e.preventDefault(); setIsDrag(false) }}
                onDrop={handleDrop}
              >
                <div className="upload-drop-icon" aria-hidden="true">
                  <svg viewBox="0 0 40 40" fill="none">
                    <rect x="5" y="12" width="30" height="22" rx="3" stroke="currentColor" strokeWidth="1.6" />
                    <rect x="15" y="8" width="10" height="4" stroke="currentColor" strokeWidth="1.6" />
                    <circle cx="20" cy="23" r="6" stroke="currentColor" strokeWidth="1.6" />
                    <circle cx="20" cy="23" r="2" fill="currentColor" />
                    <circle cx="30" cy="17" r="1" fill="currentColor" />
                  </svg>
                </div>
                <p className="upload-drop-title">
                  사진을 선택하세요 <em>최대 {MAX}장</em>
                </p>
                <p className="upload-drop-hint">탭하거나 끌어다 놓으세요.</p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(e) => { addFiles(e.target.files); e.target.value = '' }}
              />

              {/* Photo grid */}
              <div className="upload-grid">
                {Array.from({ length: MAX }).map((_, i) => (
                  photos[i] ? (
                    <div key={i} className="upload-thumb">
                      <img src={photos[i].url} alt={`첨부 사진 ${i + 1}`} />
                      <span className="upload-thumb-num">{i + 1}</span>
                      <button
                        className="upload-thumb-rm"
                        onClick={(e) => { e.stopPropagation(); removePhoto(i) }}
                        aria-label={`사진 ${i + 1} 삭제`}
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <div
                      key={i}
                      className="upload-thumb empty"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      +
                    </div>
                  )
                ))}
              </div>

              {/* Warnings */}
              {warnings.length > 0 && (
                <div className="upload-warning">
                  {warnings.map((w, i) => <p key={i}>⚠ {w}</p>)}
                </div>
              )}

              {/* Tips */}
              <aside className="upload-tips" aria-label="촬영 팁">
                <ul>
                  <li>자연광에서 정면 얼굴이 잘 보이게.</li>
                  <li>화장은 옅게, 머리는 이마가 보이도록.</li>
                  <li>한 장 이상 첨부하면 분석을 시작할 수 있어요.</li>
                </ul>
              </aside>

              {/* CTA */}
              <div className="upload-cta-wrap">
                <button
                  className="upload-cta"
                  type="button"
                  disabled={!canSubmit}
                  onClick={handleSubmit}
                >
                  분석 시작하기
                  {canSubmit && <span className="upload-cta-arrow">→</span>}
                </button>
                <div className="upload-helper">
                  {photos.length > 0
                    ? `${photos.length}/${MAX}장 첨부됨 — 분석 준비 완료`
                    : '사진을 1장 이상 첨부해 주세요.'}
                </div>
              </div>
            </>
          )}

        </main>
      </div>
    </div>
  )
}
