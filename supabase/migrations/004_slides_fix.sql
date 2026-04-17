-- Migration 004 FIX: Run this if 004_slides_table.sql gave errors
-- This is idempotent — safe to run multiple times

-- Re-create table if it was missed
CREATE TABLE IF NOT EXISTS public.slides (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  position      INTEGER NOT NULL DEFAULT 0,
  title         TEXT NOT NULL DEFAULT 'Slide',
  canvas_state  JSONB NOT NULL DEFAULT '{}',
  thumbnail_b64 TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_slides_project_id ON public.slides(project_id);
CREATE INDEX IF NOT EXISTS idx_slides_position   ON public.slides(project_id, position);

-- Trigger
DROP TRIGGER IF EXISTS slides_updated_at ON public.slides;
CREATE TRIGGER slides_updated_at
  BEFORE UPDATE ON public.slides
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Projects columns
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS slide_count  INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS global_style JSONB   NOT NULL DEFAULT '{}';

-- Templates columns
ALTER TABLE public.templates
  ADD COLUMN IF NOT EXISTS slides      JSONB   NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS slide_count INTEGER NOT NULL DEFAULT 1;

-- RLS (idempotent)
ALTER TABLE public.slides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "slides_owner_all" ON public.slides;
CREATE POLICY "slides_owner_all" ON public.slides
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = slides.project_id
        AND p.owner_id = auth.uid()
    )
  );
