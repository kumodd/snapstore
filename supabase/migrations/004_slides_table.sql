-- Migration 004: Multi-Slide System
-- Run in Supabase SQL Editor

-- ── Slides Table ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.slides (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  position      INTEGER NOT NULL DEFAULT 0,
  title         TEXT NOT NULL DEFAULT 'Slide',
  canvas_state  JSONB NOT NULL DEFAULT '{}',
  thumbnail_b64 TEXT,           -- base64 JPEG preview, ~15–25KB
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_slides_project_id ON public.slides(project_id);
CREATE INDEX IF NOT EXISTS idx_slides_position   ON public.slides(project_id, position);

-- Auto-update updated_at on slides
DROP TRIGGER IF EXISTS slides_updated_at ON public.slides;
CREATE TRIGGER slides_updated_at
  BEFORE UPDATE ON public.slides
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ── Projects: add global_style + slide_count columns ──────────────────
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS slide_count  INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS global_style JSONB   NOT NULL DEFAULT '{}';

-- ── Templates: add multi-slide support ────────────────────────────────
ALTER TABLE public.templates
  ADD COLUMN IF NOT EXISTS slides      JSONB   NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS slide_count INTEGER NOT NULL DEFAULT 1;

-- ── RLS for slides ────────────────────────────────────────────────────
ALTER TABLE public.slides ENABLE ROW LEVEL SECURITY;

-- Users can only access slides belonging to their own projects
CREATE POLICY "slides_owner_all" ON public.slides
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = slides.project_id
        AND p.owner_id = auth.uid()
    )
  );
