-- Store the synopsis and design document as PDF objects in Supabase Storage.
ALTER TABLE ca1_project_artifacts
  ADD COLUMN synopsis_pdf_path TEXT,
  ADD COLUMN design_document_pdf_path TEXT;

-- Private bucket: files are accessed through authenticated server-generated
-- signed URLs, not public object URLs.
INSERT INTO storage.buckets (id, name, public)
VALUES ('ca3-artifacts', 'ca3-artifacts', false)
ON CONFLICT (id) DO NOTHING;
