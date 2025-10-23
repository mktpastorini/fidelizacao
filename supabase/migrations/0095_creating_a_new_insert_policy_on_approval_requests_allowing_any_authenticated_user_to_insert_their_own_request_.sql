CREATE POLICY "Users can insert their own requests" ON public.approval_requests 
FOR INSERT TO authenticated WITH CHECK (
  (auth.uid() = user_id)
);