import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './AdminPage.css'

const TABS = [
  { key: 'satisfaction', label: '만족도', path: '/api/admin/stats/satisfaction' },
  { key: 'purchase-intent', label: '결제 의향', path: '/api/admin/stats/purchase-intent' },
  { key: 'behavior', label: '행동 신호', path: '/api/admin/stats/behavior' },
  { key: 'banned', label: '차단', path: '/api/admin/stats/banned' },
  { key: 'shares', label: '공유 토큰', path: '/api/admin/stats/shares' },
]

function formatDt(dt) {
  if (!dt) return '-'
  const d = new Date(dt)
  if (Number.isNaN(d.getTime())) return String(dt)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function LoginForm({ onLogin }) {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (!res.ok) {
        setError(res.status === 401 ? '비밀번호가 올바르지 않습니다.' : '로그인 실패')
        return
      }
      onLogin()
    } catch {
      setError('네트워크 오류')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="ap-login-wrap">
      <form className="ap-login" onSubmit={submit}>
        <h1>StyleFit Admin</h1>
        <p className="ap-login-sub">운영자 비밀번호를 입력하세요</p>
        <input
          type="password"
          autoComplete="current-password"
          placeholder="비밀번호"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
        />
        {error && <div className="ap-login-err">{error}</div>}
        <button type="submit" disabled={busy || !password}>
          {busy ? '확인 중...' : '로그인'}
        </button>
      </form>
    </div>
  )
}

function StatCard({ title, value, sub }) {
  return (
    <div className="ap-card">
      <div className="ap-card-title">{title}</div>
      <div className="ap-card-value">{value}</div>
      {sub && <div className="ap-card-sub">{sub}</div>}
    </div>
  )
}

