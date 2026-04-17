import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Search, Grid, List, MoreVertical, Star, Clock,
  Smartphone, Trash2, Copy, Settings, Sparkles, Zap,
  TrendingUp, Download, Users, ChevronRight, FolderOpen, ShieldAlert,
  LogOut, User, Crown, AlertTriangle
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import { useAdminStore } from '../stores/adminStore'
import type { Project } from '../lib/database.types'
import { formatDistanceToNow } from 'date-fns'
import toast from 'react-hot-toast'
import clsx from 'clsx'

type ViewMode = 'grid' | 'list'
type SortBy = 'updated_at' | 'created_at' | 'name'

export default function DashboardPage() {
  const navigate = useNavigate()
  const { profile, user, plan, canCreateProject, signOut } = useAuthStore()
  const { isAdmin, checkAdminStatus } = useAdminStore()
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false)
  const avatarRef = useRef<HTMLDivElement>(null)

  useEffect(() => { checkAdminStatus() }, [])

  useEffect(() => {
    if (!avatarMenuOpen) return
    const handleOutside = (e: MouseEvent) => {
      if (!avatarRef.current?.contains(e.target as Node)) setAvatarMenuOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [avatarMenuOpen])
  const [projects, setProjects] = useState<Project[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [sortBy, setSortBy] = useState<SortBy>('updated_at')
  const [searchQuery, setSearchQuery] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null)

  const fetchProjects = useCallback(async () => {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order(sortBy, { ascending: sortBy === 'name' })
    if (error) { toast.error('Failed to load projects'); return }
    setProjects(data ?? [])
    setIsLoading(false)
  }, [sortBy])

  useEffect(() => { fetchProjects() }, [fetchProjects])

  const filteredProjects = projects.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const createProject = async () => {
    if (!canCreateProject(projects.length)) {
      toast.error(`Free plan is limited to 3 projects. Upgrade to Indie for unlimited.`)
      return
    }
    setIsCreating(true)
    const newProject = {
      owner_id: user!.id,
      workspace_id: null as string | null,
      name: 'Untitled Project',
      app_description: null as string | null,
      app_category: null as string | null,
      platform: 'ios' as const,
      status: 'draft' as const,
      canvas_state: null,
      thumbnail_url: null as string | null,
      export_count: 0,
      is_pay_per_project: false,
      ppp_purchase_id: null as string | null,
    }
    const { data, error } = await supabase.from('projects').insert(newProject as any).select().single() as { data: Project | null, error: any }
    setIsCreating(false)
    if (error || !data) { 
      toast.error(`Could not create project: ${error?.message || error?.details || 'Unknown error'}`)
      console.error('Project creation error:', error)
      return 
    }
    navigate(`/editor/${(data as Project).id}`)
  }

  const startDeleteProject = (projectId: string) => {
    setProjectToDelete(projectId)
  }

  const confirmDeleteProject = async () => {
    if (!projectToDelete) return
    const { error } = await supabase.from('projects').delete().eq('id', projectToDelete)
    if (error) { toast.error('Delete failed'); return }
    setProjects(prev => prev.filter(p => p.id !== projectToDelete))
    toast.success('Project deleted')
    setProjectToDelete(null)
  }

  const duplicateProject = async (project: Project) => {
    const { data, error } = await supabase.from('projects').insert({
      ...(project as any),
      id: undefined,
      name: `${project.name} (Copy)`,
      created_at: undefined,
      updated_at: undefined,
    } as any).select().single() as { data: Project | null, error: any }
    if (error || !data) { toast.error('Duplicate failed'); return }
    setProjects(prev => [(data as Project), ...prev])
    toast.success('Project duplicated')
  }

  // Stats
  const totalExports = projects.reduce((sum, p) => sum + p.export_count, 0)
  const exportsRemaining = plan === 'free' ? Math.max(0, 10 - (profile?.export_count_this_month ?? 0)) : null

  return (
    <div className="min-h-screen bg-surface-950 flex flex-col">
      {/* Top nav */}
      <header className="border-b border-surface-800 bg-surface-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-brand flex items-center justify-center shadow-glow-sm">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-display font-bold text-lg text-white">SnapStore</span>
          </div>

          <div className="flex items-center gap-3">
            {isAdmin && (
              <button
                onClick={() => navigate('/admin')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-red-500/15 text-red-400 border border-red-500/20 hover:bg-red-500/25 transition-colors"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                Admin
              </button>
            )}
            {plan === 'free' && (
              <button
                onClick={() => navigate('/pricing')}
                className="btn-gradient btn-sm hidden sm:inline-flex"
              >
                <Zap className="w-3 h-3" />
                Upgrade
              </button>
            )}
            {/* Avatar dropdown */}
            <div ref={avatarRef} className="relative">
              <button
                onClick={() => setAvatarMenuOpen(s => !s)}
                className="w-9 h-9 rounded-full border-2 flex items-center justify-center text-sm font-bold text-white overflow-hidden transition-all hover:ring-2 hover:ring-indigo-500/50"
                style={{ background: profile?.avatar_url ? 'transparent' : 'linear-gradient(135deg, #4f46e5, #7c3aed)', borderColor: 'rgba(79,70,229,0.4)' }}
              >
                {profile?.avatar_url
                  ? <img src={profile.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                  : profile?.display_name?.[0]?.toUpperCase() ?? 'U'}
              </button>

              <AnimatePresence>
                {avatarMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -4 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-11 w-56 rounded-2xl border border-white/10 shadow-2xl overflow-hidden z-50"
                    style={{ background: '#111827' }}
                  >
                    {/* User info */}
                    <div className="px-4 py-3 border-b border-white/8">
                      <p className="text-xs font-semibold text-white truncate">{profile?.display_name || 'User'}</p>
                      <p className="text-[10px] text-slate-500 truncate mt-0.5">{user?.email}</p>
                      <span className="inline-block mt-1.5 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                        style={{ background: plan === 'free' ? 'rgba(100,116,139,0.2)' : 'rgba(99,102,241,0.2)', color: plan === 'free' ? '#94a3b8' : '#a5b4fc' }}>
                        {plan}
                      </span>
                    </div>
                    {/* Menu items */}
                    {[
                      { icon: User,     label: 'My Profile',    action: () => { navigate('/profile'); setAvatarMenuOpen(false) } },
                      { icon: Crown,    label: 'Subscription',  action: () => { navigate('/profile', { state: { tab: 'subscription' } }); setAvatarMenuOpen(false) } },
                      { icon: Settings, label: 'Settings',      action: () => { navigate('/profile', { state: { tab: 'security' } }); setAvatarMenuOpen(false) } },
                      ...(plan !== 'team' ? [{ icon: Zap, label: plan === 'free' ? 'Upgrade Plan' : plan === 'indie' ? 'Upgrade to Pro' : 'Upgrade to Team', action: () => { navigate('/pricing'); setAvatarMenuOpen(false) } }] : []),
                    ].map(item => (
                      <button key={item.label} onClick={item.action}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:text-white hover:bg-white/5 transition-colors text-left"
                      >
                        <item.icon className="w-4 h-4 text-slate-500" />
                        {item.label}
                      </button>
                    ))}
                    <div className="border-t border-white/8">
                      <button
                        onClick={async () => { await signOut(); navigate('/') }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/5 transition-colors text-left"
                      >
                        <LogOut className="w-4 h-4" /> Sign Out
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8 space-y-8">
        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total Projects', value: projects.length, icon: FolderOpen, color: 'text-brand-400' },
            { label: 'Total Exports', value: totalExports, icon: Download, color: 'text-accent-cyan' },
            { label: 'Plan', value: plan.charAt(0).toUpperCase() + plan.slice(1), icon: Star, color: 'text-accent-amber' },
            exportsRemaining !== null
              ? { label: 'Exports Left', value: exportsRemaining, icon: TrendingUp, color: 'text-accent-green' }
              : { label: 'Team Members', value: '—', icon: Users, color: 'text-accent-purple' },
          ].map(stat => (
            <div key={stat.label} className="card p-4 flex items-center gap-3">
              <div className={`${stat.color} opacity-80`}>
                <stat.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-surface-500">{stat.label}</p>
                <p className="text-lg font-bold text-white">{stat.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Free plan usage — proactive quota warnings */}
        {plan === 'free' && (() => {
          const projPct  = (projects.length / 3) * 100
          const expUsed  = profile?.export_count_this_month ?? 0
          const expPct   = (expUsed / 10) * 100
          const projWarn = projPct >= 67   // 2/3 used
          const expWarn  = expPct  >= 70   // 7/10 used
          const projCrit = projPct >= 100
          const expCrit  = expPct  >= 100
          const barColor = (pct: number) =>
            pct >= 100 ? '#ef4444' : pct >= 70 ? '#f59e0b' : '#6366f1'
          return (
            <div className={clsx(
              'card p-4 space-y-3 transition-all',
              (projCrit || expCrit) && 'border border-red-500/30',
              (!projCrit && !expCrit && (projWarn || expWarn)) && 'border border-amber-500/25',
            )}>
              {/* Warning banner */}
              {(projWarn || expWarn) && (
                <div className={clsx(
                  'flex items-center gap-2 text-xs rounded-lg px-3 py-2',
                  (projCrit || expCrit) ? 'bg-red-500/10 text-red-300' : 'bg-amber-500/10 text-amber-300'
                )}>
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>
                    {projCrit ? 'Project limit reached — ' : projWarn ? `${3 - projects.length} project slot${3 - projects.length === 1 ? '' : 's'} remaining — ` : ''}
                    {expCrit  ? 'Export limit reached' : expWarn ? `${10 - expUsed} export${10 - expUsed === 1 ? '' : 's'} left this month` : ''}
                  </span>
                </div>
              )}

              <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                <div className="flex-1 space-y-2.5">
                  {/* Projects bar */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-surface-400">Projects</span>
                      <span className={clsx('font-semibold', projCrit ? 'text-red-400' : projWarn ? 'text-amber-400' : 'text-white')}>
                        {projects.length} / 3
                      </span>
                    </div>
                    <div className="h-1.5 bg-surface-800 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(projPct, 100)}%`, backgroundColor: barColor(projPct) }} />
                    </div>
                  </div>
                  {/* Exports bar */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-surface-400">Exports this month</span>
                      <span className={clsx('font-semibold', expCrit ? 'text-red-400' : expWarn ? 'text-amber-400' : 'text-white')}>
                        {expUsed} / 10
                      </span>
                    </div>
                    <div className="h-1.5 bg-surface-800 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(expPct, 100)}%`, backgroundColor: barColor(expPct) }} />
                    </div>
                  </div>
                </div>
                <button onClick={() => navigate('/pricing')} className="btn-gradient btn-sm whitespace-nowrap flex-shrink-0">
                  Upgrade to Indie <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          )
        })()}

        {/* Header row */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <h1 className="font-display font-bold text-2xl text-white flex-1">My Projects</h1>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-surface-500" />
              <input
                id="search-projects"
                type="text"
                placeholder="Search projects…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="input-sm pl-8 w-44"
              />
            </div>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as SortBy)}
              className="input-sm w-36 cursor-pointer"
            >
              <option value="updated_at">Last edited</option>
              <option value="created_at">Date created</option>
              <option value="name">Name A–Z</option>
            </select>

            {/* View toggle */}
            <div className="flex items-center bg-surface-800 rounded-lg p-0.5">
              {(['grid', 'list'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={clsx(
                    'p-1.5 rounded-md transition-colors',
                    viewMode === mode ? 'bg-surface-600 text-white' : 'text-surface-500 hover:text-surface-300'
                  )}
                >
                  {mode === 'grid' ? <Grid className="w-3.5 h-3.5" /> : <List className="w-3.5 h-3.5" />}
                </button>
              ))}
            </div>

            {/* New project */}
            <button
              id="btn-new-project"
              onClick={createProject}
              disabled={isCreating}
              className="btn-primary btn-sm"
            >
              {isCreating ? (
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : <Plus className="w-3.5 h-3.5" />}
              New Project
            </button>
          </div>
        </div>

        {/* Projects grid/list */}
        {isLoading ? (
          <div className={clsx('gap-4', viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'flex flex-col')}>
            {[...Array(6)].map((_, i) => (
              <div key={i} className="card h-48 animate-pulse bg-surface-800/50" />
            ))}
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-surface-800 flex items-center justify-center mb-4">
              <FolderOpen className="w-8 h-8 text-surface-600" />
            </div>
            <h3 className="font-display font-semibold text-xl text-white mb-2">
              {searchQuery ? 'No projects found' : 'No projects yet'}
            </h3>
            <p className="text-surface-500 mb-6 max-w-sm">
              {searchQuery
                ? `No projects match "${searchQuery}". Try a different search.`
                : 'Create your first project to start building beautiful App Store screenshots.'}
            </p>
            {!searchQuery && (
              <button onClick={createProject} className="btn-primary btn-md">
                <Plus className="w-4 h-4" /> Create first project
              </button>
            )}
          </div>
        ) : (
          <motion.div
            className={clsx(
              'gap-4',
              viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'flex flex-col'
            )}
            layout
          >
            {filteredProjects.map((project, i) => (
              <motion.div
                key={project.id}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <ProjectCard
                  project={project}
                  viewMode={viewMode}
                  isMenuOpen={openMenuId === project.id}
                  onOpenMenu={() => setOpenMenuId(openMenuId === project.id ? null : project.id)}
                  onCloseMenu={() => setOpenMenuId(null)}
                  onOpen={() => navigate(`/editor/${project.id}`)}
                  onDelete={() => startDeleteProject(project.id)}
                  onDuplicate={() => duplicateProject(project)}
                />
              </motion.div>
            ))}
          </motion.div>
        )}
      </main>

      {/* Delete Confirmation Modal */}
      {projectToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-surface-900 border border-surface-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl"
          >
            <h3 className="text-lg font-bold text-white mb-2">Delete Project?</h3>
            <p className="text-surface-400 text-sm mb-6">
              Are you sure you want to delete this project? This action cannot be undone and your layout data will be permanently lost.
            </p>
            <div className="flex gap-3 justify-end">
              <button 
                onClick={() => setProjectToDelete(null)}
                className="btn-secondary btn-sm"
              >
                Cancel
              </button>
              <button 
                onClick={confirmDeleteProject}
                className="px-4 py-2 bg-accent-red hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Delete Permanently
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}

interface ProjectCardProps {
  project: Project
  viewMode: ViewMode
  isMenuOpen: boolean
  onOpenMenu: () => void
  onCloseMenu: () => void
  onOpen: () => void
  onDelete: () => void
  onDuplicate: () => void
}

function ProjectCard({ project, viewMode, isMenuOpen, onOpenMenu, onCloseMenu, onOpen, onDelete, onDuplicate }: ProjectCardProps) {
  const statusColors: Record<string, string> = {
    draft: 'badge-brand',
    in_review: 'badge-amber',
    approved: 'badge-green',
    archived: 'bg-surface-700/50 text-surface-400',
  }

  return (
    <div
      className={clsx(
        'card-hover group relative cursor-pointer overflow-hidden',
        viewMode === 'list' ? 'flex items-center gap-4 p-4' : 'flex flex-col'
      )}
      onClick={onOpen}
    >
      {/* Thumbnail */}
      {viewMode === 'grid' && (
        <div className="h-40 bg-surface-800 relative overflow-hidden">
          {project.thumbnail_url ? (
            <img src={project.thumbnail_url} alt={project.name} className="w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <Smartphone className="w-12 h-12 text-surface-700" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-surface-900/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      )}

      {viewMode === 'list' && (
        <div className="w-16 h-16 rounded-xl bg-surface-800 flex items-center justify-center flex-shrink-0">
          {project.thumbnail_url
            ? <img src={project.thumbnail_url} alt="" className="w-full h-full object-cover rounded-xl" />
            : <Smartphone className="w-6 h-6 text-surface-600" />}
        </div>
      )}

      <div className={clsx('flex-1', viewMode === 'grid' ? 'p-4' : '')}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-semibold text-white truncate text-sm">{project.name}</h3>
            <p className="text-xs text-surface-500 mt-0.5 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDistanceToNow(new Date(project.updated_at), { addSuffix: true })}
            </p>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className={`badge text-xs ${statusColors[project.status] ?? ''}`}>
              {project.status}
            </span>
            <button
              id={`menu-${project.id}`}
              onClick={e => { e.stopPropagation(); onOpenMenu() }}
              className="p-1 rounded-lg text-surface-500 hover:text-surface-200 hover:bg-surface-700 transition-colors opacity-0 group-hover:opacity-100"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
          </div>
        </div>

        {viewMode === 'grid' && (
          <div className="flex items-center gap-2 mt-3 text-xs text-surface-500">
            <span className="capitalize">{project.platform}</span>
            <span>·</span>
            <span>{project.export_count} exports</span>
          </div>
        )}
      </div>

      {/* Dropdown menu */}
      {isMenuOpen && (
        <div
          className="absolute right-3 top-12 z-20 card shadow-card-hover w-44 py-1 animate-fade-in"
          onClick={e => e.stopPropagation()}
        >
          {[
            { label: 'Open editor', icon: Settings, action: onOpen },
            { label: 'Duplicate', icon: Copy, action: onDuplicate },
            { label: 'Delete', icon: Trash2, action: onDelete, danger: true },
          ].map(item => (
            <button
              key={item.label}
              onClick={() => { item.action(); onCloseMenu() }}
              className={clsx(
                'w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors',
                item.danger
                  ? 'text-accent-red hover:bg-accent-red/10'
                  : 'text-surface-200 hover:bg-surface-800'
              )}
            >
              <item.icon className="w-3.5 h-3.5" />
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
