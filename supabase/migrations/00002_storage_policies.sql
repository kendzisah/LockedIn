-- ────────────────────────────────────────────────────
-- Storage bucket + policies
-- ────────────────────────────────────────────────────

-- Create audio bucket (private by default -- no public access)
INSERT INTO storage.buckets (id, name, public)
VALUES ('audio', 'audio', false)
ON CONFLICT (id) DO NOTHING;

-- Authenticated users can read via signed URLs.
-- Note: this allows any authenticated user to enumerate object metadata
-- in the audio bucket. Actual file bytes require a signed URL.
-- MVP tradeoff: acceptable. Future: restrict to objects referenced
-- by published sessions via a join-based policy.
CREATE POLICY "Authenticated download audio"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'audio');

-- Admins can upload audio files
CREATE POLICY "Admins upload audio"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'audio'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Admins can update audio files
CREATE POLICY "Admins update audio"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'audio'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Admins can delete audio files
CREATE POLICY "Admins delete audio"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'audio'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
