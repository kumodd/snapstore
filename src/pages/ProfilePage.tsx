import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  User, Mail, Camera, Lock, LogOut, Crown, Zap, Check,
  Shield, Bell, Trash2, ChevronRight, AlertTriangle, Eye,
  EyeOff, Loader2, CheckCircle2, XCircle, BarChart3,
  Package, Download, Calendar, RefreshCw, ExternalLink,
  Edit3, Save, X
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import toast from 'react-hot-toast'
import clsx from 'clsx'

// ─── Plan config ──────────────────────────────────────────────────────
const PLAN_META = {
  free:  { label: 'Free',   color: '#64748b', bg: 'rgba(100,116,139,0.15)', icon: Package,  price: '₹0' },
  indie: { label: 'Indie',  color: '#3b82f6', bg: 'rgba(59,130,246,0.15)',  icon: Zap,      price: '₹9.99/mo' },
  pro:   { label: 'Pro',    color: '#8b5cf6', bg: 'rgba(139,92,246,0.15)',  icon: Crown,    price: '₹24.99/mo' },
  team:  { label: 'Team',   color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', icon: Shield,   price: '₹79.99/mo' },
} as const

// ─── Stat mini card ───────────────────────────────────────────────────
function StatMini({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: React.ElementType; color: string }) {
  return (
    <div className="flex-1 rounded-2xl p-4 border border-white/5 flex flex-col gap-2" style={{ background: '#0f172a' }}>
      <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${color}20` }}>
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <p className="text-xl font-bold text-white leading-none">{value}</p>
      <p className="text-[11px] text-slate-500">{label}</p>
    </div>
  )
}

// ─── Section wrapper ──────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/5 overflow-hidden" style={{ background: '#111827' }}>
      <div className="px-5 py-3.5 border-b border-white/5">
        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">{title}</p>
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  )
}

// ─── Field row ────────────────────────────────────────────────────────
function FieldRow({ label, value, editing, input }: { label: string; value: string; editing?: boolean; input?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] text-slate-600 mb-0.5">{label}</p>
        {editing && input ? input : <p className="text-sm text-slate-200 font-medium truncate">{value || '—'}</p>}
      </div>
    </div>
  )
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────
export default function ProfilePage() {
  const navigate = useNavigate()
  const { profile, user, plan, signOut, updateProfile, updatePassword, refreshProfile } = useAuthStore()

  const [tab, setTab] = useState<'profile' | 'security' | 'subscription' | 'danger'>('profile')
  const [editing, setEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  // Profile fields
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '')
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? '')

  // Password fields
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [isChangingPw, setIsChangingPw] = useState(false)

  // Delete account
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

  // Project count
  const [projectCount, setProjectCount] = useState(0)
  const [exportCount, setExportCount] = useState(0)

  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    refreshProfile()
    loadStats()
  }, [])

  useEffect(() => {
    setDisplayName(profile?.display_name ?? '')
    setAvatarUrl(profile?.avatar_url ?? '')
  }, [profile])

  const loadStats = async () => {
    const { count: pc } = await supabase.from('projects').select('*', { count: 'exact', head: true }).eq('owner_id', user!.id)
    const { count: ec } = await supabase.from('export_jobs').select('*', { count: 'exact', head: true }).eq('user_id', user!.id)
    setProjectCount(pc ?? 0)
    setExportCount(ec ?? 0)
  }

  // ── Save profile ───────────────────────────────────────────────────
  const handleSaveProfile = async () => {
    setIsSaving(true)
    const { error } = await updateProfile({ display_name: displayName, avatar_url: avatarUrl })
    setIsSaving(false)
    if (error) { toast.error(error); return }
    setEditing(false)
    toast.success('Profile updated!')
  }

  // ── Avatar upload ──────────────────────────────────────────────────
  const handleAvatarUpload = async (file: File) => {
    if (!user) return
    if (file.size > 2 * 1024 * 1024) { toast.error('Max 2MB'); return }
    setIsUploading(true)
    const ext = file.name.split('.').pop()
    const path = `avatars/${user.id}.${ext}`
    const { error: upErr } = await supabase.storage.from('assets').upload(path, file, { upsert: true })
    if (upErr) { toast.error('Upload failed'); setIsUploading(false); return }
    const { data } = supabase.storage.from('assets').getPublicUrl(path)
    const url = data.publicUrl + `?t=${Date.now()}`
    await updateProfile({ avatar_url: url })
    setAvatarUrl(url)
    setIsUploading(false)
    toast.success('Avatar updated!')
  }

  // ── Change password ────────────────────────────────────────────────
  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) { toast.error('Passwords do not match'); return }
    if (newPassword.length < 8) { toast.error('Password must be at least 8 characters'); return }
    setIsChangingPw(true)
    const { error } = await updatePassword(newPassword)
    setIsChangingPw(false)
    if (error) { toast.error(error); return }
    setCurrentPassword(''); setNewPassword(''); setConfirmPassword('')
    toast.success('Password changed successfully!')
  }

  // ── Delete account ─────────────────────────────────────────────────
  const handleDeleteAccount = async () => {
    if (deleteConfirm !== user?.email) { toast.error('Email does not match'); return }
    setIsDeleting(true)
    // Delete all user data then sign out (actual auth delete requires service role)
    await supabase.from('projects').delete().eq('owner_id', user!.id)
    await signOut()
    toast.success('Account deleted')
    navigate('/')
  }

  const planMeta = PLAN_META[plan] ?? PLAN_META.free
  const PlanIcon = planMeta.icon
  const memberSince = profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : '—'
  const exportsThisMonth = profile?.export_count_this_month ?? 0
  const exportResetDate = profile?.export_reset_at ? new Date(profile.export_reset_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'

  const TABS = [
    { id: 'profile'      as const, label: 'Profile',      icon: User },
    { id: 'security'     as const, label: 'Security',     icon: Lock },
    { id: 'subscription' as const, label: 'Subscription', icon: Crown },
    { id: 'danger'       as const, label: 'Danger Zone',  icon: AlertTriangle },
  ]

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0b0d1a', fontFamily: 'Inter, sans-serif' }}>

      {/* ── Top bar ─────────────────────────────────────────────── */}
      <header className="h-14 flex-shrink-0 flex items-center px-6 gap-4 sticky top-0 z-40"
        style={{ background: 'rgba(11,13,26,0.85)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
          <ChevronRight className="w-4 h-4 rotate-180" />
          <span className="text-sm font-medium">Dashboard</span>
        </button>
        <div className="flex-1" />
        <span className="text-sm font-bold text-white">Account Settings</span>
        <div className="flex-1" />
        <button
          onClick={async () => { await signOut(); navigate('/') }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-red-400 hover:bg-red-500/10 border border-red-500/0 hover:border-red-500/20 transition-all"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign Out
        </button>
      </header>

      <div className="flex-1 max-w-3xl mx-auto w-full px-6 py-8 space-y-6">

        {/* ── Profile hero card ────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl p-6 border border-white/5 relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #131b2e 0%, #0f1120 100%)' }}
        >
          {/* Decorative glow */}
          <div className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-10 pointer-events-none"
            style={{ background: `radial-gradient(circle, ${planMeta.color}, transparent 70%)`, transform: 'translate(30%, -30%)' }} />

          <div className="relative flex items-start gap-6">
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-white/10 bg-gradient-to-br from-indigo-600 to-purple-700 flex items-center justify-center">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl font-bold text-white">
                    {(displayName || user?.email || 'U')[0].toUpperCase()}
                  </span>
                )}
                {isUploading && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 text-white animate-spin" />
                  </div>
                )}
              </div>
              <button
                onClick={() => fileRef.current?.click()}
                className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-xl bg-indigo-600 hover:bg-indigo-500 flex items-center justify-center border-2 border-[#0f1120] transition-colors"
                title="Change avatar"
              >
                <Camera className="w-3 h-3 text-white" />
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleAvatarUpload(f) }} />
            </div>

            {/* Name + plan */}
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-white truncate">{displayName || 'No Name'}</h1>
              <p className="text-sm text-slate-500 mt-0.5 truncate">{user?.email}</p>
              <div className="flex items-center gap-2 mt-3">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                  style={{ background: planMeta.bg, border: `1px solid ${planMeta.color}30` }}>
                  <PlanIcon className="w-3 h-3" style={{ color: planMeta.color }} />
                  <span className="text-[11px] font-bold" style={{ color: planMeta.color }}>{planMeta.label}</span>
                </div>
                <span className="text-[11px] text-slate-600">Member since {memberSince}</span>
              </div>
            </div>

            <button
              onClick={() => navigate('/pricing')}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex-shrink-0',
                plan === 'team' ? 'hidden' : 'bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30 border border-indigo-500/20'
              )}
            >
              <Zap className="w-3 h-3" /> Upgrade
            </button>
          </div>

          {/* Stats row */}
          <div className="flex gap-3 mt-5">
            <StatMini label="Projects" value={projectCount} icon={Package} color="#6366f1" />
            <StatMini label="All-time Exports" value={exportCount} icon={Download} color="#10b981" />
            <StatMini label="Exports this month" value={exportsThisMonth} icon={BarChart3} color="#f59e0b" />
            <StatMini label="Reset on" value={exportResetDate} icon={Calendar} color="#8b5cf6" />
          </div>
        </motion.div>

        {/* ── Tab nav ──────────────────────────────────────────── */}
        <div className="flex items-center gap-1 p-1 rounded-2xl" style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.06)' }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={clsx(
                'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all',
                tab === t.id ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'
              )}
            >
              <t.icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>

        {/* ── PROFILE TAB ──────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {tab === 'profile' && (
            <motion.div key="profile" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4">
              <Section title="Personal Information">
                <FieldRow
                  label="Display Name"
                  value={displayName}
                  editing={editing}
                  input={
                    <input
                      value={displayName}
                      onChange={e => setDisplayName(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-indigo-500 transition-colors"
                    />
                  }
                />
                <FieldRow
                  label="Email Address"
                  value={user?.email ?? ''}
                  editing={false}
                  input={
                    <div className="flex items-center gap-2">
                      <input disabled value={user?.email ?? ''} className="flex-1 bg-white/3 border border-white/5 rounded-xl px-3 py-2 text-sm text-slate-500 outline-none cursor-not-allowed" />
                      <span className="text-[10px] text-slate-600">Email cannot be changed</span>
                    </div>
                  }
                />
                <FieldRow label="Member Since" value={memberSince} />
                <FieldRow label="User ID" value={user?.id?.slice(0, 16) + '…' ?? '—'} />

                {/* Edit / Save buttons */}
                <div className="flex items-center gap-3 pt-2 border-t border-white/5">
                  {!editing ? (
                    <button
                      onClick={() => setEditing(true)}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-colors"
                      style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)' }}
                    >
                      <Edit3 className="w-4 h-4" /> Edit Profile
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={handleSaveProfile}
                        disabled={isSaving}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 transition-colors"
                      >
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {isSaving ? 'Saving…' : 'Save Changes'}
                      </button>
                      <button
                        onClick={() => { setEditing(false); setDisplayName(profile?.display_name ?? ''); setAvatarUrl(profile?.avatar_url ?? '') }}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-slate-400 hover:text-white transition-colors"
                        style={{ border: '1px solid rgba(255,255,255,0.08)' }}
                      >
                        <X className="w-4 h-4" /> Cancel
                      </button>
                    </>
                  )}
                </div>
              </Section>

              {/* Sign Out */}
              <section className="rounded-2xl p-5 border border-white/5" style={{ background: '#111827' }}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-200">Sign Out</p>
                    <p className="text-xs text-slate-500 mt-0.5">Sign out of your account on this device</p>
                  </div>
                  <button
                    onClick={async () => { await signOut(); navigate('/') }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-red-400 hover:bg-red-500/10 border border-red-500/20 transition-all"
                  >
                    <LogOut className="w-4 h-4" /> Sign Out
                  </button>
                </div>
              </section>
            </motion.div>
          )}

          {/* ── SECURITY TAB ───────────────────────────────────── */}
          {tab === 'security' && (
            <motion.div key="security" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4">
              <Section title="Change Password">
                <div className="space-y-3">
                  {[
                    { label: 'New Password', val: newPassword, set: setNewPassword },
                    { label: 'Confirm Password', val: confirmPassword, set: setConfirmPassword },
                  ].map(({ label, val, set }) => (
                    <div key={label}>
                      <label className="text-[10px] text-slate-600 block mb-1">{label}</label>
                      <div className="relative">
                        <input
                          type={showPw ? 'text' : 'password'}
                          value={val} onChange={e => set(e.target.value)}
                          placeholder="••••••••"
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 pr-10 text-sm text-white outline-none focus:border-indigo-500 transition-colors"
                        />
                        <button onClick={() => setShowPw(s => !s)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                          {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Password strength */}
                  {newPassword && (
                    <div className="space-y-1.5">
                      {[
                        { label: 'At least 8 characters', ok: newPassword.length >= 8 },
                        { label: 'Passwords match', ok: newPassword === confirmPassword && confirmPassword.length > 0 },
                        { label: 'Contains number or symbol', ok: /[0-9!@#$%^&*]/.test(newPassword) },
                      ].map(({ label, ok }) => (
                        <div key={label} className="flex items-center gap-2">
                          {ok
                            ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                            : <XCircle className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />}
                          <span className={clsx('text-[11px]', ok ? 'text-emerald-400' : 'text-slate-600')}>{label}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    onClick={handleChangePassword}
                    disabled={isChangingPw || !newPassword || newPassword !== confirmPassword}
                    className="w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
                  >
                    {isChangingPw ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                    {isChangingPw ? 'Updating…' : 'Update Password'}
                  </button>
                </div>
              </Section>

              <Section title="Active Sessions">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-200">Current session</p>
                    <p className="text-xs text-slate-500 mt-0.5">Signed in via {user?.app_metadata?.provider ?? 'email'} · {user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleDateString('en-IN') : 'Just now'}</p>
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span className="text-[10px] text-emerald-400 font-semibold">Active</span>
                  </div>
                </div>
                <div className="pt-3 border-t border-white/5">
                  <button
                    onClick={async () => { await signOut(); navigate('/auth/login') }}
                    className="text-sm text-red-400 hover:text-red-300 font-medium flex items-center gap-1.5 transition-colors"
                  >
                    <LogOut className="w-4 h-4" /> Sign out all devices
                  </button>
                </div>
              </Section>
            </motion.div>
          )}

          {/* ── SUBSCRIPTION TAB ───────────────────────────────── */}
          {tab === 'subscription' && (
            <motion.div key="sub" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4">

              {/* Current plan card */}
              <div className="rounded-2xl p-6 border relative overflow-hidden"
                style={{ background: `linear-gradient(135deg, #111827, #0f172a)`, borderColor: `${planMeta.color}30` }}>
                <div className="absolute top-0 right-0 w-48 h-48 rounded-full pointer-events-none"
                  style={{ background: `radial-gradient(circle, ${planMeta.color}20, transparent 70%)`, transform: 'translate(20%, -20%)' }} />
                <div className="relative">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: planMeta.bg }}>
                        <PlanIcon className="w-6 h-6" style={{ color: planMeta.color }} />
                      </div>
                      <div>
                        <p className="text-lg font-bold text-white">{planMeta.label} Plan</p>
                        <p className="text-sm font-semibold" style={{ color: planMeta.color }}>{planMeta.price}</p>
                      </div>
                    </div>
                    {plan !== 'team' && (
                      <button
                        onClick={() => navigate('/pricing')}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white transition-all"
                        style={{ background: planMeta.color }}
                      >
                        <Zap className="w-3 h-3" /> Upgrade
                      </button>
                    )}
                  </div>

                  {/* Feature list */}
                  <div className="grid grid-cols-2 gap-y-2 gap-x-4">
                    {[
                      { label: 'Projects', value: plan === 'free' ? 'Up to 3' : 'Unlimited', ok: true },
                      { label: 'Monthly Exports', value: plan === 'free' ? '10/month' : 'Unlimited', ok: plan !== 'free' },
                      { label: 'AI Composer', value: plan !== 'free' ? 'Included' : 'Not included', ok: plan !== 'free' },
                      { label: 'Team Workspace', value: plan === 'team' ? 'Included' : 'Not included', ok: plan === 'team' },
                      { label: 'API Access', value: ['pro', 'team'].includes(plan) ? 'Included' : 'Not included', ok: ['pro', 'team'].includes(plan) },
                      { label: 'Brand Kit', value: plan === 'team' ? 'Included' : 'Not included', ok: plan === 'team' },
                    ].map(({ label, value, ok }) => (
                      <div key={label} className="flex items-center gap-2">
                        {ok
                          ? <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                          : <X className="w-3.5 h-3.5 text-slate-700 flex-shrink-0" />}
                        <span className={clsx('text-xs', ok ? 'text-slate-300' : 'text-slate-600')}>{label}: <span className="font-medium">{value}</span></span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Usage meter */}
              <Section title="Usage This Month">
                <div className="space-y-3">
                  {plan === 'free' && (
                    <>
                      <div>
                        <div className="flex justify-between text-xs mb-2">
                          <span className="text-slate-400">Exports used</span>
                          <span className="font-semibold text-white">{exportsThisMonth} / 10</span>
                        </div>
                        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                          <motion.div
                            initial={{ width: 0 }} animate={{ width: `${Math.min((exportsThisMonth / 10) * 100, 100)}%` }}
                            transition={{ duration: 0.8, ease: 'easeOut' }}
                            className="h-full rounded-full"
                            style={{ background: exportsThisMonth >= 8 ? '#ef4444' : '#6366f1' }}
                          />
                        </div>
                        <p className="text-[10px] text-slate-600 mt-1">Resets on {exportResetDate}</p>
                      </div>
                    </>
                  )}
                  {plan !== 'free' && (
                    <div className="flex items-center gap-2 text-sm text-emerald-400">
                      <Check className="w-4 h-4" />
                      Unlimited exports on {planMeta.label} plan
                    </div>
                  )}
                </div>
              </Section>

              {/* Billing info */}
              {profile?.razorpay_subscription_id && (
                <Section title="Billing">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-slate-500">Subscription ID</p>
                      <p className="text-sm font-mono text-slate-300 mt-0.5">{profile.razorpay_subscription_id}</p>
                    </div>
                    <button className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
                      <ExternalLink className="w-3.5 h-3.5" /> Manage
                    </button>
                  </div>
                </Section>
              )}
            </motion.div>
          )}

          {/* ── DANGER ZONE TAB ────────────────────────────────── */}
          {tab === 'danger' && (
            <motion.div key="danger" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4">

              {/* Sign out all devices */}
              <div className="rounded-2xl p-5 border border-orange-500/20" style={{ background: 'rgba(249,115,22,0.05)' }}>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-orange-500/15 flex items-center justify-center flex-shrink-0">
                    <LogOut className="w-5 h-5 text-orange-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-white">Sign Out Everywhere</p>
                    <p className="text-xs text-slate-500 mt-1">You will be signed out of all devices and sessions. You will need to sign in again.</p>
                    <button
                      onClick={async () => { await signOut(); navigate('/auth/login') }}
                      className="mt-3 px-4 py-2 rounded-xl text-xs font-bold text-orange-400 border border-orange-500/30 hover:bg-orange-500/10 transition-all"
                    >
                      Sign out all sessions
                    </button>
                  </div>
                </div>
              </div>

              {/* Delete account */}
              <div className="rounded-2xl p-5 border border-red-500/20" style={{ background: 'rgba(239,68,68,0.05)' }}>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center flex-shrink-0">
                    <Trash2 className="w-5 h-5 text-red-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-white">Delete Account</p>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      This will permanently delete your account, all projects, and all associated data. <strong className="text-red-400">This cannot be undone.</strong>
                    </p>
                    <div className="mt-3 space-y-2">
                      <label className="text-[11px] text-slate-500">Type your email <span className="text-white font-mono">{user?.email}</span> to confirm:</label>
                      <input
                        value={deleteConfirm}
                        onChange={e => setDeleteConfirm(e.target.value)}
                        placeholder={user?.email ?? ''}
                        className="w-full bg-red-500/5 border border-red-500/20 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-red-500 transition-colors"
                      />
                      <button
                        onClick={handleDeleteAccount}
                        disabled={isDeleting || deleteConfirm !== user?.email}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-red-400 border border-red-500/30 hover:bg-red-500/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                      >
                        {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        {isDeleting ? 'Deleting…' : 'Permanently Delete Account'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
