import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import Spinner from '../components/Spinner.jsx'

const MAX_FILES = 3

export default function UploadPage() {
  const navigate = useNavigate()
  const [files, setFiles] = useState([])
  const [previews, setPreviews] = useState([])
  const [warnings, setWarnings] = useState([])
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef(null)

  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files).slice(0, MAX_FILES)
    setFiles(selected)
    setPreviews(selected.map(f => URL.createObjectURL(f)))
    setWarnings([])
  }

  const removeFile = (index) => {
    const nextFiles = files.filter((_, i) => i !== index)
    setFiles(nextFiles)
    setPreviews(nextFiles.map(f => URL.createObjectURL(f)))
  }

  const handleSubmit = async () => {
    if (files.length === 0) return
    setUploading(true)

    const formData = new FormData()
    files.forEach(f => formData.append('files', f))

    try {
      const res = await fetch('/api/analysis/submit-photo', { method: 'POST', body: formData })

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
        setFiles([])
        setPreviews([])
        setUploading(false)
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
    } catch {
      setWarnings(['서버 연결에 실패했습니다.'])
      setUploading(false)
    }
  }

  if (uploading) {
    return (
      <div className="center-screen">
        <Spinner />
        <p className="muted">사진을 분석하고 있습니다...</p>
        <p className="muted small">잠시만 기다려주세요</p>
      </div>
    )
  }

  return (
    <div className="page">
      <h1 className="title">StyleFit</h1>
      <p className="subtitle">퍼스널 컬러 진단</p>

      {warnings.length > 0 && (
        <div className="warning-box">
          {warnings.map((w, i) => <p key={i}>⚠ {w}</p>)}
        </div>
      )}

      <div className="upload-area" onClick={() => fileInputRef.current?.click()}>
        <span className="upload-icon">📷</span>
        <p>사진을 선택하세요 (최대 {MAX_FILES}장)</p>
        <p className="small muted">클릭하여 업로드</p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={handleFileChange}
        />
      </div>

      {previews.length > 0 && (
        <div className="preview-grid">
          {previews.map((src, i) => (
            <div key={i} className="preview-item">
              <img src={src} alt={`미리보기 ${i + 1}`} />
              <button className="remove-btn" onClick={() => removeFile(i)}>✕</button>
              <span className="photo-badge">{i + 1}</span>
            </div>
          ))}
        </div>
      )}

      <button className="submit-btn" disabled={files.length === 0} onClick={handleSubmit}>
        분석 시작하기 {files.length > 0 && `(${files.length}장)`}
      </button>
    </div>
  )
}
