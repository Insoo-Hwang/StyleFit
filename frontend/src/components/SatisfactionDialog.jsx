import { useEffect, useState } from 'react'
import './SatisfactionDialog.css'

const COMMENT_MAX = 300

function Star({ filled, onClick, index }) {
  return (
    <button
      type="button"
      className={`sd-star${filled ? ' on' : ''}`}
      onClick={() => onClick(index)}
      aria-label={`${index}점`}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 2.5l2.95 6.3 6.8.8-5.05 4.7 1.4 6.8L12 17.7l-6.1 3.4 1.4-6.8L2.25 9.6l6.8-.8L12 2.5z" />
      </svg>
    </button>
  )
}

export default function SatisfactionDialog({
  open,
  isEdit,
  initialRating = 0,
  initialGender = null,
  initialComment = '',
  submitting = false,
  onClose,
  onSubmit,
}) {
  const [rating, setRating] = useState(initialRating)
  const [gender, setGender] = useState(initialGender)
  const [comment, setComment] = useState(initialComment)

  // 다이얼로그가 새로 열릴 때마다 초기값을 동기화
  useEffect(() => {
    if (open) {
      setRating(initialRating)
      setGender(initialGender)
      setComment(initialComment)
    }
  }, [open, initialRating, initialGender, initialComment])

  if (!open) return null

  const canSubmit = rating >= 1 && rating <= 5 && (gender === 'MALE' || gender === 'FEMALE') && !submitting

  const handleCommentChange = (e) => {
    const v = e.target.value
    if (v.length <= COMMENT_MAX) setComment(v)
    else setComment(v.slice(0, COMMENT_MAX))
  }

  const handleSubmit = () => {
    if (!canSubmit) return
    onSubmit({ rating, gender, comment: comment.trim() })
  }

  return (
    <div className="sd-backdrop" role="dialog" aria-modal="true" aria-labelledby="sd-title" onClick={onClose}>
      <div className="sd-card" onClick={(e) => e.stopPropagation()}>
        <h2 id="sd-title" className="sd-title">
          {isEdit ? '평가 수정하기' : '리포트가 도움이 되셨나요?'}
        </h2>
        <p className="sd-sub">
          {isEdit
            ? '이전에 작성하신 평가를 수정할 수 있어요.'
            : '별점을 남기고, 어떤 점이 좋았는지 / 아쉬웠는지 자유롭게 알려주세요.'}
        </p>

        <div className="sd-stars" role="radiogroup" aria-label="별점">
          {[1, 2, 3, 4, 5].map((i) => (
            <Star key={i} index={i} filled={i <= rating} onClick={setRating} />
          ))}
        </div>
        <p className="sd-rating-label">
          {rating > 0 ? `${rating} / 5` : '별점을 선택해주세요'}
        </p>

        <div className="sd-gender" role="radiogroup" aria-label="성별">
          <button
            type="button"
            className={`sd-gender-btn${gender === 'MALE' ? ' on' : ''}`}
            onClick={() => setGender('MALE')}
            aria-pressed={gender === 'MALE'}
          >남자</button>
          <button
            type="button"
            className={`sd-gender-btn${gender === 'FEMALE' ? ' on' : ''}`}
            onClick={() => setGender('FEMALE')}
            aria-pressed={gender === 'FEMALE'}
          >여자</button>
        </div>

        <label className="sd-ta-label">
          <span>의견 (선택)</span>
          <span className="sd-counter">{comment.length} / {COMMENT_MAX}</span>
        </label>
        <textarea
          className="sd-ta"
          rows={5}
          maxLength={COMMENT_MAX}
          value={comment}
          onChange={handleCommentChange}
          placeholder="어떤 점이 좋았고, 어떤 점이 아쉬웠는지 자유롭게 적어주세요."
        />

        <div className="sd-actions">
          <button type="button" className="sd-btn ghost" onClick={onClose} disabled={submitting}>
            취소
          </button>
          <button
            type="button"
            className="sd-btn primary"
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {submitting ? '저장 중…' : (isEdit ? '수정 완료' : '제출하기')}
            {!submitting && <span className="sd-arrow">→</span>}
          </button>
        </div>
      </div>
    </div>
  )
}
