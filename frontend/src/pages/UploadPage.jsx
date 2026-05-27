import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useReportCheck from '../hooks/useReportCheck.jsx'
import { trackEvent } from '../analytics'
import './UploadPage.css'

const MAX_DIM = 1280
const MAX_BYTES = 10 * 1024 * 1024            // 10MB
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/heic', 'image/heif']
const ACCEPTED_EXT = /\.(jpe?g|png|heic|heif)$/i

async function resizeImage(file) {
  let sourceFile = file

  // HEIC/HEIF(iPhone 자체 포맷) → JPEG 변환 (Chrome/Firefox는 HEIC 디코딩 불가)
  const isHeic = file.type === 'image/heic' || file.type === 'image/heif'
    || /\.(heic|heif)$/i.test(file.name)
  if (isHeic) {
    const { default: heic2any } = await import('heic2any')
    const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.85 })
    const resultBlob = Array.isArray(converted) ? converted[0] : converted
    sourceFile = new File([resultBlob], file.name.replace(/\.(heic|heif)$/i, '.jpg'), { type: 'image/jpeg' })
  }

  const url = URL.createObjectURL(sourceFile)
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
    const baseName = sourceFile.name.replace(/\.[^.]+$/, '')
    return new File([blob], baseName + '.jpg', { type: 'image/jpeg' })
  } finally {
    URL.revokeObjectURL(url)
  }
}

