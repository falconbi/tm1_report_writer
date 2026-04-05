import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'
import BuilderPage from './pages/BuilderPage'
import ViewerPage from './pages/ViewerPage'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/builder" element={<BuilderPage />} />
        <Route path="/viewer/:packId?" element={<ViewerPage />} />
        <Route path="*" element={<Navigate to="/builder" replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
)
