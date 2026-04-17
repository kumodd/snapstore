import { create } from 'zustand'
import { supabase } from '../lib/supabase'

export interface AdminUser {
  id: string
  display_name: string | null
  avatar_url: string | null
  email: string
  plan: 'free' | 'indie' | 'pro' | 'team'
  export_count_this_month: number
  project_count: number
  total_exports: number
  last_sign_in_at: string | null
  created_at: string
}

export interface GrowthPoint {
  day: string
  new_users: number
  new_projects: number
  exports: number
}

export interface PlanDist {
  plan: string
  count: number
}

export interface AdminStats {
  totalUsers: number
  activeThisWeek: number
  totalProjects: number
  totalExports: number
  mrrEstimate: number
  paidUsers: number
  freeUsers: number
  churnRisk: number
}

interface AdminStore {
  isAdmin: boolean
  isChecking: boolean
  users: AdminUser[]
  growthData: GrowthPoint[]
  planDist: PlanDist[]
  stats: AdminStats | null
  isLoading: boolean
  searchQuery: string
  planFilter: string
  sortField: keyof AdminUser
  sortDir: 'asc' | 'desc'
  page: number
  pageSize: number

  checkAdminStatus: () => Promise<void>
  loadDashboard: () => Promise<void>
  loadUsers: () => Promise<void>
  loadGrowth: (days?: number) => Promise<void>
  updateUserPlan: (userId: string, plan: AdminUser['plan']) => Promise<void>
  banUser: (userId: string) => Promise<void>
  sendNotification: (userId: string, title: string, body: string) => Promise<void>
  setSearch: (q: string) => void
  setPlanFilter: (plan: string) => void
  setSort: (field: keyof AdminUser, dir: 'asc' | 'desc') => void
  setPage: (page: number) => void
}

const MRR_BY_PLAN: Record<string, number> = {
  free: 0, indie: 999, pro: 2499, team: 7999,
}

export const useAdminStore = create<AdminStore>((set, get) => ({
  isAdmin: false,
  isChecking: true,
  users: [],
  growthData: [],
  planDist: [],
  stats: null,
  isLoading: false,
  searchQuery: '',
  planFilter: 'all',
  sortField: 'created_at',
  sortDir: 'desc',
  page: 1,
  pageSize: 25,

  checkAdminStatus: async () => {
    set({ isChecking: true })
    const { data } = await supabase.from('admin_users').select('id').maybeSingle()
    set({ isAdmin: !!data, isChecking: false })
  },

  loadDashboard: async () => {
    await Promise.all([
      get().loadUsers(),
      get().loadGrowth(30),
      (async () => {
        const { data } = await supabase.from('admin_plan_distribution').select('*')
        if (data) set({ planDist: data as PlanDist[] })
      })(),
    ])

    const { users: u } = get()
    const weekAgo = new Date(Date.now() - 7 * 86400_000).toISOString()
    const totalExports = u.reduce((s, x) => s + x.total_exports, 0)
    const paidUsers = u.filter(x => x.plan !== 'free').length
    const freeUsers = u.filter(x => x.plan === 'free').length
    const mrrEstimate = u.reduce((s, x) => s + (MRR_BY_PLAN[x.plan] ?? 0), 0)
    const activeThisWeek = u.filter(x => x.last_sign_in_at && x.last_sign_in_at > weekAgo).length
    const churnRisk = u.filter(x => x.plan !== 'free' && x.project_count === 0).length

    set({
      stats: {
        totalUsers: u.length,
        activeThisWeek,
        totalProjects: u.reduce((s, x) => s + x.project_count, 0),
        totalExports,
        mrrEstimate,
        paidUsers,
        freeUsers,
        churnRisk,
      }
    })
  },

  loadUsers: async () => {
    set({ isLoading: true })
    const { data, error } = await supabase
      .from('admin_user_summary')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error && data) set({ users: data as AdminUser[] })
    set({ isLoading: false })
    return undefined
  },

  loadGrowth: async (days = 30) => {
    const since = new Date(Date.now() - days * 86400_000).toISOString().split('T')[0]
    const { data } = await supabase
      .from('admin_growth_metrics')
      .select('*')
      .gte('day', since)
      .order('day', { ascending: true })
    if (data) set({ growthData: data as GrowthPoint[] })
    return undefined
  },

  updateUserPlan: async (userId, plan) => {
    const { error } = await (supabase as any)
      .from('profiles')
      .update({ plan })
      .eq('id', userId)
    if (!error) {
      set(state => ({
        users: state.users.map(u => u.id === userId ? { ...u, plan } : u)
      }))
    }
  },

  banUser: async (userId) => {
    // Revoke session + flag in profiles (requires service role in production)
    await (supabase as any).from('profiles').update({ plan: 'free' }).eq('id', userId)
  },

  sendNotification: async (userId, title, body) => {
    await (supabase as any).from('notifications').insert({
      user_id: userId,
      type: 'admin_message',
      title,
      body,
    })
  },

  setSearch: (q) => set({ searchQuery: q, page: 1 }),
  setPlanFilter: (plan) => set({ planFilter: plan, page: 1 }),
  setSort: (field, dir) => set({ sortField: field, sortDir: dir }),
  setPage: (page) => set({ page }),
}))
