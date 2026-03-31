-- Site Settings table for global configurations
CREATE TABLE IF NOT EXISTS public.site_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text NOT NULL,
  description text,
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to view settings
DROP POLICY IF EXISTS "Allow all authenticated users to view site settings" ON public.site_settings;
CREATE POLICY "Allow all authenticated users to view site settings"
  ON public.site_settings FOR SELECT
  USING (auth.role() = 'authenticated');

-- Allow admins to manage site settings
DROP POLICY IF EXISTS "Allow admins to manage site settings" ON public.site_settings;
CREATE POLICY "Allow admins to manage site settings"
  ON public.site_settings
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND (users.role = 'admin' OR users.role = 'super_admin')
    )
  );

-- Seed with default monthly click goal
INSERT INTO public.site_settings (key, value, description)
VALUES ('monthly_click_goal', '1000', 'The platform-wide monthly click target for members.')
ON CONFLICT (key) DO NOTHING;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS update_site_settings_updated_at ON public.site_settings;
CREATE TRIGGER update_site_settings_updated_at
  BEFORE UPDATE ON public.site_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
