-- Enhanced click tracking: filter_reason, is_filtered, real click stats
-- Also sets default earnings_rate to 0 to disable monetization by default

-- Add filter tracking columns (safe, idempotent)
DO $$ BEGIN
  ALTER TABLE public.click_events ADD COLUMN IF NOT EXISTS is_filtered boolean DEFAULT false;
  ALTER TABLE public.click_events ADD COLUMN IF NOT EXISTS filter_reason text;
  ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_active_at timestamp with time zone;
  ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_seen_ip text;
  ALTER TABLE public.users ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Set earnings_rate default to 0 (monetization disabled by default)
DO $$ BEGIN
  ALTER TABLE public.users ALTER COLUMN earnings_rate SET DEFAULT 0;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.earnings ALTER COLUMN rate SET DEFAULT 0;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Backfill is_filtered based on existing is_bot/is_unique
UPDATE public.click_events
SET
  is_filtered = COALESCE(is_bot, false) OR NOT COALESCE(is_unique, true),
  filter_reason = CASE
    WHEN COALESCE(is_bot, false) THEN 'bot'
    WHEN NOT COALESCE(is_unique, true) THEN 'duplicate_ip_24h'
    ELSE NULL
  END
WHERE (is_filtered IS NULL OR is_filtered = false)
  AND (COALESCE(is_bot, false) = true OR COALESCE(is_unique, true) = false);

-- Backfill: set quality_score=0 for bots
UPDATE public.click_events
SET quality_score = 0
WHERE is_bot = true AND quality_score > 0;

