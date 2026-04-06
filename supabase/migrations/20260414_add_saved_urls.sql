-- Create saved_urls table
CREATE TABLE IF NOT EXISTS public.saved_urls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  url text NOT NULL,
  title text,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.saved_urls ENABLE ROW LEVEL SECURITY;

-- Policies for users to manage their own saved URLs
CREATE POLICY "Users can view own saved URLs" ON public.saved_urls
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own saved URLs" ON public.saved_urls
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own saved URLs" ON public.saved_urls
  FOR DELETE USING (auth.uid() = user_id);

-- Add unique constraint to prevent duplicate URLs for the same user
ALTER TABLE public.saved_urls ADD CONSTRAINT unique_user_url UNIQUE (user_id, url);
