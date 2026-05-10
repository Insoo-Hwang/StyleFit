import { Routes, Route, Navigate } from 'react-router-dom'
import EntryPage from './pages/EntryPage.jsx'
import MenuPage from './pages/MenuPage.jsx'
import UploadPage from './pages/UploadPage.jsx'
import ResultPage from './pages/ResultPage.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<EntryPage />} />
      <Route path="/home" element={<MenuPage />} />
      <Route path="/upload" element={<UploadPage />} />
      <Route path="/result" element={<ResultPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
