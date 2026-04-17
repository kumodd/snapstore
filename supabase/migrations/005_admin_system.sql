-- Migration 005: Admin System
-- Creates admin_users table, admin RLS bypass policies, and helper views

-- ── Admin Users Table ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_users (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('super_admin', 'admin', 'viewer')),
  added_by   UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_users_read_own" ON public.admin_users;
CREATE POLICY "admin_users_read_own" ON public.admin_users FOR SELECT USING (id = auth.uid());

-- ── Helper: Check if current user is admin ────────────────────────────
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid());
$$;

-- ── Admin bypass policies on profiles ─────────────────────────────────
DROP POLICY IF EXISTS "profiles_admin_all" ON public.profiles;
CREATE POLICY "profiles_admin_all" ON public.profiles
  FOR ALL USING (public.is_admin());

-- ── Admin bypass policies on projects ─────────────────────────────────
DROP POLICY IF EXISTS "projects_admin_all" ON public.projects;
CREATE POLICY "projects_admin_all" ON public.projects
  FOR ALL USING (public.is_admin());

-- ── Admin bypass policies on slides ───────────────────────────────────
DROP POLICY IF EXISTS "slides_admin_all" ON public.slides;
CREATE POLICY "slides_admin_all" ON public.slides
  FOR ALL USING (public.is_admin());

-- ── Growth Metrics View ───────────────────────────────────────────────
CREATE OR REPLACE VIEW public.admin_growth_metrics AS
SELECT
  date_trunc('day', p.created_at)::date AS day,
  COUNT(DISTINCT p.id)                  AS new_users,
  COUNT(DISTINCT pr.id)                 AS new_projects,
  COUNT(DISTINCT ej.id)                 AS exports
FROM public.profiles p
LEFT JOIN public.projects pr ON pr.owner_id = p.id
  AND date_trunc('day', pr.created_at) = date_trunc('day', p.created_at)
LEFT JOIN public.export_jobs ej ON ej.user_id = p.id
  AND date_trunc('day', ej.created_at) = date_trunc('day', p.created_at)
GROUP BY date_trunc('day', p.created_at)::date
ORDER BY day DESC;

-- ── Plan distribution view ─────────────────────────────────────────────
CREATE OR REPLACE VIEW public.admin_plan_distribution AS
SELECT
  plan,
  COUNT(*) AS count
FROM public.profiles
GROUP BY plan;

-- ── User activity summary view ─────────────────────────────────────────
CREATE OR REPLACE VIEW public.admin_user_summary AS
SELECT
  p.id,
  p.display_name,
  p.avatar_url,
  p.plan,
  p.export_count_this_month,
  p.created_at,
  p.updated_at,
  au.email,
  au.last_sign_in_at,
  COUNT(DISTINCT pr.id)   AS project_count,
  COUNT(DISTINCT ej.id)   AS total_exports
FROM public.profiles p
JOIN auth.users au ON au.id = p.id
LEFT JOIN public.projects pr ON pr.owner_id = p.id
LEFT JOIN public.export_jobs ej ON ej.user_id = p.id
GROUP BY p.id, p.display_name, p.avatar_url, p.plan,
         p.export_count_this_month, p.created_at, p.updated_at,
         au.email, au.last_sign_in_at;

-- ── Insert yourself as super_admin (replace with your user ID) ─────────
-- UPDATE: Run this after getting your user UUID from profiles table:
-- INSERT INTO public.admin_users (id, role) VALUES ('<YOUR_UUID>', 'super_admin')
-- ON CONFLICT (id) DO UPDATE SET role = 'super_admin';
