import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users, BarChart3, TrendingUp, DollarSign, ShieldAlert,
  Search, Filter, ArrowUpDown, ChevronLeft, ChevronRight,
  Sparkles, ArrowLeft, Bell, Ban, RefreshCw, Crown,
  Activity, Package, Download, UserCheck, AlertTriangle,
  X, Check, Send, ChevronDown, Eye, Settings
} from 'lucide-react'
import { useAdminStore, type AdminUser } from '../../stores/adminStore'
import { useAuthStore } from '../../stores/authStore'
import clsx from 'clsx'
import toast from 'react-hot-toast'

// ── Micro chart (sparkline) ───────────────────────────────────────────
function Sparkline({ data, color = '#6366f1' }: { data: number[]; color?: string }) {
  if (data.length < 2) return null
  const max = Math.max(...data, 1)
  const min = Math.min(...data)
  const w = 80, h = 32, pad = 2
  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (w - pad * 2)
    const y = h - pad - ((v - min) / (max - min || 1)) * (h - pad * 2)
    return `${x},${y}`
  }).join(' ')

  return (
    <svg width={w} height={h} className="opacity-80">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

// ── Bar chart (simple SVG) ────────────────────────────────────────────
function BarChart({ data, color = '#6366f1', label }: { data: { day: string; value: number }[]; color?: string; label: string }) {
  const max = Math.max(...data.map(d => d.value), 1)
  const w = 600, h = 120, pad = { t: 8, r: 8, b: 24, l: 32 }
  const barW = Math.max(4, ((w - pad.l - pad.r) / data.length) - 2)

  return (
    <div className="w-full overflow-x-auto">
      <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ minWidth: 320, height: h + 'px' }}>
        {/* Y-axis labels */}
        {[0, 0.5, 1].map(pct => (
          <text key={pct} x={pad.l - 4} y={pad.t + (1 - pct) * (h - pad.t - pad.b) + 4}
            fontSize="8" fill="#64748b" textAnchor="end">{Math.round(max * pct)}</text>
        ))}
        {/* Grid lines */}
        {[0, 0.5, 1].map(pct => (
          <line key={pct} x1={pad.l} x2={w - pad.r}
            y1={pad.t + (1 - pct) * (h - pad.t - pad.b)}
            y2={pad.t + (1 - pct) * (h - pad.t - pad.b)}
            stroke="#1e293b" strokeWidth="1" />
        ))}
        {/* Bars */}
        {data.map((d, i) => {
          const x = pad.l + i * ((w - pad.l - pad.r) / data.length)
          const barH = ((d.value / max) * (h - pad.t - pad.b))
          const y = pad.t + (h - pad.t - pad.b) - barH
          return (
            <g key={i}>
              <rect x={x + 1} y={y} width={barW} height={barH} fill={color} opacity="0.85" rx="2" />
              {i % Math.ceil(data.length / 7) === 0 && (
                <text x={x + barW / 2} y={h - 4} fontSize="7" fill="#475569" textAnchor="middle">
                  {d.day.slice(5)}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// ── Stat card ─────────────────────────────────────────────────────────
function StatCard({
  label, value, sub, icon: Icon, color, sparkData, trend
}: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; color: string; sparkData?: number[]; trend?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-2xl p-5 flex flex-col gap-3 border border-white/5"
      style={{ background: 'linear-gradient(135deg, #111827 0%, #0f172a 100%)' }}
    >
      <div className="flex items-start justify-between">
        <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center', color)}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        {trend !== undefined && (
          <span className={clsx('text-xs font-semibold px-2 py-0.5 rounded-full', trend >= 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400')}>
            {trend >= 0 ? '+' : ''}{trend}%
          </span>
        )}
      </div>
      <div>
        <p className="text-2xl font-bold text-white tracking-tight">{typeof value === 'number' ? value.toLocaleString() : value}</p>
        <p className="text-xs text-slate-500 mt-0.5">{label}</p>
        {sub && <p className="text-[10px] text-slate-600 mt-0.5">{sub}</p>}
      </div>
      {sparkData && <Sparkline data={sparkData} color={color.includes('indigo') ? '#6366f1' : color.includes('emerald') ? '#10b981' : color.includes('amber') ? '#f59e0b' : '#8b5cf6'} />}
    </motion.div>
  )
}

// ── Plan badge ────────────────────────────────────────────────────────
function PlanBadge({ plan }: { plan: string }) {
  const styles: Record<string, string> = {
    free: 'bg-slate-700/50 text-slate-400',
    indie: 'bg-blue-500/15 text-blue-400',
    pro: 'bg-indigo-500/15 text-indigo-400',
    team: 'bg-amber-500/15 text-amber-400',
  }
  return (
    <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider', styles[plan] ?? styles.free)}>
      {plan}
    </span>
  )
}

// ── Plan change modal ─────────────────────────────────────────────────
function PlanModal({ user, onClose, onSave }: { user: AdminUser; onClose: () => void; onSave: (plan: AdminUser['plan']) => void }) {
  const [selected, setSelected] = useState<AdminUser['plan']>(user.plan)
  const plans: AdminUser['plan'][] = ['free', 'indie', 'pro', 'team']

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-[#111827] border border-white/10 rounded-2xl p-6 w-80 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-white text-sm">Change Plan</h3>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-500 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        <p className="text-xs text-slate-400 mb-4">{user.display_name || user.email}</p>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {plans.map(p => (
            <button
              key={p}
              onClick={() => setSelected(p)}
              className={clsx(
                'py-2 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all',
                selected === p ? 'border-indigo-500 bg-indigo-500/15 text-indigo-300' : 'border-white/10 text-slate-500 hover:border-white/20'
              )}
            >{p}</button>
          ))}
        </div>
        <button
          onClick={() => onSave(selected)}
          className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors"
        >
          Update Plan
        </button>
      </motion.div>
    </div>
  )
}

// ── Notification modal ────────────────────────────────────────────────
function NotifModal({ user, onClose, onSend }: { user: AdminUser; onClose: () => void; onSend: (title: string, body: string) => void }) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="bg-[#111827] border border-white/10 rounded-2xl p-6 w-96 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-white text-sm">Send Notification</h3>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-500 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        <p className="text-xs text-slate-400 mb-3">To: {user.display_name || user.email}</p>
        <input
          value={title} onChange={e => setTitle(e.target.value)} placeholder="Title…"
          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white mb-2 outline-none focus:border-indigo-500"
        />
        <textarea
          value={body} onChange={e => setBody(e.target.value)} placeholder="Message…"
          rows={3}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white mb-4 outline-none focus:border-indigo-500 resize-none"
        />
        <button
          onClick={() => title && onSend(title, body)}
          disabled={!title}
          className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
        >
          <Send className="w-4 h-4" /> Send
        </button>
      </motion.div>
    </div>
  )
}

// ── MAIN PAGE ─────────────────────────────────────────────────────────
type AdminTab = 'overview' | 'users' | 'growth' | 'subscriptions'

export default function AdminPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const {
    isAdmin, isChecking, stats, users, growthData, planDist,
    isLoading, searchQuery, planFilter, sortField, sortDir, page, pageSize,
    checkAdminStatus, loadDashboard, loadGrowth,
    updateUserPlan, banUser, sendNotification,
    setSearch, setPlanFilter, setSort, setPage,
  } = useAdminStore()

  const [tab, setTab] = useState<AdminTab>('overview')
  const [growthRange, setGrowthRange] = useState(30)
  const [planModal, setPlanModal] = useState<AdminUser | null>(null)
  const [notifModal, setNotifModal] = useState<AdminUser | null>(null)
  const [expandedUser, setExpandedUser] = useState<string | null>(null)

  useEffect(() => { checkAdminStatus() }, [])
  useEffect(() => {
    if (isAdmin) loadDashboard()
  }, [isAdmin])
  useEffect(() => {
    if (isAdmin && tab === 'growth') loadGrowth(growthRange)
  }, [tab, growthRange, isAdmin])

  // ── Filtered + sorted + paginated users ────────────────────────────
  const filteredUsers = useMemo(() => {
    let list = [...users]
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      list = list.filter(u =>
        u.email?.toLowerCase().includes(q) ||
        u.display_name?.toLowerCase().includes(q)
      )
    }
    if (planFilter !== 'all') list = list.filter(u => u.plan === planFilter)

    list.sort((a, b) => {
      const aVal = a[sortField] ?? 0
      const bVal = b[sortField] ?? 0
      return sortDir === 'asc'
        ? aVal > bVal ? 1 : -1
        : aVal < bVal ? 1 : -1
    })
    return list
  }, [users, searchQuery, planFilter, sortField, sortDir])

  const totalPages = Math.ceil(filteredUsers.length / pageSize)
  const paginatedUsers = filteredUsers.slice((page - 1) * pageSize, page * pageSize)

  // ── Guards ──────────────────────────────────────────────────────────
  if (isChecking) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ background: '#0f1120' }}>
        <div className="flex items-center gap-3 text-slate-400">
          <div className="w-5 h-5 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
          Verifying admin access…
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ background: '#0f1120' }}>
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-500/15 flex items-center justify-center">
            <ShieldAlert className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-xl font-bold text-white">Access Denied</h1>
          <p className="text-slate-400 text-sm max-w-xs">You don't have admin privileges. Contact a super admin to grant access.</p>
          <button onClick={() => navigate('/dashboard')} className="px-4 py-2 bg-indigo-600 rounded-xl text-white text-sm font-medium hover:bg-indigo-500 transition-colors">
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  const TABS: { id: AdminTab; label: string; icon: React.ElementType }[] = [
    { id: 'overview',       label: 'Overview',       icon: BarChart3 },
    { id: 'users',          label: 'Users',          icon: Users },
    { id: 'growth',         label: 'Growth',         icon: TrendingUp },
    { id: 'subscriptions',  label: 'Subscriptions',  icon: DollarSign },
  ]

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0f1120', fontFamily: 'Inter, sans-serif', color: '#e2e8f0' }}>

      {/* ── Top Bar ──────────────────────────────────────────────── */}
      <header className="h-14 flex-shrink-0 flex items-center px-6 gap-4 border-b border-white/8 sticky top-0 z-40" style={{ background: '#111827' }}>
        <button onClick={() => navigate('/dashboard')} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
            <ShieldAlert className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-bold text-white text-sm">SnapStore Admin</span>
          <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full font-semibold">INTERNAL</span>
        </div>

        {/* Tab nav */}
        <div className="flex items-center gap-1 bg-white/5 rounded-xl p-1 ml-4">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                tab === t.id ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-white/10'
              )}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1" />
        <button
          onClick={() => loadDashboard()}
          className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-colors" title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white">
            {user?.email?.[0].toUpperCase()}
          </div>
        </div>
      </header>

      {/* ── Page content ─────────────────────────────────────────── */}
      <main className="flex-1 px-6 py-6 max-w-[1400px] mx-auto w-full">

        {/* ── OVERVIEW TAB ─────────────────────────────────────── */}
        {tab === 'overview' && (
          <div className="space-y-6">
            {/* Stat cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Total Users" value={stats?.totalUsers ?? '—'} icon={Users} color="bg-indigo-600"
                sub={`${stats?.activeThisWeek ?? 0} active this week`} trend={12}
                sparkData={growthData.slice(-7).map(d => d.new_users)} />
              <StatCard label="Total Projects" value={stats?.totalProjects ?? '—'} icon={Package} color="bg-violet-600"
                sub="across all users" trend={8}
                sparkData={growthData.slice(-7).map(d => d.new_projects)} />
              <StatCard label="MRR Estimate" value={stats ? `₹${(stats.mrrEstimate / 100).toLocaleString()}` : '—'} icon={DollarSign} color="bg-emerald-600"
                sub={`${stats?.paidUsers ?? 0} paid users`} trend={5}
                sparkData={growthData.slice(-7).map(d => d.exports)} />
              <StatCard label="Total Exports" value={stats?.totalExports ?? '—'} icon={Download} color="bg-amber-600"
                sub="all time" trend={-2}
                sparkData={growthData.slice(-7).map(d => d.exports)} />
            </div>

            {/* Second row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Free Users" value={stats?.freeUsers ?? '—'} icon={UserCheck} color="bg-slate-600"
                sub="on free plan" />
              <StatCard label="Paid Users" value={stats?.paidUsers ?? '—'} icon={Crown} color="bg-yellow-600"
                sub="indie + pro + team" />
              <StatCard label="Active (7d)" value={stats?.activeThisWeek ?? '—'} icon={Activity} color="bg-blue-600"
                sub="signed in this week" />
              <StatCard label="Churn Risk" value={stats?.churnRisk ?? '—'} icon={AlertTriangle} color="bg-red-600"
                sub="paid, 0 projects" />
            </div>

            {/* Plan distribution */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-2xl p-5 border border-white/5" style={{ background: '#111827' }}>
                <h3 className="font-bold text-white text-sm mb-4">Plan Distribution</h3>
                <div className="space-y-3">
                  {planDist.map(d => {
                    const total = planDist.reduce((s, x) => s + Number(x.count), 0) || 1
                    const pct = Math.round((Number(d.count) / total) * 100)
                    const colors: Record<string, string> = { free: '#475569', indie: '#3b82f6', pro: '#6366f1', team: '#f59e0b' }
                    return (
                      <div key={d.plan}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-slate-300 capitalize font-medium">{d.plan}</span>
                          <span className="text-slate-500">{d.count} ({pct}%)</span>
                        </div>
                        <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.8, ease: 'easeOut' }}
                            className="h-full rounded-full"
                            style={{ backgroundColor: colors[d.plan] ?? '#6366f1' }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Recent signups */}
              <div className="rounded-2xl p-5 border border-white/5" style={{ background: '#111827' }}>
                <h3 className="font-bold text-white text-sm mb-4">Recent Signups</h3>
                <div className="space-y-2">
                  {users.slice(0, 6).map(u => (
                    <div key={u.id} className="flex items-center gap-3 py-1">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                        {(u.display_name || u.email || '?')[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-200 truncate">{u.display_name || u.email}</p>
                        <p className="text-[10px] text-slate-600 truncate">{u.email}</p>
                      </div>
                      <PlanBadge plan={u.plan} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── USERS TAB ────────────────────────────────────────── */}
        {tab === 'users' && (
          <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  value={searchQuery}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search by name or email…"
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-sm text-white outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              {/* Plan filter */}
              <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-xl p-1">
                {['all', 'free', 'indie', 'pro', 'team'].map(p => (
                  <button
                    key={p}
                    onClick={() => setPlanFilter(p)}
                    className={clsx(
                      'px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all capitalize',
                      planFilter === p ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'
                    )}
                  >{p}</button>
                ))}
              </div>

              <span className="text-xs text-slate-500 ml-auto">{filteredUsers.length} users</span>
            </div>

            {/* Table */}
            <div className="rounded-2xl border border-white/5 overflow-hidden" style={{ background: '#111827' }}>
              {/* Header */}
              <div className="grid grid-cols-[2fr_1fr_80px_80px_80px_120px] gap-4 px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                {[
                  { field: 'email' as keyof AdminUser, label: 'User' },
                  { field: 'plan' as keyof AdminUser, label: 'Plan' },
                  { field: 'project_count' as keyof AdminUser, label: 'Projects' },
                  { field: 'total_exports' as keyof AdminUser, label: 'Exports' },
                  { field: 'last_sign_in_at' as keyof AdminUser, label: 'Last Active' },
                ].map(col => (
                  <button key={col.field}
                    onClick={() => setSort(col.field, sortField === col.field && sortDir === 'desc' ? 'asc' : 'desc')}
                    className="flex items-center gap-1 text-left hover:text-slate-300 transition-colors"
                  >
                    {col.label}
                    {sortField === col.field && <ArrowUpDown className="w-3 h-3 opacity-60" />}
                  </button>
                ))}
                <span>Actions</span>
              </div>

              {/* Rows */}
              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-5 h-5 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
                </div>
              ) : paginatedUsers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-600 gap-2">
                  <Users className="w-8 h-8" />
                  <p className="text-sm">No users found</p>
                </div>
              ) : (
                paginatedUsers.map(u => (
                  <div key={u.id}>
                    <div
                      className="grid grid-cols-[2fr_1fr_80px_80px_80px_120px] gap-4 px-5 py-3 items-center hover:bg-white/3 transition-colors cursor-pointer"
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                      onClick={() => setExpandedUser(expandedUser === u.id ? null : u.id)}
                    >
                      {/* User */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                          {(u.display_name || u.email || '?')[0].toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-200 truncate">{u.display_name || '—'}</p>
                          <p className="text-[11px] text-slate-500 truncate">{u.email}</p>
                        </div>
                      </div>
                      <PlanBadge plan={u.plan} />
                      <span className="text-sm text-slate-300">{u.project_count}</span>
                      <span className="text-sm text-slate-300">{u.total_exports}</span>
                      <span className="text-[11px] text-slate-500">
                        {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString() : 'Never'}
                      </span>
                      {/* Actions */}
                      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => setPlanModal(u)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors" title="Change plan"
                        ><Crown className="w-3.5 h-3.5" /></button>
                        <button
                          onClick={() => setNotifModal(u)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 transition-colors" title="Send notification"
                        ><Bell className="w-3.5 h-3.5" /></button>
                        <button
                          onClick={() => { if (confirm(`Ban ${u.email}?`)) banUser(u.id) }}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Ban user"
                        ><Ban className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>

                    {/* Expanded row */}
                    <AnimatePresence>
                      {expandedUser === u.id && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                          style={{ background: 'rgba(99,102,241,0.04)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
                        >
                          <div className="px-8 py-4 grid grid-cols-4 gap-6 text-xs">
                            <div>
                              <p className="text-slate-600 mb-1">User ID</p>
                              <p className="font-mono text-[10px] text-slate-400 break-all">{u.id}</p>
                            </div>
                            <div>
                              <p className="text-slate-600 mb-1">Member since</p>
                              <p className="text-slate-300">{new Date(u.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                            </div>
                            <div>
                              <p className="text-slate-600 mb-1">Exports this month</p>
                              <p className="text-slate-300">{u.export_count_this_month}</p>
                            </div>
                            <div>
                              <p className="text-slate-600 mb-1">Estimated MRR</p>
                              <p className="text-emerald-400 font-semibold">
                                {u.plan === 'free' ? '—' : `₹${({ indie: 999, pro: 2499, team: 7999 }[u.plan] ?? 0) / 100}`}
                              </p>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))
              )}
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-600">
                Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filteredUsers.length)} of {filteredUsers.length}
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(page - 1)} disabled={page === 1}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 disabled:opacity-30 transition-colors"
                ><ChevronLeft className="w-4 h-4" /></button>
                {Array.from({ length: Math.min(totalPages, 7) }).map((_, i) => {
                  const p = i + 1
                  return (
                    <button key={p} onClick={() => setPage(p)}
                      className={clsx('w-7 h-7 rounded-lg text-xs font-medium transition-colors', p === page ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-white hover:bg-white/10')}
                    >{p}</button>
                  )
                })}
                <button
                  onClick={() => setPage(page + 1)} disabled={page === totalPages}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 disabled:opacity-30 transition-colors"
                ><ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>
          </div>
        )}

        {/* ── GROWTH TAB ───────────────────────────────────────── */}
        {tab === 'growth' && (
          <div className="space-y-5">
            {/* Range selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Range:</span>
              {[7, 14, 30, 90].map(d => (
                <button key={d} onClick={() => setGrowthRange(d)}
                  className={clsx('px-3 py-1.5 rounded-xl text-xs font-medium transition-colors', growthRange === d ? 'bg-indigo-600 text-white' : 'bg-white/5 border border-white/10 text-slate-400 hover:text-white')}
                >{d}d</button>
              ))}
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { key: 'new_users' as const,    label: 'New Signups',   color: '#6366f1' },
                { key: 'new_projects' as const, label: 'New Projects',  color: '#8b5cf6' },
                { key: 'exports' as const,      label: 'Exports',       color: '#10b981' },
              ].map(({ key, label, color }) => {
                const total = growthData.reduce((s, d) => s + Number(d[key]), 0)
                const chartData = growthData.map(d => ({ day: d.day, value: Number(d[key]) }))
                return (
                  <div key={key} className="rounded-2xl p-5 border border-white/5" style={{ background: '#111827' }}>
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-sm font-bold text-slate-200">{label}</h4>
                      <span className="text-lg font-bold text-white">{total.toLocaleString()}</span>
                    </div>
                    <p className="text-[10px] text-slate-600 mb-3">Last {growthRange} days</p>
                    <BarChart data={chartData} color={color} label={label} />
                  </div>
                )
              })}

              {/* Cumulative users */}
              <div className="rounded-2xl p-5 border border-white/5" style={{ background: '#111827' }}>
                <h4 className="text-sm font-bold text-slate-200 mb-1">Daily Active Summary</h4>
                <p className="text-[10px] text-slate-600 mb-3">Combined view</p>
                <div className="space-y-2 mt-4">
                  {growthData.slice(-7).reverse().map(d => (
                    <div key={d.day} className="flex items-center gap-3 text-xs">
                      <span className="text-slate-500 w-20 flex-shrink-0">{d.day}</span>
                      <span className="text-indigo-400 w-16">{d.new_users} users</span>
                      <span className="text-violet-400 w-20">{d.new_projects} projects</span>
                      <span className="text-emerald-400">{d.exports} exports</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── SUBSCRIPTIONS TAB ────────────────────────────────── */}
        {tab === 'subscriptions' && (
          <div className="space-y-5">
            {/* MRR breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { plan: 'indie', label: 'Indie', price: 999, color: '#3b82f6' },
                { plan: 'pro',   label: 'Pro',   price: 2499, color: '#6366f1' },
                { plan: 'team',  label: 'Team',  price: 7999, color: '#f59e0b' },
              ].map(({ plan, label, price, color }) => {
                const count = planDist.find(d => d.plan === plan)?.count ?? 0
                const mrr = (Number(count) * price) / 100
                return (
                  <div key={plan} className="rounded-2xl p-5 border border-white/5" style={{ background: '#111827' }}>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                      <span className="text-sm font-bold text-white capitalize">{label}</span>
                    </div>
                    <p className="text-2xl font-bold text-white">₹{mrr.toLocaleString()}</p>
                    <p className="text-xs text-slate-500 mt-1">{count} subscribers · ₹{(price / 100).toFixed(0)}/mo each</p>
                  </div>
                )
              })}
            </div>

            {/* Paid users table */}
            <div className="rounded-2xl border border-white/5 overflow-hidden" style={{ background: '#111827' }}>
              <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <h3 className="text-sm font-bold text-white">Paid Subscribers</h3>
              </div>
              <div className="divide-y divide-white/4">
                {users.filter(u => u.plan !== 'free').map(u => (
                  <div key={u.id} className="flex items-center gap-4 px-5 py-3 hover:bg-white/3 transition-colors">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-xs font-bold text-white">
                      {(u.display_name || u.email)[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-200 truncate font-medium">{u.display_name || u.email}</p>
                      <p className="text-[11px] text-slate-500 truncate">{u.email}</p>
                    </div>
                    <PlanBadge plan={u.plan} />
                    <span className="text-sm font-bold text-emerald-400 w-20 text-right">
                      ₹{({ indie: '9.99', pro: '24.99', team: '79.99' }[u.plan] ?? '0')}
                    </span>
                    <button
                      onClick={() => setPlanModal(u)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors"
                    ><Settings className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
                {users.filter(u => u.plan !== 'free').length === 0 && (
                  <div className="py-12 text-center text-slate-600 text-sm">No paid subscribers yet</div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── Modals ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {planModal && (
          <PlanModal
            user={planModal}
            onClose={() => setPlanModal(null)}
            onSave={async (plan) => {
              await updateUserPlan(planModal.id, plan)
              toast.success(`Updated ${planModal.display_name || planModal.email} to ${plan}`)
              setPlanModal(null)
            }}
          />
        )}
        {notifModal && (
          <NotifModal
            user={notifModal}
            onClose={() => setNotifModal(null)}
            onSend={async (title, body) => {
              await sendNotification(notifModal.id, title, body)
              toast.success('Notification sent')
              setNotifModal(null)
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