-- Function to get real click stats for a user
CREATE OR REPLACE FUNCTION public.get_user_click_stats(p_user_id uuid)
RETURNS TABLE (
  total_clicks bigint,
  real_clicks bigint,
  unique_users bigint,
  filtered_clicks bigint,
  bot_excluded bigint
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    COUNT(*)::bigint AS total_clicks,
    COUNT(*) FILTER (WHERE NOT COALESCE(is_bot, false) AND COALESCE(is_unique, false) AND NOT COALESCE(is_filtered, false))::bigint AS real_clicks,
    COUNT(DISTINCT ip_address) FILTER (WHERE NOT COALESCE(is_bot, false) AND COALESCE(is_unique, false) AND NOT COALESCE(is_filtered, false))::bigint AS unique_users,
    COUNT(*) FILTER (WHERE COALESCE(is_filtered, false) AND NOT COALESCE(is_bot, false))::bigint AS filtered_clicks,
    COUNT(*) FILTER (WHERE COALESCE(is_bot, false))::bigint AS bot_excluded
  FROM public.click_events
  WHERE user_id = p_user_id;
$$;

-- Function to get click stats for a company (admin view)
CREATE OR REPLACE FUNCTION public.get_company_click_stats(p_company_id uuid)
RETURNS TABLE (
  total_clicks bigint,
  real_clicks bigint,
  unique_users bigint,
  filtered_clicks bigint,
  bot_excluded bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::bigint AS total_clicks,
    COUNT(*) FILTER (WHERE NOT COALESCE(ce.is_bot, false) AND COALESCE(ce.is_unique, false) AND NOT COALESCE(ce.is_filtered, false))::bigint AS real_clicks,
    COUNT(DISTINCT ce.ip_address) FILTER (WHERE NOT COALESCE(ce.is_bot, false) AND COALESCE(ce.is_unique, false) AND NOT COALESCE(ce.is_filtered, false))::bigint AS unique_users,
    COUNT(*) FILTER (WHERE COALESCE(ce.is_filtered, false) AND NOT COALESCE(ce.is_bot, false))::bigint AS filtered_clicks,
    COUNT(*) FILTER (WHERE COALESCE(ce.is_bot, false))::bigint AS bot_excluded
  FROM public.click_events ce
  WHERE ce.user_id IN (
    SELECT cm.user_id FROM public.company_members cm WHERE cm.company_id = p_company_id
  );
END;
$$;

-- Function to get daily click breakdown for a user
CREATE OR REPLACE FUNCTION public.get_user_daily_clicks(p_user_id uuid, p_days integer DEFAULT 30)
RETURNS TABLE (
  day date,
  total bigint,
  real_clicks bigint,
  unique_users bigint,
  bots bigint
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    DATE(clicked_at) AS day,
    COUNT(*)::bigint AS total,
    COUNT(*) FILTER (WHERE NOT COALESCE(is_bot, false) AND COALESCE(is_unique, false) AND NOT COALESCE(is_filtered, false))::bigint AS real_clicks,
    COUNT(DISTINCT ip_address) FILTER (WHERE NOT COALESCE(is_bot, false) AND COALESCE(is_unique, false) AND NOT COALESCE(is_filtered, false))::bigint AS unique_users,
    COUNT(*) FILTER (WHERE COALESCE(is_bot, false))::bigint AS bots
  FROM public.click_events
  WHERE user_id = p_user_id
    AND clicked_at >= NOW() - (p_days || ' days')::interval
  GROUP BY DATE(clicked_at)
  ORDER BY day;
$$;

-- Function to get per-member stats for admin (company-scoped)
CREATE OR REPLACE FUNCTION public.get_member_stats_for_company(p_company_id uuid)
RETURNS TABLE (
  user_id uuid,
  total_clicks bigint,
  real_clicks bigint,
  unique_users bigint,
  bot_excluded bigint,
  filtered_clicks bigint,
  link_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ce.user_id,
    COUNT(*)::bigint AS total_clicks,
    COUNT(*) FILTER (WHERE NOT COALESCE(ce.is_bot, false) AND COALESCE(ce.is_unique, false) AND NOT COALESCE(ce.is_filtered, false))::bigint AS real_clicks,
    COUNT(DISTINCT ce.ip_address) FILTER (WHERE NOT COALESCE(ce.is_bot, false) AND COALESCE(ce.is_unique, false) AND NOT COALESCE(ce.is_filtered, false))::bigint AS unique_users,
    COUNT(*) FILTER (WHERE COALESCE(ce.is_bot, false))::bigint AS bot_excluded,
    COUNT(*) FILTER (WHERE COALESCE(ce.is_filtered, false) AND NOT COALESCE(ce.is_bot, false))::bigint AS filtered_clicks,
    COUNT(DISTINCT ce.link_id)::bigint AS link_count
  FROM public.click_events ce
  WHERE ce.user_id IN (
    SELECT cm.user_id FROM public.company_members cm WHERE cm.company_id = p_company_id
  )
  GROUP BY ce.user_id;
END;
$$;

-- Update resolve_link_and_log_click to set is_filtered and filter_reason
CREATE OR REPLACE FUNCTION public.resolve_link_and_log_click(
  p_code text,
  p_ip text,
  p_user_agent text,
  p_referrer text,
  p_device_type text,
  p_browser text,
  p_os text,
  p_password text DEFAULT NULL
)
RETURNS TABLE (
  destination_url text,
  requires_password boolean,
  click_event_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  l public.links%ROWTYPE;
  v_is_bot boolean;
  v_is_self_click boolean;
  v_is_unique boolean;
  v_ip_24h_clicked boolean;
  v_click_id uuid;
  v_is_filtered boolean;
  v_filter_reason text;
BEGIN
  SELECT *
  INTO l
  FROM public.links
  WHERE short_code = p_code
    AND status = 'active'
    AND (expires_at IS NULL OR expires_at > now())
  LIMIT 1;

  IF l.id IS NULL THEN
    destination_url := NULL;
    requires_password := FALSE;
    click_event_id := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  IF l.is_password_protected = true THEN
    IF p_password IS NULL OR btrim(p_password) = '' THEN
      destination_url := NULL;
      requires_password := TRUE;
      click_event_id := NULL;
      RETURN NEXT;
      RETURN;
    END IF;
    IF l.password_hash IS NULL OR crypt(p_password, l.password_hash) <> l.password_hash THEN
      destination_url := NULL;
      requires_password := FALSE;
      click_event_id := NULL;
      RETURN NEXT;
      RETURN;
    END IF;
  END IF;

  -- Bot detection
  v_is_bot := FALSE;
  IF p_user_agent IS NOT NULL THEN
    v_is_bot := (p_user_agent ~* '(bot|crawler|spider|crawl|scraper|facebookexternalhit|pingdom|headless|bytespider|petalbot|semrush|ahrefs|mj12bot|dotbot|yandex|baiduspider|googlebot|bingbot|slurp|duckduckbot|teoma|exabot|facebot|ia_archiver|python-requests|curl|wget|libwww|java|go-http|okhttp|axios|scrapy|phantomjs|selenium|puppeteer|playwright)');
  END IF;

  -- Self-click prevention via stored IP exclusions for the link owner
  v_is_self_click := FALSE;
  IF p_ip IS NOT NULL THEN
    v_is_self_click := EXISTS (
      SELECT 1
      FROM public.ip_exclusions x
      WHERE x.user_id = l.user_id
        AND x.ip_address = p_ip
    );
  END IF;

  -- Unique click per IP per 24h (per link)
  v_ip_24h_clicked := FALSE;
  IF p_ip IS NOT NULL AND NOT v_is_self_click AND NOT v_is_bot THEN
    v_ip_24h_clicked := EXISTS (
      SELECT 1
      FROM public.click_events ce
      WHERE ce.link_id = l.id
        AND ce.ip_address = p_ip
        AND ce.clicked_at >= (now() - interval '24 hours')
        AND ce.is_unique = true
    );
  END IF;

  v_is_unique := (p_ip IS NOT NULL AND NOT v_is_bot AND NOT v_is_self_click AND NOT v_ip_24h_clicked);

  -- Determine if click should be filtered (not counted as real)
  v_is_filtered := FALSE;
  v_filter_reason := NULL;
  IF v_is_bot THEN
    v_is_filtered := TRUE;
    v_filter_reason := 'bot';
  ELSIF v_is_self_click THEN
    v_is_filtered := TRUE;
    v_filter_reason := 'self_click';
  ELSIF v_ip_24h_clicked THEN
    v_is_filtered := TRUE;
    v_filter_reason := 'duplicate_ip_24h';
  END IF;

  INSERT INTO public.click_events (
    link_id,
    user_id,
    ip_address,
    company_id,
    country,
    country_code,
    city,
    device_type,
    browser,
    os,
    referrer,
    user_agent,
    is_unique,
    is_bot,
    is_filtered,
    filter_reason,
    quality_score,
    clicked_at
  )
  VALUES (
    l.id,
    l.user_id,
    p_ip,
    l.company_id,
    NULL,
    NULL,
    NULL,
    p_device_type,
    p_browser,
    p_os,
    p_referrer,
    p_user_agent,
    v_is_unique,
    v_is_bot,
    v_is_filtered,
    v_filter_reason,
    CASE
      WHEN v_is_bot THEN 0
      WHEN v_is_self_click THEN 10
      WHEN v_ip_24h_clicked THEN 30
      ELSE 100
    END,
    now()
  )
  RETURNING id INTO v_click_id;

  -- Update aggregate click totals only for real unique clicks
  IF v_is_unique AND NOT v_is_filtered THEN
    UPDATE public.links
    SET click_count = COALESCE(click_count, 0) + 1
    WHERE id = l.id;
  END IF;

  -- Update user last_active_at
  UPDATE public.users
  SET last_active_at = now()
  WHERE id = l.user_id;

  destination_url := l.destination_url;
  requires_password := FALSE;
  click_event_id := v_click_id;
  RETURN NEXT;
END;
$$;

-- Enable realtime for updated tables (ignore if already added)
DO $$
BEGIN
  PERFORM pg_catalog.pg_get_publication_tables('supabase_realtime');
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$;