export default function UploadPage() {
  const navigate = useNavigate()
  const [photo, setPhoto] = useState(null)   // { file, url } | null
  const [isDrag, setIsDrag] = useState(false)
  const [warning, setWarning] = useState('')
  const [banned, setBanned] = useState(false)
  const [gender, setGender] = useState(null) // 'male' | 'female' | 'unisex'
  const fileInputRef = useRef(null)
  const { checkReport, dialog } = useReportCheck('upload_tabbar')

  // 사진 처음 첨부된 시각 (망설임 시간 측정용)
  const attachedAtRef = useRef(null)
  // 세션 내 사진 교체 횟수
  const replacedCountRef = useRef(0)

  // 차단된 쿠키/IP 사용자는 업로드 진입 자체를 막는다.
  useEffect(() => {
    let cancelled = false
    fetch('/api/ban/check', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (cancelled || !data) return
        if (data.banned) {
          setBanned(true)
          trackEvent('ban_blocked', { location: 'upload_mount' })
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  const setFile = (file) => {
    setPhoto(prev => {
      if (prev) {
        URL.revokeObjectURL(prev.url)
        // 이미 사진이 있던 상태에서 새 사진으로 바꾸면 교체로 카운트
        replacedCountRef.current += 1
        trackEvent('photo_replaced', { count: replacedCountRef.current })
      } else {
        // 처음 첨부 — 망설임 시간 측정 시작
        attachedAtRef.current = Date.now()
      }
      return { file, url: URL.createObjectURL(file) }
    })
    setWarning('')
  }

  const addFiles = (fileList) => {
    const incoming = Array.from(fileList)[0]
    if (!incoming) return

    const typeOk = ACCEPTED_TYPES.includes(incoming.type) || ACCEPTED_EXT.test(incoming.name)
    if (!typeOk) {
      trackEvent('photo_rejected_client', { reason: 'mime_or_ext', file_type: incoming.type || 'unknown' })
      setWarning('JPG, PNG, HEIC 형식의 사진만 업로드할 수 있어요.')
      return
    }
    if (incoming.size > MAX_BYTES) {
      const mb = (incoming.size / 1024 / 1024).toFixed(1)
      trackEvent('photo_rejected_client', { reason: 'size', size_mb: Number(mb) })
      setWarning(`사진 용량은 최대 10MB까지 가능해요. (현재 ${mb}MB)`)
      return
    }

    trackEvent('photo_selected', { size_kb: Math.round(incoming.size / 1024) })
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
        trackEvent('analysis_reused', { source: 'upload_submit' })
        navigate('/result', {
          state: { result: data.result, reportImageUrl: data.reportImageUrl, reportImageCached: data.reportImageCached },
        })
        return
      }
    } catch {
      // 선체크 실패해도 일반 흐름으로 계속 진행
    }

    // 망설임 시간 + 교체 카운트 기록 (서버 + GA) — 제출 직전에만 보낸다
    const dwellMs = attachedAtRef.current ? Date.now() - attachedAtRef.current : null
    if (dwellMs != null) {
      trackEvent('photo_dwell_time', { elapsed_ms: dwellMs, replaced: replacedCountRef.current })
      fetch('/api/user-behavior/photo-dwell', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ms: dwellMs }),
      }).catch(() => {})
    }
    fetch('/api/user-behavior/photo-replaced', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count: replacedCountRef.current }),
    }).catch(() => {})

    try {
      const resized = await resizeImage(photo.file)
      trackEvent('analysis_submitted', { resized_kb: Math.round(resized.size / 1024), gender: gender ?? 'unisex' })
      navigate('/loading', { state: { file: resized, gender: gender ?? 'unisex' } })
    } catch {
      trackEvent('photo_resize_failed')
      navigate('/error', { state: { warnings: ['이미지 처리 중 문제가 발생했습니다. 다른 사진으로 시도해주세요.'] } })
    }
  }

  const canSubmit = !!photo && !banned && !!gender

  if (banned) {
    return (
      <div className="up-frame" data-screen-label="Upload-Banned">
        <header className="up-topnav">
          <span />
          <h1 className="up-title">사진 업로드</h1>
          <span />
        </header>
        <div className="up-banned">
          <div className="up-banned-ico" aria-hidden="true">
            <svg viewBox="0 0 64 64" fill="none">
              <circle cx="32" cy="32" r="26" stroke="currentColor" strokeWidth="3" />
              <line x1="14" y1="14" x2="50" y2="50" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </div>
          <h2>이용이 제한된 사용자입니다</h2>
          <p>현재 계정 또는 접속 환경에서는 사진 업로드를 이용할 수 없어요.<br />문의가 필요하시면 운영팀에 연락해 주세요.</p>
          <button className="up-cta" type="button" onClick={() => navigate('/')}>
            홈으로 돌아가기
          </button>
        </div>
        <nav className="up-tabbar" aria-label="탭바">
          <div className="up-tabbar-inner">
            <button className="up-tab" type="button" onClick={() => navigate('/')}>
              <span className="up-tico"><svg viewBox="0 0 24 24" fill="none"><path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1v-9z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg></span>홈
            </button>
            <button className="up-tab active up-cta-tab" type="button" disabled>
              <span className="up-tico"><svg viewBox="0 0 24 24" fill="none"><rect x="4" y="6" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" /><circle cx="12" cy="13" r="3.5" stroke="currentColor" strokeWidth="1.8" /></svg></span>진단하기
            </button>
            <button className="up-tab" type="button" onClick={checkReport}>
              <span className="up-tico"><svg viewBox="0 0 24 24" fill="none"><rect x="5" y="4" width="14" height="17" rx="2" stroke="currentColor" strokeWidth="1.6" /><line x1="8" y1="9" x2="16" y2="9" stroke="currentColor" strokeWidth="1.6" /><line x1="8" y1="13" x2="14" y2="13" stroke="currentColor" strokeWidth="1.6" /></svg></span>내 리포트
            </button>
          </div>
        </nav>
        {dialog}
      </div>
    )
  }

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

      <div className="up-gender">
        <span className="up-gender-label">성별</span>
        <div className="up-gender-btns">
          {[['male', '남'], ['female', '여'], ['unisex', '미선택']].map(([v, label]) => (
            <button
              key={v}
              type="button"
              className={`up-gender-btn${gender === v ? ' active' : ''}`}
              onClick={() => setGender(v)}
            >
              {label}
            </button>
          ))}
        </div>
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
          accept="image/jpeg,image/png,image/heic,image/heif,.jpg,.jpeg,.png,.heic,.heif"
          onChange={(e) => { addFiles(e.target.files); e.target.value = '' }}
        />
      </label>
      <div className="up-meta-row">JPG · PNG · HEIC · 최대 10MB</div>
      {warning && <div className="up-warn-row">⚠ {warning}</div>}

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
