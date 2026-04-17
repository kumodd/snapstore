import React, { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useAuthStore } from './stores/authStore'

// Pages
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import DashboardPage from './pages/DashboardPage'
import EditorPage from './pages/editor/EditorPage'
import PricingPage from './pages/PricingPage'

// Lazy loaded pages (code-split)
const LandingPage = React.lazy(() => import('./pages/LandingPage'))
const AdminPage   = React.lazy(() => import('./pages/admin/AdminPage'))
const ProfilePage = React.lazy(() => import('./pages/ProfilePage'))

function AuthCallback() {
  const { user, isInitialized } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    if (isInitialized) {
      if (user) {
        navigate('/dashboard', { replace: true })
      } else {
        navigate('/auth/login', { replace: true })
      }
    }
  }, [isInitialized, user, navigate])

  return (
    <div className="min-h-screen bg-surface-950 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isInitialized, user } = useAuthStore()
  const location = useLocation()

  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-surface-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}

function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const { isInitialized, user } = useAuthStore()
  if (!isInitialized) return null
  if (user) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

function AppInitializer({ children }: { children: React.ReactNode }) {
  const { initialize } = useAuthStore()
  useEffect(() => { initialize() }, [])
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <AppInitializer>
        <React.Suspense fallback={
          <div className="min-h-screen bg-surface-950 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        }>
          <Routes>
            {/* Public */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/auth/callback" element={<AuthCallback />} />

            {/* Auth only (redirect to dashboard if already logged in) */}
            <Route path="/auth/login" element={
              <PublicOnlyRoute><LoginPage /></PublicOnlyRoute>
            } />
            <Route path="/auth/signup" element={
              <PublicOnlyRoute><SignupPage /></PublicOnlyRoute>
            } />

            {/* Protected */}
            <Route path="/dashboard" element={
              <ProtectedRoute><DashboardPage /></ProtectedRoute>
            } />
            <Route path="/editor/:id" element={
              <ProtectedRoute><EditorPage /></ProtectedRoute>
            } />
            <Route path="/admin" element={
              <ProtectedRoute><AdminPage /></ProtectedRoute>
            } />
            <Route path="/profile" element={
              <ProtectedRoute><ProfilePage /></ProtectedRoute>
            } />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </React.Suspense>

        {/* Global toast notifications */}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: '#2c3050',
              border: '1px solid #3d4260',
              color: '#e4e6f0',
              borderRadius: '12px',
              fontSize: '13px',
              fontFamily: 'Inter, sans-serif',
            },
            success: { iconTheme: { primary: '#34d399', secondary: '#2c3050' } },
            error: { iconTheme: { primary: '#f87171', secondary: '#2c3050' } },
          }}
        />
      </AppInitializer>
    </BrowserRouter>
  )
}
