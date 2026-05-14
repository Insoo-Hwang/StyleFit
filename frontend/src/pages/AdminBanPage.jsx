import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './AdminPage.css'
import './AdminBanPage.css'

function formatDt(dt) {
  if (!dt) return '-'
  const d = new Date(dt)
  if (Number.isNaN(d.getTime())) return String(dt)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function AdminBanPage() {
  const navigate = useNavigate()
  const [authed, setAuthed] = useState(null)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(() => new Set()) // "cookieId|ip"
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    fetch('/api/admin/me')
      .then((r) => setAuthed(r.ok))
      .catch(() => setAuthed(false))
  }, [])

  const refresh = () => {
    setLoading(true)
    fetch('/api/admin/stats/recent-users?limit=200')
      .then((r) => r.ok ? r.json() : [])
      .then((data) => { setRows(data); setLoading(false) })
      .catch(() => { setRows([]); setLoading(false) })
  }

  useEffect(() => {
    if (authed) refresh()
  }, [authed])

  const keyOf = (r) => `${r.cookieId || ''}|${r.ip || ''}`

  const toggle = (key) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === rows.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(rows.map(keyOf)))
    }
  }

  const handleBan = async (mode) => {
    if (busy || selected.size === 0) return
    const items = rows.filter((r) => selected.has(keyOf(r))).map((r) => ({
      cookieId: mode === 'ip' ? null : r.cookieId,
      ip: mode === 'cookie' ? null : r.ip,
      reason: reason.trim() || null,
    })).filter((it) => it.cookieId || it.ip)

    if (items.length === 0) {
      setMessage({ type: 'err', text: '선택된 행에 차단 가능한 값이 없습니다.' })
      return
    }
    if (!window.confirm(`${items.length}건을 차단할까요? (모드: ${mode})`)) return

    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch('/api/admin/ban', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      })
      if (!res.ok) throw new Error('failed')
      const body = await res.json()
      setMessage({ type: 'ok', text: `${body.inserted}건 차단 완료` })
      setSelected(new Set())
      setReason('')
      refresh()
    } catch {
      setMessage({ type: 'err', text: '차단 실패. 잠시 후 다시 시도해주세요.' })
    } finally {
      setBusy(false)
    }
  }

  const handleUnban = async (row) => {
    if (busy) return
    if (!window.confirm('이 사용자의 차단을 해제할까요? (cookie 와 IP 매칭 모두)')) return
    setBusy(true)
    try {
      const params = new URLSearchParams()
      if (row.cookieId) params.set('cookieId', row.cookieId)
      if (row.ip) params.set('ip', row.ip)
      const res = await fetch(`/api/admin/ban?${params.toString()}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('failed')
      const body = await res.json()
      setMessage({ type: 'ok', text: `${body.removed}건 해제` })
      refresh()
    } catch {
      setMessage({ type: 'err', text: '해제 실패' })
    } finally {
      setBusy(false)
    }
  }

  const stats = useMemo(() => ({
    total: rows.length,
    bannedCookies: rows.filter((r) => r.cookieBanned).length,
    bannedIps: rows.filter((r) => r.ipBanned).length,
  }), [rows])

  if (authed === null) {
    return <div className="ap-frame"><div className="ap-loading">확인 중...</div></div>
  }
  if (!authed) {
    return (
      <div className="ap-frame">
        <div className="ap-empty">
          로그인이 필요합니다. <button className="ap-logout" onClick={() => navigate('/admin')}>로그인 화면으로</button>
        </div>
      </div>
    )
  }

  return (
    <div className="ap-frame">
      <header className="ap-header">
        <h1>StyleFit Admin — 사용자 차단</h1>
        <button type="button" className="ap-logout" onClick={() => navigate('/admin')}>← 대시보드</button>
      </header>

      <section className="ap-section">
        <div className="ab-toolbar">
          <div className="ab-stats">
            전체 {stats.total}건 · 차단된 쿠키 {stats.bannedCookies} · 차단된 IP {stats.bannedIps}
          </div>
          <button type="button" className="ab-refresh" onClick={refresh} disabled={loading}>새로고침</button>
        </div>

        <div className="ab-banbar">
          <input
            type="text"
            className="ab-reason"
            placeholder="차단 사유 (선택)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={200}
          />
          <div className="ab-actions">
            <button type="button" className="ab-btn" disabled={busy || selected.size === 0}
              onClick={() => handleBan('both')}>
              선택 {selected.size}건 차단 (쿠키+IP)
            </button>
            <button type="button" className="ab-btn ab-btn-secondary" disabled={busy || selected.size === 0}
              onClick={() => handleBan('cookie')}>
              쿠키만
            </button>
            <button type="button" className="ab-btn ab-btn-secondary" disabled={busy || selected.size === 0}
              onClick={() => handleBan('ip')}>
              IP만
            </button>
          </div>
        </div>

        {message && (
          <div className={`ab-msg ${message.type === 'ok' ? 'ab-msg-ok' : 'ab-msg-err'}`}>
            {message.text}
          </div>
        )}

        {loading ? (
          <div className="ap-loading">불러오는 중...</div>
        ) : rows.length === 0 ? (
          <div className="ap-empty">최근 활동한 사용자가 없습니다.</div>
        ) : (
          <div className="ap-table-wrap">
            <table className="ap-table ab-table">
              <thead>
                <tr>
                  <th className="ab-check">
                    <input
                      type="checkbox"
                      checked={selected.size === rows.length && rows.length > 0}
                      onChange={toggleAll}
                    />
                  </th>
                  <th>쿠키 ID</th>
                  <th>마지막 IP</th>
                  <th>분석 상태</th>
                  <th>마지막 활동</th>
                  <th>현재 차단</th>
                  <th>해제</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const key = keyOf(r)
                  const checked = selected.has(key)
                  return (
                    <tr key={key} className={checked ? 'ab-row-checked' : ''}>
                      <td className="ab-check">
                        <input type="checkbox" checked={checked} onChange={() => toggle(key)} />
                      </td>
                      <td className="ab-mono">{r.cookieId || '-'}</td>
                      <td className="ab-mono">{r.ip || '-'}</td>
                      <td>{r.status}</td>
                      <td>{formatDt(r.updatedAt)}</td>
                      <td>
                        {r.cookieBanned && <span className="ab-tag ab-tag-red">쿠키</span>}
                        {r.ipBanned && <span className="ab-tag ab-tag-red">IP</span>}
                        {!r.cookieBanned && !r.ipBanned && <span className="ab-tag-ok">-</span>}
                      </td>
                      <td>
                        {(r.cookieBanned || r.ipBanned) && (
                          <button type="button" className="ab-unban" disabled={busy}
                            onClick={() => handleUnban(r)}>해제</button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
