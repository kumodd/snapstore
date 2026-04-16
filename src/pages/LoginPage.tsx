import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Mail, Lock, Eye, EyeOff, Globe2, Sparkles, ArrowRight, Zap } from 'lucide-react'
import { useAuthStore } from '../stores/authStore'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const navigate = useNavigate()
  const { signInWithEmail, signInWithGoogle } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return
    setIsLoading(true)
    const { error } = await signInWithEmail(email, password)
    setIsLoading(false)
    if (error) {
      toast.error(error)
    } else {
      navigate('/dashboard')
    }
  }

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true)
    const { error } = await signInWithGoogle()
    if (error) {
      toast.error(error)
      setIsGoogleLoading(false)
    }
    // Navigation handled by OAuth redirect
  }

  return (
    <div className="min-h-screen bg-surface-950 flex">
      {/* Left — Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-surface">
        <div className="absolute inset-0 bg-gradient-glow opacity-40" />
        <div className="absolute top-1/4 -left-20 w-80 h-80 bg-brand-600/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-accent-purple/15 rounded-full blur-3xl" />

        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-brand flex items-center justify-center shadow-glow-brand">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="font-display font-bold text-xl text-white">SnapStore</span>
          </div>

          {/* Hero text */}
          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <h1 className="font-display font-bold text-5xl text-white leading-tight text-balance">
                Beautiful App Store
                <span className="block text-gradient">Screenshots, Instantly.</span>
              </h1>
              <p className="mt-4 text-lg text-surface-400 leading-relaxed">
                Your work always saves. Your exports always work. No surprises.
              </p>
            </motion.div>

            {/* Feature pills */}
            <motion.div
              className="flex flex-wrap gap-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              {['AI-powered design', 'Pixel-accurate exports', 'Team collaboration', 'Autosave'].map(feat => (
                <span key={feat} className="badge-brand text-xs px-3 py-1">
                  <Zap className="w-3 h-3" />
                  {feat}
                </span>
              ))}
            </motion.div>
          </div>

          {/* Social proof */}
          <motion.div
            className="space-y-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <p className="text-surface-500 text-sm">Trusted by indie developers worldwide</p>
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2">
                {['#6171f6','#a78bfa','#22d3ee','#34d399','#f472b6'].map((c, i) => (
                  <div key={i} className="w-8 h-8 rounded-full border-2 border-surface-900"
                    style={{ backgroundColor: c }} />
                ))}
              </div>
              <p className="text-surface-400 text-sm"><span className="text-white font-semibold">50,000+</span> screenshots exported</p>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Right — Login form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <motion.div
          className="w-full max-w-md space-y-8"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
        >
          {/* Mobile logo */}
          <div className="flex items-center gap-3 lg:hidden">
            <div className="w-9 h-9 rounded-xl bg-gradient-brand flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="font-display font-bold text-xl text-white">SnapStore</span>
          </div>

          <div>
            <h2 className="font-display font-bold text-3xl text-white">Welcome back</h2>
            <p className="mt-2 text-surface-400">Sign in to your account to continue</p>
          </div>

          {/* Google OAuth */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={isGoogleLoading}
            className="btn-secondary btn-lg w-full"
            id="btn-google-signin"
          >
            {isGoogleLoading ? (
              <div className="w-4 h-4 border-2 border-surface-500 border-t-surface-200 rounded-full animate-spin" />
            ) : (
              <Globe2 className="w-4 h-4" />
            )}
            Continue with Google
          </button>

          <div className="flex items-center gap-4">
            <div className="flex-1 divider" />
            <span className="text-surface-600 text-sm">or</span>
            <div className="flex-1 divider" />
          </div>

          {/* Email/password form */}
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div>
              <label className="label" htmlFor="login-email">Email address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="input pl-10"
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="label mb-0" htmlFor="login-password">Password</label>
                <Link to="/auth/reset-password" className="text-xs text-brand-400 hover:text-brand-300 transition-colors">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input pl-10 pr-10"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 hover:text-surface-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              id="btn-email-signin"
              type="submit"
              disabled={isLoading || !email || !password}
              className="btn-primary btn-lg w-full mt-2"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>Sign in <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>

          <p className="text-center text-surface-400 text-sm">
            Don't have an account?{' '}
            <Link to="/auth/signup" className="text-brand-400 hover:text-brand-300 font-medium transition-colors">
              Sign up free
            </Link>
          </p>

          <p className="text-center text-surface-600 text-xs">
            By signing in, you agree to our{' '}
            <a href="/terms" className="underline hover:text-surface-400">Terms</a> and{' '}
            <a href="/privacy" className="underline hover:text-surface-400">Privacy Policy</a>.
          </p>
        </motion.div>
      </div>
    </div>
  )
}
