-- Create the 'temp_faces' bucket for temporary face detection images
INSERT INTO storage.buckets (id, name, public)
VALUES ('temp_faces', 'temp_faces', true)
ON CONFLICT (id) DO NOTHING;

-- Create policies for the 'temp_faces' bucket
-- Allow anonymous users to upload files
CREATE POLICY "Allow anonymous uploads to temp_faces"
ON storage.objects FOR INSERT TO anon
WITH CHECK (bucket_id = 'temp_faces');

-- Allow anonymous users to read files
CREATE POLICY "Allow anonymous reads from temp_faces"
ON storage.objects FOR SELECT TO anon
USING (bucket_id = 'temp_faces');