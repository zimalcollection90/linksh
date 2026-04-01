-- Fix GeoIP defaults: store NULL instead of 'Unknown' for missing geo data
-- This makes filtering out unknown locations much cleaner

DO $$ BEGIN
  ALTER TABLE public.click_events ALTER COLUMN country SET DEFAULT NULL;
  ALTER TABLE public.click_events ALTER COLUMN country_code SET DEFAULT NULL;
  ALTER TABLE public.click_events ALTER COLUMN city SET DEFAULT NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Update existing 'Unknown' values to NULL so analytics are clean
UPDATE public.click_events
SET
  country = NULL,
  country_code = NULL,
  city = NULL
WHERE country = 'Unknown' OR country_code = 'Unknown' OR city = 'Unknown';

-- Update the resolve_link_and_log_click to store NULL instead of 'Unknown'
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

  v_is_self_click := FALSE;
  IF p_ip IS NOT NULL THEN
    v_is_self_click := EXISTS (
      SELECT 1 FROM public.ip_exclusions x
      WHERE x.user_id = l.user_id AND x.ip_address = p_ip
    );
  END IF;

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

  -- Store NULL instead of 'Unknown' for missing geo data
  v_country := CASE WHEN p_country IS NULL OR p_country = 'Unknown' OR trim(p_country) = '' THEN NULL ELSE p_country END;
  v_country_code := CASE WHEN p_country_code IS NULL OR p_country_code = 'Unknown' OR trim(p_country_code) = '' THEN NULL ELSE upper(p_country_code) END;
  v_city := CASE WHEN p_city IS NULL OR p_city = 'Unknown' OR trim(p_city) = '' THEN NULL ELSE p_city END;

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
    v_country,
    v_country_code,
    v_city,
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

  IF v_is_unique AND NOT v_is_filtered THEN
    UPDATE public.links SET click_count = COALESCE(click_count, 0) + 1 WHERE id = l.id;
  END IF;

  UPDATE public.users SET last_active_at = now() WHERE id = l.user_id;

  destination_url := l.destination_url;
  requires_password := FALSE;
  click_event_id := v_click_id;
  RETURN NEXT;
END;
$$;

-- Function to get top countries for a user (real clicks only)
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
    AND NOT COALESCE(is_bot, false)
    AND NOT COALESCE(is_filtered, false)
    AND COALESCE(is_unique, false)
  GROUP BY country, country_code
  ORDER BY click_count DESC
  LIMIT p_limit;
$$;

-- Function to get top countries for a company (admin view)
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
  AND NOT COALESCE(ce.is_bot, false)
  AND NOT COALESCE(ce.is_filtered, false)
  AND COALESCE(ce.is_unique, false)
  GROUP BY ce.country, ce.country_code
  ORDER BY click_count DESC
  LIMIT p_limit;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.resolve_link_and_log_click(text, text, text, text, text, text, text, text, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_top_countries(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_company_top_countries(uuid, integer) TO authenticated;
