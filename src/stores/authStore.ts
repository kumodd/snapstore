import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { Profile, Plan } from '../lib/database.types'
import type { Session, User } from '@supabase/supabase-js'

interface AuthState {
  session: Session | null
  user: User | null
  profile: Profile | null
  isLoading: boolean
  isInitialized: boolean

  // Actions
  initialize: () => Promise<void>
  signInWithEmail: (email: string, password: string) => Promise<{ error: string | null }>
  signUpWithEmail: (email: string, password: string, displayName: string) => Promise<{ error: string | null }>
  signInWithGoogle: () => Promise<{ error: string | null }>
  signInWithMagicLink: (email: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<{ error: string | null }>
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>
  refreshProfile: () => Promise<void>
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: string | null }>

  // Plan feature gating
  plan: Plan
  isFeatureAllowed: (feature: FeatureGate) => boolean
  canCreateProject: (currentProjectCount: number) => boolean
  canExport: () => boolean
}

export type FeatureGate =
  | 'ai_composer'
  | 'ai_localize'
  | 'ai_copy'
  | 'api_access'
  | 'figma_plugin'
  | 'team_workspace'
  | 'brand_kit'
  | 'approval_workflow'
  | 'unlimited_projects'
  | 'unlimited_exports'
  | 'ab_variants'
  | 'aso_dashboard'

const PLAN_FEATURES: Record<Plan, Set<FeatureGate>> = {
  free: new Set([]),
  indie: new Set([
    'ai_composer', 'ai_localize', 'ai_copy', 'unlimited_projects',
    'unlimited_exports', 'ab_variants',
  ]),
  pro: new Set([
    'ai_composer', 'ai_localize', 'ai_copy', 'unlimited_projects',
    'unlimited_exports', 'ab_variants', 'api_access', 'figma_plugin',
  ]),
  team: new Set([
    'ai_composer', 'ai_localize', 'ai_copy', 'unlimited_projects',
    'unlimited_exports', 'ab_variants', 'api_access', 'figma_plugin',
    'team_workspace', 'brand_kit', 'approval_workflow', 'aso_dashboard',
  ]),
}

const FREE_PROJECT_LIMIT = 3
const FREE_EXPORT_LIMIT = 10

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  profile: null,
  isLoading: true,
  isInitialized: false,
  plan: 'free',

  initialize: async () => {
    // Get initial session
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      const profile = await fetchProfile(session.user.id)
      set({
        session,
        user: session.user,
        profile,
        plan: profile?.plan ?? 'free',
        isLoading: false,
        isInitialized: true,
      })
    } else {
      set({ isLoading: false, isInitialized: true })
    }

    // Listen for auth state changes
    supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        const profile = await fetchProfile(session.user.id)
        set({
          session,
          user: session.user,
          profile,
          plan: profile?.plan ?? 'free',
        })
      } else {
        set({ session: null, user: null, profile: null, plan: 'free' })
      }
    })
  },

  signInWithEmail: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  },

  signUpWithEmail: async (email, password, displayName) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: displayName },
        emailRedirectTo: `${import.meta.env.VITE_APP_URL}/auth/callback`,
      },
    })
    return { error: error?.message ?? null }
  },

  signInWithGoogle: async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${import.meta.env.VITE_APP_URL}/auth/callback`,
      },
    })
    return { error: error?.message ?? null }
  },

  signInWithMagicLink: async (email) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${import.meta.env.VITE_APP_URL}/auth/callback` },
    })
    return { error: error?.message ?? null }
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ session: null, user: null, profile: null, plan: 'free' })
  },

  resetPassword: async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${import.meta.env.VITE_APP_URL}/auth/update-password`,
    })
    return { error: error?.message ?? null }
  },

  updatePassword: async (newPassword) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    return { error: error?.message ?? null }
  },

  refreshProfile: async () => {
    const { user } = get()
    if (!user) return
    const profile = await fetchProfile(user.id)
    set({ profile, plan: profile?.plan ?? 'free' })
  },

  updateProfile: async (updates) => {
    const { user } = get()
    if (!user) return { error: 'Not authenticated' }
    const { error } = await (supabase as any)
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
    if (!error) {
      set(state => ({ profile: state.profile ? { ...state.profile, ...updates } : null }))
    }
    return { error: error?.message ?? null }
  },

  isFeatureAllowed: (feature) => {
    const { plan } = get()
    return PLAN_FEATURES[plan]?.has(feature) ?? false
  },

  canCreateProject: (currentProjectCount) => {
    const { plan } = get()
    if (plan === 'free') return currentProjectCount < FREE_PROJECT_LIMIT
    return true
  },

  canExport: () => {
    const { plan, profile } = get()
    if (plan === 'free') {
      return (profile?.export_count_this_month ?? 0) < FREE_EXPORT_LIMIT
    }
    return true
  },
}))

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  // Self-Healing: If the Postgres trigger failed when the user signed up (often due to missing keys),
  // they exist in `auth.users` but not in `public.profiles`. We create it here dynamically.
  if (error && error.code === 'PGRST116') {
    console.warn('Profile missing for user. Self-healing database row...')
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await (supabase as any).from('profiles').insert({
        id: user.id,
        display_name: user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User',
        avatar_url: user?.user_metadata?.avatar_url || null,
        plan: 'free',
        export_count_this_month: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      // Recursively fetch again now that it's inserted
      return fetchProfile(userId)
    }
  }

  if (error) {
    console.error('Failed to fetch profile:', error)
    return null
  }
  return data
}
