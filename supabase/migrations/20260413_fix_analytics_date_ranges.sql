-- Migration: 20260413_fix_analytics_date_ranges.sql
-- Goal: Fix v_start_timestamp calculation AND ensure compatibility with "Remove Bot Tracking" (columns dropped).

-- Drop existing functions first because return types have changed after bot cleanup
DROP FUNCTION IF EXISTS public.get_dashboard_stats(uuid, int);
DROP FUNCTION IF EXISTS public.get_geography_stats(uuid, int, int);
DROP FUNCTION IF EXISTS public.get_members_with_stats_v3(int, int);

-- 1. Fix get_dashboard_stats (Remove is_bot/is_filtered, fix p_days logic)
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
  total_earnings numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_start_timestamp timestamp := CASE 
    WHEN p_days IS NOT NULL THEN (CURRENT_DATE - (p_days - 1) * INTERVAL '1 day')::timestamp 
    ELSE '1970-01-01'::timestamp 
  END;
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM public.links WHERE (p_user_id IS NULL OR user_id = p_user_id))::bigint,
    
    (SELECT COALESCE(SUM(click_count), 0) FROM public.links WHERE (p_user_id IS NULL OR user_id = p_user_id))::bigint as total_clicks,
       
    (SELECT COUNT(*) FROM public.users WHERE status = 'active')::bigint,
    
    (SELECT COUNT(*) FROM public.click_events 
     WHERE (p_user_id IS NULL OR user_id = p_user_id) 
       AND clicked_at >= v_start_timestamp)::bigint as real_clicks,
       
    (SELECT COUNT(DISTINCT ip_address) FROM public.click_events 
     WHERE (p_user_id IS NULL OR user_id = p_user_id) 
       AND clicked_at >= v_start_timestamp)::bigint as unique_users,
       
    (SELECT COALESCE(SUM(amount), 0) FROM public.earnings 
     WHERE (p_user_id IS NULL OR user_id = p_user_id)
       AND created_at >= v_start_timestamp)::numeric;
END;
$$;

-- 2. Fix get_geography_stats (Remove is_bot/is_filtered, fix p_days logic)
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
    WHEN p_days IS NOT NULL THEN (CURRENT_DATE - (p_days - 1) * INTERVAL '1 day')::timestamp 
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
    AND ce.country IS NOT NULL
    AND ce.country <> 'Unknown'
    AND ce.clicked_at >= v_start_timestamp
  GROUP BY ce.country, ce.country_code
  ORDER BY click_count DESC
  LIMIT p_limit;
END;
$$;

-- 3. Fix get_members_with_stats_v3 (Ensure compatibility with unique-only data)
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
    WHEN p_days IS NOT NULL THEN (CURRENT_DATE - (p_days - 1) * INTERVAL '1 day')::timestamp 
    ELSE '1970-01-01'::timestamp 
  END;
BEGIN
  RETURN QUERY
  WITH member_links AS (
    SELECT
      l.user_id,
      COUNT(*) as l_count,
      COALESCE(SUM(click_count), 0) as total_c
    FROM public.links l
    GROUP BY l.user_id
  ),
  member_clicks AS (
    SELECT
      ce.user_id,
      COUNT(*) as c_real
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
    COALESCE(ml.total_c, 0)::bigint as total_clicks,
    COALESCE(ml.l_count, 0)::bigint as link_count,
    COALESCE(mc.c_real, 0)::bigint as real_clicks
  FROM public.users u
  LEFT JOIN member_links ml ON ml.user_id = u.id
  LEFT JOIN member_clicks mc ON mc.user_id = u.id
  ORDER BY mc.c_real DESC NULLS LAST, u.created_at DESC
  LIMIT p_limit;
END;
$$;
