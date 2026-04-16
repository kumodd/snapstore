-- Migration 002: Row Level Security Policies
-- Run after 001_initial_schema.sql

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_kits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ab_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.export_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Idempotent setup (Drop existing policies)
DO $$ DECLARE
  r RECORD;
BEGIN
  FOR r IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- ── Helper Functions for breaking RLS Recursion ───────────────────────
CREATE OR REPLACE FUNCTION public.is_workspace_owner(ws_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER AS $func$
  SELECT EXISTS(SELECT 1 FROM public.workspaces WHERE id = ws_id AND owner_id = auth.uid());
$func$;

-- ── Profiles ──────────────────────────────────────────────────────────
CREATE POLICY "profiles_select_self" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_update_self" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_insert_self" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- ── Workspaces ────────────────────────────────────────────────────────
CREATE POLICY "workspaces_member_select" ON public.workspaces FOR SELECT USING (
  owner_id = auth.uid() OR
  id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid())
);
CREATE POLICY "workspaces_owner_insert" ON public.workspaces FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "workspaces_owner_update" ON public.workspaces FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "workspaces_owner_delete" ON public.workspaces FOR DELETE USING (owner_id = auth.uid());

-- ── Workspace Members ─────────────────────────────────────────────────
CREATE POLICY "workspace_members_select" ON public.workspace_members FOR SELECT USING (
  user_id = auth.uid() OR public.is_workspace_owner(workspace_id)
);
CREATE POLICY "workspace_members_owner_manage" ON public.workspace_members FOR ALL USING (
  public.is_workspace_owner(workspace_id)
);

-- ── Projects ──────────────────────────────────────────────────────────
CREATE POLICY "projects_own_or_workspace" ON public.projects FOR ALL USING (
  owner_id = auth.uid() OR
  workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid())
);
CREATE POLICY "projects_insert_own" ON public.projects FOR INSERT WITH CHECK (owner_id = auth.uid());

-- ── Project Versions ──────────────────────────────────────────────────
CREATE POLICY "project_versions_via_project" ON public.project_versions FOR ALL USING (
  project_id IN (
    SELECT id FROM public.projects WHERE owner_id = auth.uid() OR
    workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid())
  )
);

-- ── A/B Variants ──────────────────────────────────────────────────────
CREATE POLICY "ab_variants_via_project" ON public.ab_variants FOR ALL USING (
  project_id IN (
    SELECT id FROM public.projects WHERE owner_id = auth.uid() OR
    workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid())
  )
);

-- ── Templates ─────────────────────────────────────────────────────────
CREATE POLICY "templates_public_read" ON public.templates FOR SELECT USING (is_approved = true);
CREATE POLICY "templates_author_write" ON public.templates FOR INSERT WITH CHECK (author_id = auth.uid());
CREATE POLICY "templates_author_update" ON public.templates FOR UPDATE USING (author_id = auth.uid());

-- ── Comments ──────────────────────────────────────────────────────────
CREATE POLICY "comments_project_access" ON public.comments FOR SELECT USING (
  project_id IN (
    SELECT id FROM public.projects WHERE owner_id = auth.uid() OR
    workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid())
  )
);
CREATE POLICY "comments_author_insert" ON public.comments FOR INSERT WITH CHECK (author_id = auth.uid());
CREATE POLICY "comments_author_update" ON public.comments FOR UPDATE USING (author_id = auth.uid());

-- ── Brand Kits ────────────────────────────────────────────────────────
CREATE POLICY "brand_kits_workspace_access" ON public.brand_kits FOR ALL USING (
  workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid())
  OR public.is_workspace_owner(workspace_id)
);

-- ── API Keys ──────────────────────────────────────────────────────────
CREATE POLICY "api_keys_workspace_access" ON public.api_keys FOR ALL USING (
  workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid())
);

-- ── Export Jobs ───────────────────────────────────────────────────────
CREATE POLICY "export_jobs_own" ON public.export_jobs FOR ALL USING (user_id = auth.uid());

-- ── Notifications ─────────────────────────────────────────────────────
CREATE POLICY "notifications_own" ON public.notifications FOR ALL USING (user_id = auth.uid());
