-- Extend resolve_link_and_log_click to return the inserted click_event_id
-- so we can enrich geo fields asynchronously without extra lookups.

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

    -- Verify bcrypt hash stored in password_hash column
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

  -- Insert a click event row for analytics/audit
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
    CASE WHEN is_bot THEN 0 ELSE 100 END,
    now()
  )
  RETURNING id INTO v_click_id;

  -- Update aggregate click totals only for counted unique clicks
  IF is_unique THEN
    UPDATE public.links
    SET click_count = COALESCE(click_count, 0) + 1
    WHERE id = l.id;
  END IF;

  destination_url := l.destination_url;
  requires_password := FALSE;
  click_event_id := v_click_id;
  RETURN NEXT;
END;
$$;

