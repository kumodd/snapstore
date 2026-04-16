import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Mail, Lock, Eye, EyeOff, User, Globe2, Sparkles, ArrowRight, Check } from 'lucide-react'
import { useAuthStore } from '../stores/authStore'
import toast from 'react-hot-toast'

const PERKS = [
  '3 projects free — no credit card',
  'Pixel-accurate App Store exports',
  'AI screenshot composer & copy assistant',
  'All templates included',
]

export default function SignupPage() {
  const navigate = useNavigate()
  const { signUpWithEmail, signInWithGoogle } = useAuthStore()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !email || !password) return
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    setIsLoading(true)
    const { error } = await signUpWithEmail(email, password, name)
    setIsLoading(false)
    if (error) {
      toast.error(error)
    } else {
      setEmailSent(true)
    }
  }

  const handleGoogleSignup = async () => {
    setIsGoogleLoading(true)
    const { error } = await signInWithGoogle()
    if (error) {
      toast.error(error)
      setIsGoogleLoading(false)
    }
  }

  if (emailSent) {
    return (
      <div className="min-h-screen bg-surface-950 flex items-center justify-center p-6">
        <motion.div
          className="w-full max-w-md text-center space-y-6"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <div className="w-20 h-20 rounded-full bg-accent-green/20 border border-accent-green/30 flex items-center justify-center mx-auto">
            <Mail className="w-9 h-9 text-accent-green" />
          </div>
          <div>
            <h2 className="font-display font-bold text-3xl text-white">Check your email</h2>
            <p className="mt-3 text-surface-400">
              We sent a confirmation link to <span className="text-white font-medium">{email}</span>.
              Click it to activate your SnapStore account.
            </p>
          </div>
          <button onClick={() => navigate('/auth/login')} className="btn-secondary btn-md">
            Back to sign in
          </button>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-950 flex">
      {/* Left branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-surface">
        <div className="absolute inset-0 bg-gradient-glow opacity-30" />
        <div className="absolute top-1/3 -left-20 w-72 h-72 bg-accent-purple/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-0 w-80 h-80 bg-brand-600/20 rounded-full blur-3xl" />

        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-brand flex items-center justify-center shadow-glow-brand">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="font-display font-bold text-xl text-white">SnapStore</span>
          </div>

          <div className="space-y-8">
            <div>
              <h1 className="font-display font-bold text-4xl text-white leading-tight">
                Start creating professional{' '}
                <span className="text-gradient">App Store visuals</span>{' '}
                today.
              </h1>
              <p className="mt-4 text-surface-400">
                Join thousands of indie developers who trust SnapStore for App Store screenshots.
              </p>
            </div>

            <ul className="space-y-3">
              {PERKS.map(perk => (
                <li key={perk} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-accent-green/20 border border-accent-green/40 flex items-center justify-center flex-shrink-0">
                    <Check className="w-3 h-3 text-accent-green" />
                  </div>
                  <span className="text-surface-200 text-sm">{perk}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-surface-600 text-sm">No credit card required to start. Ever.</p>
        </div>
      </div>

      {/* Right form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <motion.div
          className="w-full max-w-md space-y-8"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <div className="flex items-center gap-3 lg:hidden">
            <div className="w-9 h-9 rounded-xl bg-gradient-brand flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="font-display font-bold text-xl text-white">SnapStore</span>
          </div>

          <div>
            <h2 className="font-display font-bold text-3xl text-white">Create your account</h2>
            <p className="mt-2 text-surface-400">Free forever. Upgrade when you need more.</p>
          </div>

          <button
            id="btn-google-signup"
            type="button"
            onClick={handleGoogleSignup}
            disabled={isGoogleLoading}
            className="btn-secondary btn-lg w-full"
          >
            {isGoogleLoading ? (
              <div className="w-4 h-4 border-2 border-surface-500 border-t-surface-200 rounded-full animate-spin" />
            ) : <Globe2 className="w-4 h-4" />}
            Sign up with Google
          </button>

          <div className="flex items-center gap-4">
            <div className="flex-1 divider" />
            <span className="text-surface-600 text-sm">or</span>
            <div className="flex-1 divider" />
          </div>

          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label className="label" htmlFor="signup-name">Full name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
                <input
                  id="signup-name"
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Sam Developer"
                  className="input pl-10"
                  required
                />
              </div>
            </div>

            <div>
              <label className="label" htmlFor="signup-email">Email address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
                <input
                  id="signup-email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="input pl-10"
                  required
                />
              </div>
            </div>

            <div>
              <label className="label" htmlFor="signup-password">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
                <input
                  id="signup-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  className="input pl-10 pr-10"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 hover:text-surface-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {password && (
                <div className="mt-2 flex gap-1">
                  {[8, 12, 16].map(len => (
                    <div key={len}
                      className={`flex-1 h-1 rounded-full transition-colors ${
                        password.length >= len
                          ? len === 8 ? 'bg-accent-amber' : len === 12 ? 'bg-brand-500' : 'bg-accent-green'
                          : 'bg-surface-700'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>

            <button
              id="btn-email-signup"
              type="submit"
              disabled={isLoading || !name || !email || !password}
              className="btn-primary btn-lg w-full mt-2"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>Create free account <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>

          <p className="text-center text-surface-400 text-sm">
            Already have an account?{' '}
            <Link to="/auth/login" className="text-brand-400 hover:text-brand-300 font-medium transition-colors">
              Sign in
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  )
}
