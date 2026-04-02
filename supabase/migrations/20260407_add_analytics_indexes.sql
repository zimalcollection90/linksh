-- Add index to speed up country analytics queries
CREATE INDEX IF NOT EXISTS idx_click_events_country ON public.click_events(country) WHERE country IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_click_events_country_code ON public.click_events(country_code) WHERE country_code IS NOT NULL;

-- Index for filtering real clicks efficiently
CREATE INDEX IF NOT EXISTS idx_click_events_real_clicks ON public.click_events(is_bot, is_filtered, is_unique, clicked_at);

-- Index for per-user analytics
CREATE INDEX IF NOT EXISTS idx_click_events_user_country ON public.click_events(user_id, country, is_unique) WHERE is_bot = false AND is_filtered = false;
