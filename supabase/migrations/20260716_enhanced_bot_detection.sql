-- Migration: 20260716_enhanced_bot_detection.sql
-- Goal: Add browser fingerprint column for accurate Unique User deduplication
--       and upgrade the SQL-level bot filter to match the edge-level patterns.

-- ─── 1. Add fingerprint column to click_events ───────────────────────────────
ALTER TABLE public.click_events ADD COLUMN IF NOT EXISTS fingerprint text;

-- Index for efficient fingerprint-based deduplication lookups
CREATE INDEX IF NOT EXISTS idx_click_events_fingerprint
  ON public.click_events (link_id, fingerprint, clicked_at)
  WHERE fingerprint IS NOT NULL;

-- ─── 2. Replace resolve_link_and_log_click with enhanced version ─────────────
-- Changes vs previous version:
--   a) Accepts new optional p_fingerprint parameter
--   b) Greatly expanded bot UA regex (mirrors edge-level BOT_UA_PATTERN)
--   c) Deduplicates by fingerprint when provided; falls back to IP-only
--   d) Stores fingerprint in the inserted row
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
  p_city text DEFAULT NULL,
  p_fingerprint text DEFAULT NULL
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
  v_is_repeat boolean;
  v_click_id uuid;
  v_country text;
  v_country_code text;
  v_city text;
BEGIN
  -- Resolve the link
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

  -- Password protection check
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

  -- ── Bot detection ──────────────────────────────────────────────────────────
  -- When called by the edge bot pre-filter (p_ip = NULL, p_user_agent = NULL),
  -- we skip the analytics insert entirely and just return the destination URL.
  -- Otherwise, run the comprehensive bot UA regex.
  v_is_bot := FALSE;
  IF p_user_agent IS NULL AND p_ip IS NULL THEN
    -- Explicit "bot bypass" call from edge pre-filter: skip all logging
    destination_url := l.destination_url;
    requires_password := FALSE;
    click_event_id := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  IF p_user_agent IS NOT NULL THEN
    v_is_bot := (p_user_agent ~*
      '(bot|crawler|spider|crawl|scraper|preview|prerender|preload|prefetch|meta-externalagent|' ||
      'facebookexternalhit|facebot|whatsapp|telegrambot|discordbot|linkedinbot|slackbot|slackhq|' ||
      'twitterbot|pinterest|applebot|googlebot|google-read-aloud|googleimageproxy|feedburner|feedfetcher|' ||
      'bingbot|msnbot|slurp|duckduckbot|baiduspider|yandex|yandexbot|petalbot|bytespider|ahrefsbot|' ||
      'semrushbot|mj12bot|dotbot|blexbot|rogerbot|exabot|archive\.org_bot|ia_archiver|' ||
      'uptimerobot|statuscake|pingdom|gtmetrix|datadog|headlesschrome|headless|phantomjs|puppeteer|' ||
      'playwright|selenium|webdriver|python-requests|python/|curl/|wget/|libwww|java/|' ||
      'go-http-client|okhttp|axios|node-fetch|got/|scrapy|httpx|requests|urllib|mechanize|' ||
      'ruby|perl|php/|cfnetwork|nativehost|dataprovider|mail\.ru|barkrowler|proximic|scoutjet|' ||
      'seznambot|seokicks|sistrix|similarweb|deepcrawl|netcraft|nikto|masscan|zgrab|nuclei|dirbuster|sqlmap|nmap)'
    );
  END IF;

  -- If it's a bot: redirect without any analytics write
  IF v_is_bot THEN
    destination_url := l.destination_url;
    requires_password := FALSE;
    click_event_id := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  -- ── Self-click exclusion ───────────────────────────────────────────────────
  v_is_self_click := FALSE;
  IF p_ip IS NOT NULL THEN
    v_is_self_click := EXISTS (
      SELECT 1 FROM public.ip_exclusions x
      WHERE x.user_id = l.user_id AND x.ip_address = p_ip
    );
  END IF;

  -- ── Duplicate detection (24-hour window per link) ─────────────────────────
  -- Prefer fingerprint-based check when available; fallback to IP-only.
  v_is_repeat := FALSE;
  IF NOT v_is_self_click THEN
    IF p_fingerprint IS NOT NULL THEN
      -- Fingerprint dedup: same browser/device signature within 24h
      v_is_repeat := EXISTS (
        SELECT 1 FROM public.click_events ce
        WHERE ce.link_id = l.id
          AND ce.fingerprint = p_fingerprint
          AND ce.clicked_at >= (now() - interval '24 hours')
          AND ce.is_unique = true
      );
    ELSIF p_ip IS NOT NULL THEN
      -- IP-only fallback dedup
      v_is_repeat := EXISTS (
        SELECT 1 FROM public.click_events ce
        WHERE ce.link_id = l.id
          AND ce.ip_address = p_ip
          AND ce.clicked_at >= (now() - interval '24 hours')
          AND ce.is_unique = true
      );
    END IF;
  END IF;

  v_is_unique := (NOT v_is_self_click AND NOT v_is_repeat);

  -- Normalise geo data (store NULL not 'Unknown')
  v_country      := CASE WHEN p_country IS NULL OR p_country = 'Unknown' OR trim(p_country) = '' THEN NULL ELSE p_country END;
  v_country_code := CASE WHEN p_country_code IS NULL OR p_country_code = 'Unknown' OR trim(p_country_code) = '' THEN NULL ELSE upper(p_country_code) END;
  v_city         := CASE WHEN p_city IS NULL OR p_city = 'Unknown' OR trim(p_city) = '' THEN NULL ELSE p_city END;

  -- Only insert unique, real, human visits
  IF v_is_unique THEN
    INSERT INTO public.click_events (
      link_id,
      user_id,
      ip_address,
      fingerprint,
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
      p_fingerprint,
      v_country,
      v_country_code,
      v_city,
      p_device_type,
      p_browser,
      p_os,
      p_referrer,
      p_user_agent,
      true,
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

-- Re-grant execute permissions (required after CREATE OR REPLACE changes signature)
GRANT EXECUTE ON FUNCTION public.resolve_link_and_log_click(
  text, text, text, text, text, text, text, text, text, text, text, text
) TO anon, authenticated;
