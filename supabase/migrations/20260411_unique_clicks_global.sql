-- Migration: 20260411_unique_clicks_global.sql
-- Goal: Exclusively show UNIQUE human clicks across the entire platform.

-- 1. Redefine get_dashboard_stats for unique-only
CREATE OR REPLACE FUNCTION public.get_dashboard_stats(
  p_user_id uuid DEFAULT NULL,
  p_days int DEFAULT NULL
)
RETURNS TABLE (
  total_links bigint,
  total_clicks bigint,
  active_members bigint,
  real_clicks bigint,
  unique_users bigint,
  filtered_clicks bigint,
  bot_excluded bigint,
  total_earnings numeric,
  facebook_scrapers bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_start_timestamp timestamp := CASE 
    WHEN p_days IS NOT NULL THEN (CURRENT_DATE - (p_days) * INTERVAL '1 day')::timestamp 
    ELSE '1970-01-01'::timestamp 
  END;
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM public.links WHERE (p_user_id IS NULL OR user_id = p_user_id))::bigint,
    
    -- total_clicks and real_clicks now only include unique human clicks
    (SELECT COUNT(*) FROM public.click_events 
     WHERE (p_user_id IS NULL OR user_id = p_user_id) 
       AND is_bot = false AND is_filtered = false AND is_unique = true
       AND clicked_at >= v_start_timestamp)::bigint as total_clicks,
       
    (SELECT COUNT(*) FROM public.users WHERE status = 'active')::bigint,
    
    (SELECT COUNT(*) FROM public.click_events 
     WHERE (p_user_id IS NULL OR user_id = p_user_id) 
       AND is_bot = false AND is_filtered = false AND is_unique = true
       AND clicked_at >= v_start_timestamp)::bigint as real_clicks,
       
    (SELECT COUNT(*) FROM public.click_events 
     WHERE (p_user_id IS NULL OR user_id = p_user_id) 
       AND is_bot = false AND is_filtered = false AND is_unique = true
       AND clicked_at >= v_start_timestamp)::bigint as unique_users,
       
    0::bigint as filtered_clicks,
    0::bigint as bot_excluded,
    
    (SELECT COALESCE(SUM(amount), 0) FROM public.earnings 
     WHERE (p_user_id IS NULL OR user_id = p_user_id)
       AND created_at >= v_start_timestamp)::numeric,
       
    0::bigint as facebook_scrapers;
END;
$$;

-- 2. Redefine get_geography_stats for unique-only
CREATE OR REPLACE FUNCTION public.get_geography_stats(
  p_user_id uuid DEFAULT NULL,
  p_limit int DEFAULT 15,
  p_days int DEFAULT NULL
)
RETURNS TABLE (
  country text,
  country_code text,
  click_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_start_timestamp timestamp := CASE 
    WHEN p_days IS NOT NULL THEN (CURRENT_DATE - (p_days) * INTERVAL '1 day')::timestamp 
    ELSE '1970-01-01'::timestamp 
  END;
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
    AND ce.is_unique = true
    AND ce.country IS NOT NULL
    AND ce.country <> 'Unknown'
    AND ce.clicked_at >= v_start_timestamp
  GROUP BY ce.country, ce.country_code
  ORDER BY click_count DESC
  LIMIT p_limit;
END;
$$;

-- 3. Redefine get_members_with_stats_v3 for unique-only
CREATE OR REPLACE FUNCTION public.get_members_with_stats_v3(
  p_limit int DEFAULT 8,
  p_days int DEFAULT NULL
)
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
DECLARE
  v_start_timestamp timestamp := CASE 
    WHEN p_days IS NOT NULL THEN (CURRENT_DATE - (p_days) * INTERVAL '1 day')::timestamp 
    ELSE '1970-01-01'::timestamp 
  END;
BEGIN
  RETURN QUERY
  WITH member_links AS (
    SELECT
      l.user_id,
      COUNT(*) as l_count
    FROM public.links l
    GROUP BY l.user_id
  ),
  member_clicks AS (
    SELECT
      ce.user_id,
      COUNT(*) FILTER (WHERE ce.is_bot = false AND ce.is_filtered = false AND ce.is_unique = true) as c_total,
      COUNT(*) FILTER (WHERE ce.is_bot = false AND ce.is_filtered = false AND ce.is_unique = true) as c_real
    FROM public.click_events ce
    WHERE ce.clicked_at >= v_start_timestamp
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
    COALESCE(mc.c_total, 0)::bigint,
    COALESCE(ml.l_count, 0)::bigint,
    COALESCE(mc.c_real, 0)::bigint
  FROM public.users u
  LEFT JOIN member_links ml ON ml.user_id = u.id
  LEFT JOIN member_clicks mc ON mc.user_id = u.id
  ORDER BY mc.c_real DESC NULLS LAST, u.created_at DESC
  LIMIT p_limit;
END;
$$;

-- 4. Update Trend Stats for unique-only
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
      AND is_unique = true
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
