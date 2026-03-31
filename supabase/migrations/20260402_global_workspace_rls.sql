-- =============================================================================
-- GLOBAL WORKSPACE MIGRATION
-- Remove all company-based multi-tenant architecture.
-- Replace with a simple global model: users have role + status, that's it.
-- Admins can see/manage all users. Active users can create links.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. DROP COMPANY-BASED TRIGGERS (no longer needed)
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_links_set_company_id ON public.links;
DROP TRIGGER IF EXISTS trg_click_events_set_company_id ON public.click_events;
DROP TRIGGER IF EXISTS trg_earnings_set_company_id ON public.earnings;
DROP TRIGGER IF EXISTS trg_campaigns_set_company_id ON public.campaigns;
DROP TRIGGER IF EXISTS trg_goals_set_company_id ON public.goals;
DROP TRIGGER IF EXISTS trg_invites_set_company_id ON public.invites;
DROP TRIGGER IF EXISTS trg_api_keys_set_company_id ON public.api_keys;
DROP TRIGGER IF EXISTS trg_ip_exclusions_set_company_id ON public.ip_exclusions;
DROP TRIGGER IF EXISTS trg_sync_company_members_from_users ON public.users;

-- Drop the trigger functions
DROP FUNCTION IF EXISTS public.links_set_company_id() CASCADE;
DROP FUNCTION IF EXISTS public.click_events_set_company_id() CASCADE;
DROP FUNCTION IF EXISTS public.earnings_set_company_id() CASCADE;
DROP FUNCTION IF EXISTS public.campaigns_set_company_id() CASCADE;
DROP FUNCTION IF EXISTS public.goals_set_company_id() CASCADE;
DROP FUNCTION IF EXISTS public.invites_set_company_id() CASCADE;
DROP FUNCTION IF EXISTS public.api_keys_set_company_id() CASCADE;
DROP FUNCTION IF EXISTS public.ip_exclusions_set_company_id() CASCADE;
DROP FUNCTION IF EXISTS public.sync_company_members_from_users() CASCADE;

-- ---------------------------------------------------------------------------
-- 2. SET DEFAULT STATUS = 'pending' FOR NEW SIGNUPS
-- ---------------------------------------------------------------------------
ALTER TABLE public.users ALTER COLUMN status SET DEFAULT 'pending';

-- ---------------------------------------------------------------------------
-- 3. DROP ALL OLD RLS POLICIES (company-scoped ones)
-- ---------------------------------------------------------------------------

-- Users
DROP POLICY IF EXISTS "users select company admins" ON public.users;
DROP POLICY IF EXISTS "users insert self" ON public.users;
DROP POLICY IF EXISTS "users update self or admin" ON public.users;

-- Links
DROP POLICY IF EXISTS "links public select active" ON public.links;
DROP POLICY IF EXISTS "links select company" ON public.links;
DROP POLICY IF EXISTS "links insert member" ON public.links;
DROP POLICY IF EXISTS "links update member/admin" ON public.links;
DROP POLICY IF EXISTS "links anon mark expired" ON public.links;
DROP POLICY IF EXISTS "links delete member/admin" ON public.links;

-- Click events
DROP POLICY IF EXISTS "click_events insert for active links" ON public.click_events;
DROP POLICY IF EXISTS "click_events insert for active links auth" ON public.click_events;
DROP POLICY IF EXISTS "click_events select company" ON public.click_events;

-- Earnings
DROP POLICY IF EXISTS "earnings select company" ON public.earnings;
DROP POLICY IF EXISTS "earnings modify owner_or_admin" ON public.earnings;

-- Campaigns
DROP POLICY IF EXISTS "campaigns select company" ON public.campaigns;
DROP POLICY IF EXISTS "campaigns insert member" ON public.campaigns;

-- Goals
DROP POLICY IF EXISTS "goals select company" ON public.goals;
DROP POLICY IF EXISTS "goals modify owner_or_admin" ON public.goals;

-- IP exclusions
DROP POLICY IF EXISTS "ip_exclusions select" ON public.ip_exclusions;
DROP POLICY IF EXISTS "ip_exclusions modify" ON public.ip_exclusions;
DROP POLICY IF EXISTS "ip_exclusions delete" ON public.ip_exclusions;

