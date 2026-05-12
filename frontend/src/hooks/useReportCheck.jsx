import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import NoReportDialog from '../components/NoReportDialog.jsx'
import { trackEvent } from '../analytics'

// "내 리포트" 탭 공용 핸들러
// - DB에 COMPLETED 결과가 있으면 /result로 이동
// - 없으면 다이얼로그 노출 ("진단 받기" 누르면 /upload)
// location: GA 이벤트 분석용 호출 위치 라벨 (예: 'home_tabbar', 'upload_tabbar')
export default function useReportCheck(location = 'unknown') {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const checkReport = async () => {
    if (loading) return
    setLoading(true)
    try {
      const res = await fetch('/api/analysis/start', { method: 'POST' })
      const data = await res.json()
      const hasReport = data.status === 'COMPLETED'
      trackEvent('my_report_click', { location, has_report: hasReport })
      if (hasReport) {
        navigate('/result', {
          state: { result: data.result, reportImageUrl: data.reportImageUrl },
        })
      } else {
        setOpen(true)
      }
    } catch {
      trackEvent('my_report_click', { location, has_report: false, error: true })
      setOpen(true)
    } finally {
      setLoading(false)
    }
  }

  const dialog = open ? (
    <NoReportDialog
      onClose={() => {
        trackEvent('no_report_dialog_action', { action: 'close', location })
        setOpen(false)
      }}
      onConfirm={() => {
        trackEvent('no_report_dialog_action', { action: 'go_diagnose', location })
        setOpen(false)
        navigate('/upload')
      }}
    />
  ) : null

  return { checkReport, dialog, loading }
}
