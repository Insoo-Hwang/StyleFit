import { Routes, Route, Navigate } from 'react-router-dom'
import LandingPage from './pages/LandingPage.jsx'
import EntryPage from './pages/EntryPage.jsx'
import MenuPage from './pages/MenuPage.jsx'
import UploadPage from './pages/UploadPage.jsx'
import LoadingPage from './pages/LoadingPage.jsx'
import ResultPage from './pages/ResultPage.jsx'
import PhoneInputPage from './pages/PhoneInputPage.jsx'
import PaymentPage from './pages/PaymentPage.jsx'
import PaymentCompletePage from './pages/PaymentCompletePage.jsx'
import PaidReportPage from './pages/PaidReportPage.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/intro" element={<EntryPage />} />
      <Route path="/home" element={<MenuPage />} />
      <Route path="/upload" element={<UploadPage />} />
      <Route path="/loading" element={<LoadingPage />} />
      <Route path="/result" element={<ResultPage />} />
      <Route path="/phone" element={<PhoneInputPage />} />
      <Route path="/payment" element={<PaymentPage />} />
      <Route path="/payment-complete" element={<PaymentCompletePage />} />
      <Route path="/paid-report" element={<PaidReportPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