-- API keys
DROP POLICY IF EXISTS "api_keys select" ON public.api_keys;
DROP POLICY IF EXISTS "api_keys insert owner" ON public.api_keys;
DROP POLICY IF EXISTS "api_keys delete owner_or_admin" ON public.api_keys;

-- Invites
DROP POLICY IF EXISTS "invites select admin" ON public.invites;
DROP POLICY IF EXISTS "invites insert admin" ON public.invites;
DROP POLICY IF EXISTS "invites update admin" ON public.invites;
DROP POLICY IF EXISTS "invites delete admin" ON public.invites;

-- Companies (keep tables, just drop company-scoped policies if they exist)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'companies') THEN
    EXECUTE 'DROP POLICY IF EXISTS "companies select members" ON public.companies';
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'company_members') THEN
    EXECUTE 'DROP POLICY IF EXISTS "company_members select company" ON public.company_members';
    EXECUTE 'DROP POLICY IF EXISTS "company_members update admin" ON public.company_members';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4. HELPER: is_admin() — checks if current user is admin/super_admin + active
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_global_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role IN ('admin', 'super_admin')
      AND u.status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_active_user()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.status = 'active'
  );
$$;

-- ---------------------------------------------------------------------------
-- 5. GLOBAL RLS POLICIES
-- ---------------------------------------------------------------------------

-- Enable RLS (safe to re-run)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.click_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ip_exclusions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

-- ---- USERS ----
-- Self read + admin reads all
CREATE POLICY "global: users select"
  ON public.users FOR SELECT TO authenticated
  USING (
    auth.uid() = users.id
    OR public.is_global_admin()
  );

-- Self insert
CREATE POLICY "global: users insert self"
  ON public.users FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = users.id);

-- Self update + admin can update any
CREATE POLICY "global: users update"
  ON public.users FOR UPDATE TO authenticated
  USING (
    auth.uid() = users.id
    OR public.is_global_admin()
  )
  WITH CHECK (
    auth.uid() = users.id
    OR public.is_global_admin()
  );

-- ---- LINKS ----
-- Anonymous: read active non-expired links (for redirect)
CREATE POLICY "global: links select anon"
  ON public.links FOR SELECT TO anon
  USING (
    status = 'active'
    AND (expires_at IS NULL OR expires_at > now())
  );

-- Authenticated: owner sees own, admin sees all
CREATE POLICY "global: links select auth"
  ON public.links FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_global_admin()
  );

-- Only active users can create links (no company check)
CREATE POLICY "global: links insert active user"
  ON public.links FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.is_active_user()
  );

-- Owner or admin can update
CREATE POLICY "global: links update"
  ON public.links FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_global_admin()
  )
  WITH CHECK (
    user_id = auth.uid()
    OR public.is_global_admin()
  );

-- Owner or admin can delete
CREATE POLICY "global: links delete"
  ON public.links FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_global_admin()
  );

-- Allow anon to mark expired links (redirect edge case)
CREATE POLICY "global: links anon mark expired"
  ON public.links FOR UPDATE TO anon
  USING (status = 'active' AND expires_at IS NOT NULL AND expires_at < now())
  WITH CHECK (status = 'expired');

-- ---- CLICK EVENTS ----
-- Anonymous can insert for active links (public redirect tracking)
CREATE POLICY "global: click_events insert anon"
  ON public.click_events FOR INSERT TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.links l
      WHERE l.id = click_events.link_id
        AND l.status = 'active'
        AND (l.expires_at IS NULL OR l.expires_at > now())
    )
  );

-- Authenticated can insert for active links
CREATE POLICY "global: click_events insert auth"
  ON public.click_events FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.links l
      WHERE l.id = click_events.link_id
        AND l.status = 'active'
        AND (l.expires_at IS NULL OR l.expires_at > now())
    )
  );

-- Owner of the link sees own click events; admin sees all
CREATE POLICY "global: click_events select"
  ON public.click_events FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_global_admin()
  );

-- ---- EARNINGS ----
CREATE POLICY "global: earnings select"
  ON public.earnings FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_global_admin());

CREATE POLICY "global: earnings insert"
  ON public.earnings FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_global_admin());

