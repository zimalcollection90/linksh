-- =============================================================================
-- EXCLUDE FACEBOOK SCRAPERS FROM REAL CLICKS
-- Treat Facebook Crawlers as bots and mark them as filtered traffic
-- =============================================================================

-- 1. Update resolve_link_and_log_click to exclude Facebook User-Agents from real clicks
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
  v_is_filtered boolean;
  v_filter_reason text;
  v_is_facebook_scraper boolean;
BEGIN
  -- 1. Find the link
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

  -- 2. Check password protection
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

  -- 3. Bot detection (FACEBOOK IS NOW MARKED AS BOT PER USER REQUEST)
  v_is_bot := FALSE;
  v_is_facebook_scraper := FALSE;
  IF p_user_agent IS NOT NULL THEN
    v_is_bot := (p_user_agent ~* '(bot|crawler|spider|crawl|scraper|pingdom|headless|bytespider|petalbot|semrush|ahrefs|mj12bot|dotbot|yandex|baiduspider|googlebot|bingbot|slurp|duckduckbot|teoma|exabot|ia_archiver|python-requests|curl|wget|libwww|java|go-http|okhttp|axios|scrapy|phantomjs|selenium|puppeteer|playwright)');
    
    -- Identify Facebook scraper as a bot
    v_is_facebook_scraper := (p_user_agent ~* '(facebookexternalhit|facebot|facebook)');
    IF v_is_facebook_scraper THEN
      v_is_bot := TRUE;
    END IF;
  END IF;

  -- 4. Self-click: check IP exclusions for the link owner
  v_is_self_click := FALSE;
  IF p_ip IS NOT NULL THEN
    v_is_self_click := EXISTS (
      SELECT 1 FROM public.ip_exclusions x
      WHERE x.user_id = l.user_id AND x.ip_address = p_ip
    );
  END IF;

  -- 5. Unique click per IP per 24h (per link)
  v_ip_24h_clicked := FALSE;
  IF p_ip IS NOT NULL AND NOT v_is_self_click AND NOT v_is_bot THEN
    v_ip_24h_clicked := EXISTS (
      SELECT 1 FROM public.click_events ce
      WHERE ce.link_id = l.id
        AND ce.ip_address = p_ip
        AND ce.clicked_at >= (now() - interval '24 hours')
        AND ce.is_unique = true
    );
  END IF;

  v_is_unique := (p_ip IS NOT NULL AND NOT v_is_bot AND NOT v_is_self_click AND NOT v_ip_24h_clicked);

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

  -- 6. Insert click record
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
    p_country,
    p_country_code,
    p_city,
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

  -- 7. Only count real unique clicks in aggregate
  IF v_is_unique AND NOT v_is_filtered THEN
    UPDATE public.links SET click_count = COALESCE(click_count, 0) + 1 WHERE id = l.id;
  END IF;

  -- 8. Update user's last dynamic interaction timestamp
  UPDATE public.users SET last_active_at = now() WHERE id = l.user_id;

  destination_url := l.destination_url;
  requires_password := FALSE;
  click_event_id := v_click_id;
  RETURN NEXT;
END;
$$;


-- 2. Update Admin Stats RPC to include Facebook Scraper count
DROP FUNCTION IF EXISTS public.get_admin_dashboard_stats();
CREATE OR REPLACE FUNCTION public.get_admin_dashboard_stats()
RETURNS TABLE (
  total_links bigint,
  total_clicks bigint,
  active_members bigint,
  real_clicks bigint,
  unique_users bigint,
  filtered_clicks bigint,
  bot_excluded bigint,
  facebook_scrapers bigint,
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
    (SELECT COUNT(*) FROM public.click_events WHERE is_bot = true AND browser <> 'Facebook Scraper')::bigint,
    (SELECT COUNT(*) FROM public.click_events WHERE browser = 'Facebook Scraper')::bigint,
    (SELECT COALESCE(SUM(amount), 0) FROM public.earnings)::numeric;
END;
$$;


-- 3. Update User Click Stats RPC
DROP FUNCTION IF EXISTS public.get_user_click_stats(uuid);
CREATE OR REPLACE FUNCTION public.get_user_click_stats(p_user_id uuid)
RETURNS TABLE (
  total_clicks bigint,
  real_clicks bigint,
  unique_users bigint,
  filtered_clicks bigint,
  bot_excluded bigint,
  facebook_scrapers bigint
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    COUNT(*)::bigint AS total_clicks,
    COUNT(*) FILTER (WHERE NOT COALESCE(is_bot, false) AND COALESCE(is_unique, false) AND NOT COALESCE(is_filtered, false))::bigint AS real_clicks,
    COUNT(DISTINCT ip_address) FILTER (WHERE NOT COALESCE(is_bot, false) AND COALESCE(is_unique, false) AND NOT COALESCE(is_filtered, false))::bigint AS unique_users,
    COUNT(*) FILTER (WHERE COALESCE(is_filtered, false) AND NOT COALESCE(is_bot, false))::bigint AS filtered_clicks,
    COUNT(*) FILTER (WHERE COALESCE(is_bot, false) AND browser <> 'Facebook Scraper')::bigint AS bot_excluded,
    COUNT(*) FILTER (WHERE browser = 'Facebook Scraper')::bigint AS facebook_scrapers
  FROM public.click_events
  WHERE user_id = p_user_id;
$$;


-- 4. BACKFILL: Update existing Facebook clicks to be marked as bots
-- This will clean up the dashboard immediately!
UPDATE public.click_events
SET
  is_bot = true,
  is_filtered = true,
  filter_reason = 'bot',
  is_unique = false,
  quality_score = 0
WHERE browser = 'Facebook Scraper' OR (user_agent ~* '(facebookexternalhit|facebot|facebook)');

-- 5. RECALCULATE link click_counts based on the new "Real Click" logic
UPDATE public.links l
SET click_count = (
  SELECT COUNT(*)
  FROM public.click_events ce
  WHERE ce.link_id = l.id
    AND ce.is_bot = false
    AND ce.is_unique = true
    AND ce.is_filtered = false
);
