-- Migration 003: Storage Buckets
-- Run in Supabase SQL Editor

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('project-assets', 'project-assets', false, 52428800, ARRAY['image/png','image/jpeg','image/webp']),
  ('exports', 'exports', false, 524288000, NULL),
  ('template-previews', 'template-previews', true, 10485760, NULL),
  ('device-frames', 'device-frames', true, 10485760, NULL),
  ('avatars', 'avatars', true, 5242880, ARRAY['image/png','image/jpeg','image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Storage RLS Policies
CREATE POLICY "project_assets_owner_rw" ON storage.objects
  FOR ALL USING (
    bucket_id = 'project-assets'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "exports_owner_rw" ON storage.objects
  FOR ALL USING (
    bucket_id = 'exports'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "template_previews_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'template-previews');

CREATE POLICY "device_frames_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'device-frames');

CREATE POLICY "avatars_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "avatars_owner_write" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