CREATE POLICY "global: earnings update"
  ON public.earnings FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_global_admin());

-- ---- CAMPAIGNS ----
CREATE POLICY "global: campaigns select"
  ON public.campaigns FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_global_admin());

CREATE POLICY "global: campaigns insert"
  ON public.campaigns FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_active_user());

CREATE POLICY "global: campaigns update"
  ON public.campaigns FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_global_admin());

CREATE POLICY "global: campaigns delete"
  ON public.campaigns FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_global_admin());

-- ---- GOALS ----
CREATE POLICY "global: goals select"
  ON public.goals FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_global_admin());

CREATE POLICY "global: goals insert"
  ON public.goals FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_active_user());

CREATE POLICY "global: goals update"
  ON public.goals FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_global_admin());

-- ---- IP EXCLUSIONS ----
CREATE POLICY "global: ip_exclusions select"
  ON public.ip_exclusions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_global_admin());

CREATE POLICY "global: ip_exclusions insert"
  ON public.ip_exclusions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_global_admin());

CREATE POLICY "global: ip_exclusions delete"
  ON public.ip_exclusions FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_global_admin());

-- ---- API KEYS ----
CREATE POLICY "global: api_keys select"
  ON public.api_keys FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_global_admin());

CREATE POLICY "global: api_keys insert"
  ON public.api_keys FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_active_user());

CREATE POLICY "global: api_keys delete"
  ON public.api_keys FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_global_admin());

-- ---- INVITES ----
CREATE POLICY "global: invites select"
  ON public.invites FOR SELECT TO authenticated
  USING (public.is_global_admin() OR invited_by = auth.uid());

CREATE POLICY "global: invites insert"
  ON public.invites FOR INSERT TO authenticated
  WITH CHECK (public.is_global_admin());

CREATE POLICY "global: invites update"
  ON public.invites FOR UPDATE TO authenticated
  USING (public.is_global_admin());

CREATE POLICY "global: invites delete"
  ON public.invites FOR DELETE TO authenticated
  USING (public.is_global_admin());

-- ---------------------------------------------------------------------------
-- 6. UPDATE resolve_link_and_log_click: remove company_id from INSERT
-- ---------------------------------------------------------------------------
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
  v_is_bot boolean;
  v_is_self_click boolean;
  v_is_unique boolean;
  v_ip_24h_clicked boolean;
  v_click_id uuid;
  v_is_filtered boolean;
  v_filter_reason text;
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

  -- Bot detection
  v_is_bot := FALSE;
  IF p_user_agent IS NOT NULL THEN
    v_is_bot := (p_user_agent ~* '(bot|crawler|spider|crawl|scraper|facebookexternalhit|pingdom|headless|bytespider|petalbot|semrush|ahrefs|mj12bot|dotbot|yandex|baiduspider|googlebot|bingbot|slurp|duckduckbot|teoma|exabot|facebot|ia_archiver|python-requests|curl|wget|libwww|java|go-http|okhttp|axios|scrapy|phantomjs|selenium|puppeteer|playwright)');
  END IF;

  -- Self-click: check IP exclusions for the link owner
  v_is_self_click := FALSE;
  IF p_ip IS NOT NULL THEN
    v_is_self_click := EXISTS (
      SELECT 1 FROM public.ip_exclusions x
      WHERE x.user_id = l.user_id AND x.ip_address = p_ip
    );
  END IF;

  -- Unique click per IP per 24h (per link)
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
    NULL,
    NULL,
    NULL,
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

  -- Only count real unique clicks in aggregate
  IF v_is_unique AND NOT v_is_filtered THEN
    UPDATE public.links SET click_count = COALESCE(click_count, 0) + 1 WHERE id = l.id;
  END IF;

  -- Update user last_active_at
  UPDATE public.users SET last_active_at = now() WHERE id = l.user_id;

  destination_url := l.destination_url;
  requires_password := FALSE;
  click_event_id := v_click_id;
  RETURN NEXT;
END;
$$;

-- ---------------------------------------------------------------------------
-- 7. GRANT execute on helper functions to authenticated
-- ---------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.is_global_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_link_and_log_click(text, text, text, text, text, text, text, text) TO anon, authenticated;
