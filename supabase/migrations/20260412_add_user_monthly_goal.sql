-- Add monthly_click_goal column to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS monthly_click_goal INTEGER DEFAULT 0;

-- Comment for documentation
COMMENT ON COLUMN public.users.monthly_click_goal IS 'Individual monthly click target for members set by admin. 0 uses global site setting.';
