import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import NoReportDialog from '../components/NoReportDialog.jsx'

// "내 리포트" 탭 공용 핸들러
// - DB에 COMPLETED 결과가 있으면 /result로 이동
// - 없으면 다이얼로그 노출 ("진단 받기" 누르면 /upload)
export default function useReportCheck() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const checkReport = async () => {
    if (loading) return
    setLoading(true)
    try {
      const res = await fetch('/api/analysis/start', { method: 'POST' })
      const data = await res.json()
      if (data.status === 'COMPLETED') {
        navigate('/result', {
          state: { result: data.result, reportImageUrl: data.reportImageUrl },
        })
      } else {
        setOpen(true)
      }
    } catch {
      setOpen(true)
    } finally {
      setLoading(false)
    }
  }

  const dialog = open ? (
    <NoReportDialog
      onClose={() => setOpen(false)}
      onConfirm={() => { setOpen(false); navigate('/upload') }}
    />
  ) : null

  return { checkReport, dialog, loading }
}
