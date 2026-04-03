-- Migration: 20260411_exclude_bots_global.sql
-- Goal: Exclude bot and scraper traffic from all primary "Total Clicks" metrics globally.

-- 1. Redefine get_dashboard_stats so total_clicks = real_clicks and bots are ignored
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
    -- Total links
    (SELECT COUNT(*) FROM public.links WHERE (p_user_id IS NULL OR user_id = p_user_id))::bigint,
    
    -- Total clicks (Now only shows non-bot clicks)
    (SELECT COUNT(*) FROM public.click_events 
     WHERE (p_user_id IS NULL OR user_id = p_user_id) 
       AND is_bot = false AND is_filtered = false
       AND clicked_at >= v_start_timestamp)::bigint as total_clicks,
       
    -- Active members
    (SELECT COUNT(*) FROM public.users WHERE status = 'active')::bigint,
    
    -- Real clicks (Keeping for backward compatibility with frontend types)
    (SELECT COUNT(*) FROM public.click_events 
     WHERE (p_user_id IS NULL OR user_id = p_user_id) 
       AND is_bot = false AND is_filtered = false
       AND clicked_at >= v_start_timestamp)::bigint as real_clicks,
       
    -- Unique users (Human-only)
    (SELECT COUNT(*) FROM public.click_events 
     WHERE (p_user_id IS NULL OR user_id = p_user_id) 
       AND is_bot = false AND is_filtered = false AND is_unique = true
       AND clicked_at >= v_start_timestamp)::bigint,
       
    -- Zero out bot fields (Don't count them anywhere)
    0::bigint as filtered_clicks,
       
    -- Zero out bot fields (Don't count them anywhere)
    0::bigint as bot_excluded,
       
    -- Total earnings
    (SELECT COALESCE(SUM(amount), 0) FROM public.earnings 
     WHERE (p_user_id IS NULL OR user_id = p_user_id)
       AND created_at >= v_start_timestamp)::numeric,
       
    -- Zero out scraper fields (Don't count them anywhere)
    0::bigint as facebook_scrapers;
END;
$$;

-- 2. Update Member stats to exclude bots from totals
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
      -- total_clicks now only includes non-bot clicks
      COUNT(*) FILTER (WHERE ce.is_bot = false AND ce.is_filtered = false) as c_total,
      COUNT(*) FILTER (WHERE ce.is_bot = false AND ce.is_filtered = false) as c_real
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
