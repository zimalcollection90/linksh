-- Performance-optimized RPCs for the Dashboard
-- This migration moves heavy aggregation from JS to SQL

-- 1. Unified Admin Dashboard Stats
CREATE OR REPLACE FUNCTION public.get_admin_dashboard_stats()
RETURNS TABLE (
  total_links bigint,
  total_clicks bigint,
  active_members bigint,
  real_clicks bigint,
  unique_users bigint,
  filtered_clicks bigint,
  bot_excluded bigint,
  total_earnings numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM public.links)::bigint,
    (SELECT COALESCE(SUM(click_count), 0) FROM public.links)::bigint,
    (SELECT COUNT(*) FROM public.users WHERE status = 'active')::bigint,
    (SELECT COUNT(*) FROM public.click_events WHERE is_bot = false AND is_filtered = false)::bigint,
    (SELECT COUNT(*) FROM public.click_events WHERE is_unique = true)::bigint,
    (SELECT COUNT(*) FROM public.click_events WHERE is_filtered = true AND is_bot = false)::bigint,
    (SELECT COUNT(*) FROM public.click_events WHERE is_bot = true)::bigint,
    (SELECT COALESCE(SUM(amount), 0) FROM public.earnings)::numeric;
END;
$$;

-- 2. Optimized Geography Stats
CREATE OR REPLACE FUNCTION public.get_geography_stats(
  p_user_id uuid DEFAULT NULL,
  p_limit int DEFAULT 15
)
RETURNS TABLE (
  country text,
  country_code text,
  click_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ce.country,
    ce.country_code,
    COUNT(*)::bigint as click_count
  FROM public.click_events ce
  WHERE (p_user_id IS NULL OR ce.user_id = p_user_id)
    AND ce.is_bot = false
    AND ce.is_filtered = false
    AND ce.country IS NOT NULL
    AND ce.country <> 'Unknown'
  GROUP BY ce.country, ce.country_code
  ORDER BY click_count DESC
  LIMIT p_limit;
END;
$$;

-- 3. Optimized Trend Stats (Clicks + Earnings)
CREATE OR REPLACE FUNCTION public.get_trend_stats(
  p_user_id uuid DEFAULT NULL,
  p_days int DEFAULT 14
)
RETURNS TABLE (
  date_label date,
  click_count bigint,
  earning_amount numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_start_date date := (CURRENT_DATE - (p_days - 1) * INTERVAL '1 day')::date;
BEGIN
  RETURN QUERY
  WITH RECURSIVE date_series AS (
    SELECT v_start_date as d
    UNION ALL
    SELECT (d + INTERVAL '1 day')::date FROM date_series WHERE d < CURRENT_DATE
  ),
  clicks AS (
    SELECT DATE(clicked_at) as d, COUNT(*) as c
    FROM public.click_events
    WHERE (p_user_id IS NULL OR user_id = p_user_id)
      AND is_bot = false
      AND is_filtered = false
      AND clicked_at >= v_start_date::timestamp
    GROUP BY DATE(clicked_at)
  ),
  earnings AS (
    SELECT DATE(created_at) as d, SUM(amount) as a
    FROM public.earnings
    WHERE (p_user_id IS NULL OR user_id = p_user_id)
      AND created_at >= v_start_date::timestamp
    GROUP BY DATE(created_at)
  )
  SELECT
    ds.d,
    COALESCE(c.c, 0)::bigint,
    COALESCE(e.a, 0)::numeric
  FROM date_series ds
  LEFT JOIN clicks c ON c.d = ds.d
  LEFT JOIN earnings e ON e.d = ds.d
  ORDER BY ds.d ASC;
END;
$$;

-- 4. Optimized Member Stats for Admin Dashboard
CREATE OR REPLACE FUNCTION public.get_members_with_stats_v2(p_limit int DEFAULT 8)
RETURNS TABLE (
  id uuid,
  full_name text,
  display_name text,
  email text,
  avatar_url text,
  status text,
  role text,
  total_clicks bigint,
  link_count bigint,
  real_clicks bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH member_links AS (
    SELECT
      l.user_id,
      COUNT(*) as l_count,
      COALESCE(SUM(l.click_count), 0) as l_clicks
    FROM public.links l
    GROUP BY l.user_id
  ),
  member_real_clicks AS (
    SELECT
      ce.user_id,
      COUNT(*) as rc_count
    FROM public.click_events ce
    WHERE ce.is_bot = false AND ce.is_filtered = false
    GROUP BY ce.user_id
  )
  SELECT
    u.id,
    u.full_name,
    u.display_name,
    u.email,
    u.avatar_url,
    u.status,
    u.role,
    COALESCE(ml.l_clicks, 0)::bigint,
    COALESCE(ml.l_count, 0)::bigint,
    COALESCE(mrc.rc_count, 0)::bigint
  FROM public.users u
  LEFT JOIN member_links ml ON ml.user_id = u.id
  LEFT JOIN member_real_clicks mrc ON mrc.user_id = u.id
  ORDER BY u.created_at DESC
  LIMIT p_limit;
END;
$$;

-- 5. Add supporting indexes to ensure these RPCs are blazing fast
CREATE INDEX IF NOT EXISTS idx_click_events_performance_agg 
ON public.click_events(is_bot, is_filtered, clicked_at);

CREATE INDEX IF NOT EXISTS idx_click_events_user_date_perf
ON public.click_events(user_id, clicked_at) 
WHERE is_bot = false AND is_filtered = false;

CREATE INDEX IF NOT EXISTS idx_earnings_user_date_perf
ON public.earnings(user_id, created_at);