function FunnelSection({ data }) {
  if (!data) return <div className="ap-loading">집계 중...</div>
  const a = data.analysis || {}
  const total = a.uniqueUsers || 0

  const rows = [
    { label: '하다만 (미완료)', count: a.abandoned ?? 0, color: '#c0392b' },
    { label: '기본 리포트만 봄', count: a.completedBasicOnly ?? 0, color: '#d4820a' },
    { label: '리포트 이미지까지 봄', count: a.completedWithImage ?? 0, color: '#2a8f4a' },
  ]

  return (
    <div className="ap-table-wrap">
      <table className="ap-table">
        <thead>
          <tr><th>단계</th><th>사용자 수</th><th>비율</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const pct = total === 0 ? 0 : Math.round(r.count * 1000 / total) / 10
            return (
              <tr key={r.label}>
                <td>{r.label}</td>
                <td>{r.count}명</td>
                <td>
                  <div className="ap-rate-cell">
                    <div className="ap-rate-bar-wrap">
                      <div className="ap-rate-bar-fill" style={{ width: `${pct}%`, background: r.color }} />
                    </div>
                    <span className="ap-rate-pct">{pct}%</span>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function SummaryGrid({ data }) {
  if (!data) return <div className="ap-loading">집계 중...</div>
  const a = data.analysis || {}
  const s = data.survey || {}
  const p = data.purchase || {}
  const b = data.behavior || {}
  const sh = data.share || {}
  const bn = data.banned || {}
  const q = data.quota || {}
  return (
    <div className="ap-summary">
      <StatCard title="총 진단 사용자" value={a.uniqueUsers ?? 0}
        sub={`미완료 ${a.abandoned ?? 0} / 기본리포트 ${a.completedBasicOnly ?? 0} / 이미지 ${a.completedWithImage ?? 0}`} />
      <StatCard title="오늘 완료 진단" value={a.todayCompleted ?? 0} />
      <StatCard title="만족도 평균" value={s.avgRating?.toFixed?.(2) ?? '0'}
        sub={`총 ${s.count ?? 0}건 (남 ${s.male ?? 0} / 여 ${s.female ?? 0}, 코멘트 ${s.withComment ?? 0})`} />
      <StatCard title="결제 의향 YES 비율" value={`${p.yesRate ?? 0}%`}
        sub={`YES ${p.yes ?? 0} / NO ${p.no ?? 0} (다이얼로그 총 ${p.totalDialogs ?? 0}회)`} />
      <StatCard title="평균 스크롤 도달" value={b.avgMaxScrollIndex ?? 0}
        sub={`사진 망설임 평균 ${b.avgPhotoDwellMs ?? 0}ms / 총 검증실패 ${b.totalFailedAttempts ?? 0}`} />
      <StatCard title="결과 페이지 재방문" value={b.totalResultRevisit ?? 0}
        sub={`행동 신호 기록 ${b.count ?? 0}명`} />
      <StatCard title="공유 토큰" value={sh.active ?? 0}
        sub={`전체 ${sh.total ?? 0} / 폐기 ${sh.revoked ?? 0}`} />
      <StatCard title="차단 사용자" value={bn.count ?? 0} />
      <StatCard title="오늘 AI 호출"
        value={`${q.today ?? 0} / ${q.globalDailyLimit ?? 0}`}
        sub="글로벌 카운터" />
    </div>
  )
}

function Table({ rows, columns }) {
  if (!rows) return <div className="ap-loading">불러오는 중...</div>
  if (rows.length === 0) return <div className="ap-empty">데이터 없음</div>
  return (
    <div className="ap-table-wrap">
      <table className="ap-table">
        <thead>
          <tr>{columns.map((c) => <th key={c.key}>{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {columns.map((c) => (
                <td key={c.key}>{c.render ? c.render(r) : (r[c.key] ?? '-')}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const COLUMNS = {
  satisfaction: [
    { key: 'cookieId', label: '사용자' },
    { key: 'rating', label: '별점', render: (r) => `${r.rating}/5` },
    { key: 'gender', label: '성별', render: (r) => r.gender === 'MALE' ? '남' : r.gender === 'FEMALE' ? '여' : '-' },
    { key: 'comment', label: '코멘트' },
    { key: 'updatedAt', label: '갱신', render: (r) => formatDt(r.updatedAt) },
  ],
  'purchase-intent': [
    { key: 'cookieId', label: '사용자' },
    { key: 'lastChoice', label: '최종 선택' },
    { key: 'dialogCount', label: '노출 횟수' },
    { key: 'updatedAt', label: '갱신', render: (r) => formatDt(r.updatedAt) },
  ],
  behavior: [
    { key: 'cookieId', label: '사용자' },
    { key: 'maxScroll', label: '최대 스크롤',
      render: (r) => r.maxScrollSection ? `${r.maxScrollSection} (#${r.maxScrollIndex})` : '-' },
    { key: 'lastPhotoDwellMs', label: '사진 망설임(ms)' },
    { key: 'failedAttempts', label: '검증 실패' },
    { key: 'resultRevisitCount', label: '결과 재방문' },
    { key: 'lastPhotoReplaced', label: '사진 교체' },
    { key: 'updatedAt', label: '갱신', render: (r) => formatDt(r.updatedAt) },
  ],
  banned: [
    { key: 'cookie_id', label: '쿠키', render: (r) => r.cookie_id ?? r.COOKIE_ID ?? '-' },
    { key: 'ip_address', label: 'IP', render: (r) => r.ip_address ?? r.IP_ADDRESS ?? '-' },
    { key: 'reason', label: '사유', render: (r) => r.reason ?? r.REASON ?? '-' },
    { key: 'created_at', label: '추가일', render: (r) => formatDt(r.created_at ?? r.CREATED_AT) },
  ],
  shares: [
    { key: 'token', label: '토큰' },
    { key: 'cookieId', label: '소유자' },
    { key: 'analysisResultId', label: '결과 ID' },
    { key: 'createdAt', label: '생성', render: (r) => formatDt(r.createdAt) },
    { key: 'active', label: '상태', render: (r) => r.active ? 'active' : `폐기 ${formatDt(r.revokedAt)}` },
  ],
}

function AcquisitionSection() {
  const [rows, setRows] = useState(null)

  useEffect(() => {
    fetch('/api/admin/stats/acquisition')
      .then((r) => r.ok ? r.json() : [])
      .then(setRows)
      .catch(() => setRows([]))
  }, [])

  if (rows === null) return <div className="ap-loading">집계 중...</div>
  if (rows.length === 0) return <div className="ap-empty">데이터 없음<br/>?ref= 파라미터가 붙은 접속이 없어요</div>

  return (
    <div className="ap-table-wrap">
      <table className="ap-table">
        <thead>
          <tr>
            <th>유입 경로 (ref)</th>
            <th>분석 제출</th>
            <th>완료</th>
            <th>완료율</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.ref}>
              <td><span className="ap-ref-tag">{r.ref}</span></td>
              <td>{r.total}</td>
              <td>{r.completed}</td>
              <td>
                <div className="ap-rate-cell">
                  <div className="ap-rate-bar-wrap">
                    <div className="ap-rate-bar-fill" style={{ width: `${r.completionRate}%` }} />
                  </div>
                  <span className="ap-rate-pct">{r.completionRate}%</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Dashboard({ onLogout }) {
  const navigate = useNavigate()
  const [summary, setSummary] = useState(null)
  const [activeTab, setActiveTab] = useState('satisfaction')
  const [tabData, setTabData] = useState({})

  useEffect(() => {
    fetch('/api/admin/stats/summary')
      .then((r) => r.ok ? r.json() : null)
      .then(setSummary)
      .catch(() => setSummary(null))
  }, [])

  useEffect(() => {
    if (tabData[activeTab]) return
    const tab = TABS.find((t) => t.key === activeTab)
    if (!tab) return
    fetch(tab.path)
      .then((r) => r.ok ? r.json() : [])
      .then((rows) => setTabData((prev) => ({ ...prev, [activeTab]: rows })))
      .catch(() => setTabData((prev) => ({ ...prev, [activeTab]: [] })))
  }, [activeTab, tabData])

  const handleLogout = async () => {
    try { await fetch('/api/admin/logout', { method: 'POST' }) } catch { /* ignore */ }
    onLogout()
  }

  return (
    <div className="ap-frame">
      <header className="ap-header">
        <h1>StyleFit Admin</h1>
        <button type="button" className="ap-logout" onClick={handleLogout}>로그아웃</button>
      </header>

      <section className="ap-section">
        <h2>요약</h2>
        <SummaryGrid data={summary} />
      </section>

      <section className="ap-section">
        <h2>리포트 열람 퍼널</h2>
        <p className="ap-section-sub">사용자당 1회 기준. 미완료 = 실패·진행중 합산.</p>
        <FunnelSection data={summary} />
      </section>

      <section className="ap-section">
        <h2>유입 경로 분석</h2>
        <p className="ap-section-sub">?ref= 파라미터 기준. ref 없는 접속은 "direct"로 집계됩니다.</p>
        <AcquisitionSection />
      </section>

      <section className="ap-section">
        <h2>상세 데이터</h2>
        <div className="ap-tabs">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`ap-tab ${activeTab === t.key ? 'active' : ''}`}
              onClick={() => setActiveTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <Table rows={tabData[activeTab]} columns={COLUMNS[activeTab]} />
      </section>

      <section className="ap-section ap-quicklinks">
        <h2>운영 도구</h2>
        <button type="button" className="ap-link" onClick={() => navigate('/admin/ban')}>
          사용자 차단 관리 <span className="ap-link-arrow">→</span>
        </button>
        <p className="ap-link-sub">최근 활동한 사용자를 다중 선택해 쿠키/IP 단위로 차단하거나 해제할 수 있어요.</p>
      </section>
    </div>
  )
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(null) // null=확인중, true/false

  useEffect(() => {
    fetch('/api/admin/me')
      .then((r) => setAuthed(r.ok))
      .catch(() => setAuthed(false))
  }, [])

  if (authed === null) {
    return <div className="ap-frame"><div className="ap-loading">확인 중...</div></div>
  }

  if (!authed) {
    return <LoginForm onLogin={() => setAuthed(true)} />
  }

  return <Dashboard onLogout={() => setAuthed(false)} />
}
