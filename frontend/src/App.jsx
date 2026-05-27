import { Routes, Route } from 'react-router-dom'
import ScrollToTop from './components/ScrollToTop.jsx'
import AnalyticsTracker from './components/AnalyticsTracker.jsx'
import HomePage from './pages/HomePage.jsx'
import UploadPage from './pages/UploadPage.jsx'
import LoadingPage from './pages/LoadingPage.jsx'
import ErrorPage from './pages/ErrorPage.jsx'
import ResultPage from './pages/ResultPage.jsx'
import SharePage from './pages/SharePage.jsx'
import ComparePage from './pages/ComparePage.jsx'
import AdminPage from './pages/AdminPage.jsx'
import AdminBanPage from './pages/AdminBanPage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'
import PrivacyPolicyPage from './pages/PrivacyPolicyPage.jsx'
import TermsOfServicePage from './pages/TermsOfServicePage.jsx'

export default function App() {
  return (
    <>
      <ScrollToTop />
      <AnalyticsTracker />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/upload" element={<UploadPage />} />
        <Route path="/loading" element={<LoadingPage />} />
        <Route path="/error" element={<ErrorPage />} />
        <Route path="/result" element={<ResultPage />} />
        <Route path="/share/:token" element={<SharePage />} />
        <Route path="/compare/:token" element={<ComparePage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/admin/ban" element={<AdminBanPage />} />
        <Route path="/privacy" element={<PrivacyPolicyPage />} />
        <Route path="/terms" element={<TermsOfServicePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  )
}
