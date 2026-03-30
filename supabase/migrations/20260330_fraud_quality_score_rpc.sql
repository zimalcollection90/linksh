-- Click Quality Score + fraud flags
-- Computes per-link fraud metrics over the last 24h and updates:
-- - click_events.quality_score (per click)
-- - links.fraud_score / links.is_fraud_flagged

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
  is_bot boolean;
  is_self_click boolean;
  is_unique boolean;
  ip_24h_clicked boolean;

  v_click_id uuid;

  total_24h bigint := 0;
  bot_24h bigint := 0;
  unique_ip_24h bigint := 0;
  unique_device_24h bigint := 0;
  unique_country_24h bigint := 0;
  non_bot_24h bigint := 0;

  ip_ratio numeric := 0;
  device_ratio numeric := 0;
  geo_ratio numeric := 0.5; -- fallback when country enrichment hasn't populated yet
  bot_ratio numeric := 0;

  quality_score numeric := 0;
  fraud_flagged boolean := false;
BEGIN
  -- Resolve link (active + not expired)
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
  END IF;

  -- Password gate (do not log when password isn't provided/valid)
  IF l.is_password_protected = true THEN
    IF p_password IS NULL OR btrim(p_password) = '' THEN
      destination_url := NULL;
      requires_password := TRUE;
      click_event_id := NULL;
      RETURN NEXT;
    END IF;

    IF l.password_hash IS NULL OR crypt(p_password, l.password_hash) <> l.password_hash THEN
      destination_url := NULL;
      requires_password := FALSE;
      click_event_id := NULL;
      RETURN NEXT;
    END IF;
  END IF;

  -- Bot detection (basic; later can be upgraded to a full isbot model)
  is_bot := FALSE;
  IF p_user_agent IS NULL THEN
    is_bot := FALSE;
  ELSE
    is_bot := (p_user_agent ~* '(bot|crawler|spider|crawl|scraper|facebookexternalhit|pingdom|headless)');
  END IF;

  -- Self-click prevention via stored IP exclusions for the link owner
  is_self_click := FALSE;
  IF p_ip IS NOT NULL THEN
    is_self_click := EXISTS (
      SELECT 1
      FROM public.ip_exclusions x
      WHERE x.user_id = l.user_id
        AND x.ip_address = p_ip
    );
  END IF;

  -- Unique click per IP per 24h (per link)
  ip_24h_clicked := FALSE;
  IF p_ip IS NOT NULL AND NOT is_self_click THEN
    ip_24h_clicked := EXISTS (
      SELECT 1
      FROM public.click_events ce
      WHERE ce.link_id = l.id
        AND ce.ip_address = p_ip
        AND ce.clicked_at >= (now() - interval '24 hours')
    );
  END IF;

  is_unique := (p_ip IS NOT NULL AND NOT is_bot AND NOT is_self_click AND NOT ip_24h_clicked);

  -- Insert click event row (geo can be enriched asynchronously later)
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
    is_unique,
    is_bot,
    0,
    now()
  )
  RETURNING id INTO v_click_id;

  -- Update aggregate click totals only for counted unique clicks
  IF is_unique THEN
    UPDATE public.links
    SET click_count = COALESCE(click_count, 0) + 1
    WHERE id = l.id;
  END IF;

  -- Compute quality score over the last 24h (includes this inserted click)
  SELECT
    COUNT(*) AS total_clicks,
    SUM(CASE WHEN is_bot THEN 1 ELSE 0 END) AS bot_clicks,
    COUNT(DISTINCT ip_address) AS unique_ips,
    COUNT(DISTINCT device_type) AS unique_devices,
    COUNT(DISTINCT country_code) FILTER (WHERE country_code IS NOT NULL) AS unique_countries
  INTO
    total_24h,
    bot_24h,
    unique_ip_24h,
    unique_device_24h,
    unique_country_24h
  FROM public.click_events
  WHERE link_id = l.id
    AND clicked_at >= (now() - interval '24 hours');

  non_bot_24h := GREATEST(total_24h - bot_24h, 0);

  -- Ratios are clamped to [0..1]
  IF non_bot_24h > 0 THEN
    ip_ratio := LEAST(1, unique_ip_24h::numeric / non_bot_24h::numeric);
    device_ratio := LEAST(1, unique_device_24h::numeric / non_bot_24h::numeric);

    IF unique_country_24h > 0 THEN
      geo_ratio := LEAST(1, unique_country_24h::numeric / non_bot_24h::numeric);
    ELSE
      -- Geo enrichment is asynchronous, so don't punish too early.
      geo_ratio := 0.5;
    END IF;
  ELSE
    ip_ratio := 0;
    device_ratio := 0;
    geo_ratio := 0.5;
  END IF;

  IF total_24h > 0 THEN
    bot_ratio := bot_24h::numeric / total_24h::numeric;
  ELSE
    bot_ratio := 0;
  END IF;

  quality_score := ROUND(100 * (0.45 * ip_ratio + 0.25 * device_ratio + 0.2 * geo_ratio + 0.1 * (1 - bot_ratio)));
  fraud_flagged := (quality_score < 50 OR bot_ratio > 0.5);

  -- Persist computed scores
  IF is_bot THEN
    UPDATE public.click_events SET quality_score = 0 WHERE id = v_click_id;
  ELSE
    UPDATE public.click_events SET quality_score = quality_score WHERE id = v_click_id;
  END IF;

  UPDATE public.links
  SET
    fraud_score = quality_score,
    is_fraud_flagged = fraud_flagged
  WHERE id = l.id;

  destination_url := l.destination_url;
  requires_password := FALSE;
  click_event_id := v_click_id;
  RETURN NEXT;
END;
$$;

