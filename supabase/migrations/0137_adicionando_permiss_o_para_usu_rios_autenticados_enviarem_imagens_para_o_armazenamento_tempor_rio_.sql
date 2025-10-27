CREATE POLICY "Allow authenticated uploads to temp_faces"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'temp_faces');