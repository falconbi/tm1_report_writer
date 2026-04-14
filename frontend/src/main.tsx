import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import './index.css'
import BuilderPage from './pages/BuilderPage'
import ViewerPage from './pages/ViewerPage'
import AdminPage from './pages/AdminPage'
import PackComposerPage from './pages/PackComposerPage'

const router = createBrowserRouter([
  { path: '/builder', element: <BuilderPage /> },
  { path: '/builder/packs/:packId', element: <PackComposerPage /> },
  { path: '/viewer/:packId?', element: <ViewerPage /> },
  { path: '/admin', element: <AdminPage /> },
  { path: '*', element: <Navigate to="/builder" replace /> },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
)
