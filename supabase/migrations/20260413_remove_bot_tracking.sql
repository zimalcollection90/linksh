-- Migration: 20260413_remove_bot_tracking.sql
-- Goal: Completely remove bot tracking, fake data, and unused complexity from DB

-- 1. Updates to resolve_link_and_log_click to SKIP bot insertion entirely
CREATE OR REPLACE FUNCTION public.resolve_link_and_log_click(
  p_code text,
  p_ip text,
  p_user_agent text,
  p_referrer text,
  p_device_type text,
  p_browser text,
  p_os text,
  p_password text DEFAULT NULL,
  p_country text DEFAULT NULL,
  p_country_code text DEFAULT NULL,
  p_city text DEFAULT NULL
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
  v_country text;
  v_country_code text;
  v_city text;
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

  v_is_bot := FALSE;
  IF p_user_agent IS NOT NULL THEN
    v_is_bot := (p_user_agent ~* '(bot|crawler|spider|crawl|scraper|facebookexternalhit|pingdom|headless|bytespider|petalbot|semrush|ahrefs|mj12bot|dotbot|yandex|baiduspider|googlebot|bingbot|slurp|duckduckbot|teoma|exabot|facebot|ia_archiver|python-requests|curl|wget|libwww|java|go-http|okhttp|axios|scrapy|phantomjs|selenium|puppeteer|playwright)');
  END IF;

  -- If it's a bot, skip logging completely and return URL
  IF v_is_bot THEN
    destination_url := l.destination_url;
    requires_password := FALSE;
    click_event_id := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  v_is_self_click := FALSE;
  IF p_ip IS NOT NULL THEN
    v_is_self_click := EXISTS (
      SELECT 1 FROM public.ip_exclusions x
      WHERE x.user_id = l.user_id AND x.ip_address = p_ip
    );
  END IF;

  v_ip_24h_clicked := FALSE;
  IF p_ip IS NOT NULL AND NOT v_is_self_click THEN
    v_ip_24h_clicked := EXISTS (
      SELECT 1 FROM public.click_events ce
      WHERE ce.link_id = l.id
        AND ce.ip_address = p_ip
        AND ce.clicked_at >= (now() - interval '24 hours')
        AND ce.is_unique = true
    );
  END IF;

  v_is_unique := (p_ip IS NOT NULL AND NOT v_is_self_click AND NOT v_ip_24h_clicked);

  -- Store NULL instead of 'Unknown' for missing geo data
  v_country := CASE WHEN p_country IS NULL OR p_country = 'Unknown' OR trim(p_country) = '' THEN NULL ELSE p_country END;
  v_country_code := CASE WHEN p_country_code IS NULL OR p_country_code = 'Unknown' OR trim(p_country_code) = '' THEN NULL ELSE upper(p_country_code) END;
  v_city := CASE WHEN p_city IS NULL OR p_city = 'Unknown' OR trim(p_city) = '' THEN NULL ELSE p_city END;

  -- Only insert if it's a valid unique visit. Repeat human visits / self clicks are not stored to reduce bloat
  IF v_is_unique THEN
    INSERT INTO public.click_events (
      link_id,
      user_id,
      ip_address,
      country,
      country_code,
      city,
      device_type,
      browser,
      os,
      referrer,
      user_agent,
      is_unique,
      clicked_at
    )
    VALUES (
      l.id,
      l.user_id,
      p_ip,
      v_country,
      v_country_code,
      v_city,
      p_device_type,
      p_browser,
      p_os,
      p_referrer,
      p_user_agent,
      true, -- always true because we only log uniques now
      now()
    )
    RETURNING id INTO v_click_id;

    UPDATE public.links SET click_count = COALESCE(click_count, 0) + 1 WHERE id = l.id;
    UPDATE public.users SET last_active_at = now() WHERE id = l.user_id;

    click_event_id := v_click_id;
  ELSE
    click_event_id := NULL;
  END IF;

  destination_url := l.destination_url;
  requires_password := FALSE;
  RETURN NEXT;
END;
$$;

-- 2. Clean up old bot/filtered rows (to reclaim space)
DELETE FROM public.click_events WHERE COALESCE(is_bot, false) = true OR COALESCE(is_filtered, false) = true;

-- 3. Redefine Stats RPCs to stop using dropped bot logic
DROP FUNCTION IF EXISTS public.get_dashboard_stats(uuid, integer);
DROP FUNCTION IF EXISTS public.get_geography_stats(uuid, integer, integer);
DROP FUNCTION IF EXISTS public.get_members_with_stats_v3(integer, integer);
DROP FUNCTION IF EXISTS public.get_trend_stats(uuid, integer);
DROP FUNCTION IF EXISTS public.get_user_click_stats(uuid);
DROP FUNCTION IF EXISTS public.get_company_click_stats(uuid);
DROP FUNCTION IF EXISTS public.get_user_daily_clicks(uuid, integer);
DROP FUNCTION IF EXISTS public.get_member_stats_for_company(uuid);
DROP FUNCTION IF EXISTS public.get_user_top_countries(uuid, integer);
DROP FUNCTION IF EXISTS public.get_company_top_countries(uuid, integer);

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
    WHEN p_days IS NOT NULL THEN (CURRENT_DATE - (p_days) * INTERVAL '1 day')::timestamp 
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
    AND ce.country IS NOT NULL
    AND ce.country <> 'Unknown'
    AND ce.clicked_at >= v_start_timestamp
  GROUP BY ce.country, ce.country_code
  ORDER BY click_count DESC
  LIMIT p_limit;
END;
$$;


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
      COUNT(*) as l_count,
      SUM(click_count) as total_c
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
    COUNT(*)::bigint AS real_clicks,
    COUNT(DISTINCT ip_address)::bigint AS unique_users,
    0::bigint AS filtered_clicks,
    0::bigint AS bot_excluded
  FROM public.click_events
  WHERE user_id = p_user_id;
$$;

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
    COUNT(*)::bigint AS real_clicks,
    COUNT(DISTINCT ce.ip_address)::bigint AS unique_users,
    0::bigint AS filtered_clicks,
    0::bigint AS bot_excluded
  FROM public.click_events ce
  WHERE ce.user_id IN (
    SELECT cm.user_id FROM public.company_members cm WHERE cm.company_id = p_company_id
  );
END;
$$;

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
    COUNT(*)::bigint AS real_clicks,
    COUNT(DISTINCT ip_address)::bigint AS unique_users,
    0::bigint AS bots
  FROM public.click_events
  WHERE user_id = p_user_id
    AND clicked_at >= NOW() - (p_days || ' days')::interval
  GROUP BY DATE(clicked_at)
  ORDER BY day;
$$;

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
    COUNT(*)::bigint AS real_clicks,
    COUNT(DISTINCT ce.ip_address)::bigint AS unique_users,
    0::bigint AS bot_excluded,
    0::bigint AS filtered_clicks,
    COUNT(DISTINCT ce.link_id)::bigint AS link_count
  FROM public.click_events ce
  WHERE ce.user_id IN (
    SELECT cm.user_id FROM public.company_members cm WHERE cm.company_id = p_company_id
  )
  GROUP BY ce.user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_top_countries(p_user_id uuid, p_limit integer DEFAULT 10)
RETURNS TABLE (
  country text,
  country_code text,
  click_count bigint
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    COALESCE(country, 'Unknown') AS country,
    COALESCE(country_code, 'XX') AS country_code,
    COUNT(*)::bigint AS click_count
  FROM public.click_events
  WHERE user_id = p_user_id
  GROUP BY country, country_code
  ORDER BY click_count DESC
  LIMIT p_limit;
$$;

CREATE OR REPLACE FUNCTION public.get_company_top_countries(p_company_id uuid, p_limit integer DEFAULT 10)
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
    COALESCE(ce.country, 'Unknown') AS country,
    COALESCE(ce.country_code, 'XX') AS country_code,
    COUNT(*)::bigint AS click_count
  FROM public.click_events ce
  WHERE ce.user_id IN (
    SELECT cm.user_id FROM public.company_members cm WHERE cm.company_id = p_company_id
  )
  GROUP BY ce.country, ce.country_code
  ORDER BY click_count DESC
  LIMIT p_limit;
END;
$$;


-- 4. Drop unnecessary columns
ALTER TABLE public.click_events DROP COLUMN IF EXISTS is_bot;
ALTER TABLE public.click_events DROP COLUMN IF EXISTS is_filtered;
ALTER TABLE public.click_events DROP COLUMN IF EXISTS filter_reason;
ALTER TABLE public.click_events DROP COLUMN IF EXISTS quality_score;

