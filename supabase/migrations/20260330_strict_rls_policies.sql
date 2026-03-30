-- Strict multi-tenant RLS policies + company_id auto-population triggers.
-- This step enables a company-scoped data model for admins/members.

-- Triggers to auto-populate company_id based on ownership
CREATE OR REPLACE FUNCTION public.links_set_company_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.company_id IS NULL AND NEW.user_id IS NOT NULL THEN
    SELECT cm.company_id
    INTO NEW.company_id
    FROM public.company_members cm
    WHERE cm.user_id = NEW.user_id
      AND cm.status = 'active'
    ORDER BY cm.created_at DESC
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.click_events_set_company_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.company_id IS NULL AND NEW.link_id IS NOT NULL THEN
    SELECT l.company_id
    INTO NEW.company_id
    FROM public.links l
    WHERE l.id = NEW.link_id
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.earnings_set_company_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.company_id IS NULL AND NEW.user_id IS NOT NULL THEN
    SELECT cm.company_id
    INTO NEW.company_id
    FROM public.company_members cm
    WHERE cm.user_id = NEW.user_id
      AND cm.status = 'active'
    ORDER BY cm.created_at DESC
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.campaigns_set_company_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.company_id IS NULL AND NEW.user_id IS NOT NULL THEN
    SELECT cm.company_id
    INTO NEW.company_id
    FROM public.company_members cm
    WHERE cm.user_id = NEW.user_id
      AND cm.status = 'active'
    ORDER BY cm.created_at DESC
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.goals_set_company_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.company_id IS NULL AND NEW.user_id IS NOT NULL THEN
    SELECT cm.company_id
    INTO NEW.company_id
    FROM public.company_members cm
    WHERE cm.user_id = NEW.user_id
      AND cm.status = 'active'
    ORDER BY cm.created_at DESC
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.invites_set_company_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.company_id IS NULL AND NEW.invited_by IS NOT NULL THEN
    SELECT cm.company_id
    INTO NEW.company_id
    FROM public.company_members cm
    WHERE cm.user_id = NEW.invited_by
      AND cm.status = 'active'
    ORDER BY cm.created_at DESC
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.api_keys_set_company_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.company_id IS NULL AND NEW.user_id IS NOT NULL THEN
    SELECT cm.company_id
    INTO NEW.company_id
    FROM public.company_members cm
    WHERE cm.user_id = NEW.user_id
      AND cm.status = 'active'
    ORDER BY cm.created_at DESC
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.ip_exclusions_set_company_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.company_id IS NULL AND NEW.user_id IS NOT NULL THEN
    SELECT cm.company_id
    INTO NEW.company_id
    FROM public.company_members cm
    WHERE cm.user_id = NEW.user_id
      AND cm.status = 'active'
    ORDER BY cm.created_at DESC
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

-- Triggers
DROP TRIGGER IF EXISTS trg_links_set_company_id ON public.links;
CREATE TRIGGER trg_links_set_company_id
BEFORE INSERT OR UPDATE ON public.links
FOR EACH ROW EXECUTE FUNCTION public.links_set_company_id();

DROP TRIGGER IF EXISTS trg_click_events_set_company_id ON public.click_events;
CREATE TRIGGER trg_click_events_set_company_id
BEFORE INSERT OR UPDATE ON public.click_events
FOR EACH ROW EXECUTE FUNCTION public.click_events_set_company_id();

DROP TRIGGER IF EXISTS trg_earnings_set_company_id ON public.earnings;
CREATE TRIGGER trg_earnings_set_company_id
BEFORE INSERT OR UPDATE ON public.earnings
FOR EACH ROW EXECUTE FUNCTION public.earnings_set_company_id();

DROP TRIGGER IF EXISTS trg_campaigns_set_company_id ON public.campaigns;
CREATE TRIGGER trg_campaigns_set_company_id
BEFORE INSERT OR UPDATE ON public.campaigns
FOR EACH ROW EXECUTE FUNCTION public.campaigns_set_company_id();

DROP TRIGGER IF EXISTS trg_goals_set_company_id ON public.goals;
CREATE TRIGGER trg_goals_set_company_id
BEFORE INSERT OR UPDATE ON public.goals
FOR EACH ROW EXECUTE FUNCTION public.goals_set_company_id();

DROP TRIGGER IF EXISTS trg_invites_set_company_id ON public.invites;
CREATE TRIGGER trg_invites_set_company_id
BEFORE INSERT OR UPDATE ON public.invites
FOR EACH ROW EXECUTE FUNCTION public.invites_set_company_id();

DROP TRIGGER IF EXISTS trg_api_keys_set_company_id ON public.api_keys;
CREATE TRIGGER trg_api_keys_set_company_id
BEFORE INSERT OR UPDATE ON public.api_keys
FOR EACH ROW EXECUTE FUNCTION public.api_keys_set_company_id();

DROP TRIGGER IF EXISTS trg_ip_exclusions_set_company_id ON public.ip_exclusions;
CREATE TRIGGER trg_ip_exclusions_set_company_id
BEFORE INSERT OR UPDATE ON public.ip_exclusions
FOR EACH ROW EXECUTE FUNCTION public.ip_exclusions_set_company_id();

-- Keep company_members.role/status in sync with the legacy public.users.role/status fields
-- (used by the UI today). This avoids permission drift under strict RLS.
CREATE OR REPLACE FUNCTION public.sync_company_members_from_users()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- For the current 1:1 bootstrap mapping (company.id == users.id), update that row.
  -- Later invite-based multi-company assignment should update company_members directly.
  UPDATE public.company_members
  SET
    role = CASE
      WHEN NEW.role = 'admin' THEN 'admin'
      ELSE 'member'
    END,
    status = COALESCE(NEW.status, 'active'),
    updated_at = now()
  WHERE user_id = NEW.id
    AND company_id = NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_company_members_from_users ON public.users;
CREATE TRIGGER trg_sync_company_members_from_users
AFTER INSERT OR UPDATE OF role, status ON public.users
FOR EACH ROW EXECUTE FUNCTION public.sync_company_members_from_users();

-- Enable RLS
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.click_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ip_exclusions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Company selection
DROP POLICY IF EXISTS "companies select members" ON public.companies;
CREATE POLICY "companies select members"
  ON public.companies
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.company_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.company_id = companies.id
        AND cm.status = 'active'
    )
    OR EXISTS (
      SELECT 1
      FROM public.company_members cm2
      WHERE cm2.user_id = auth.uid()
        AND cm2.role = 'super_admin'
        AND cm2.status = 'active'
    )
  );

-- Company members
DROP POLICY IF EXISTS "company_members select company" ON public.company_members;
CREATE POLICY "company_members select company"
  ON public.company_members
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.company_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.company_id = company_members.company_id
        AND cm.status = 'active'
    )
    OR EXISTS (
      SELECT 1
      FROM public.company_members cm2
      WHERE cm2.user_id = auth.uid()
        AND cm2.role = 'super_admin'
        AND cm2.status = 'active'
    )
  );

DROP POLICY IF EXISTS "company_members update admin" ON public.company_members;
CREATE POLICY "company_members update admin"
  ON public.company_members
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.company_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.company_id = company_members.company_id
        AND cm.role IN ('admin', 'super_admin')
        AND cm.status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.company_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.company_id = company_members.company_id
        AND cm.role IN ('admin', 'super_admin')
        AND cm.status = 'active'
    )
  );

-- Users: self + same-company admin/super_admin
DROP POLICY IF EXISTS "users select company admins" ON public.users;
CREATE POLICY "users select company admins"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = users.id
    OR EXISTS (
      SELECT 1
      FROM public.company_members cm_admin
      JOIN public.company_members cm_target
        ON cm_admin.company_id = cm_target.company_id
      WHERE cm_admin.user_id = auth.uid()
        AND cm_admin.role IN ('admin', 'super_admin')
        AND cm_admin.status = 'active'
        AND cm_target.user_id = users.id
        AND cm_target.status IN ('active', 'suspended', 'pending')
    )
  );

DROP POLICY IF EXISTS "users insert self" ON public.users;
CREATE POLICY "users insert self"
  ON public.users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = users.id);

DROP POLICY IF EXISTS "users update self or admin" ON public.users;
CREATE POLICY "users update self or admin"
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = users.id
    OR EXISTS (
      SELECT 1
      FROM public.company_members cm_admin
      JOIN public.company_members cm_target
        ON cm_admin.company_id = cm_target.company_id
      WHERE cm_admin.user_id = auth.uid()
        AND cm_admin.role IN ('admin', 'super_admin')
        AND cm_admin.status = 'active'
        AND cm_target.user_id = users.id
    )
  )
  WITH CHECK (
    auth.uid() = users.id
    OR EXISTS (
      SELECT 1
      FROM public.company_members cm_admin
      JOIN public.company_members cm_target
        ON cm_admin.company_id = cm_target.company_id
      WHERE cm_admin.user_id = auth.uid()
        AND cm_admin.role IN ('admin', 'super_admin')
        AND cm_admin.status = 'active'
        AND cm_target.user_id = users.id
    )
  );

-- Links: public select for active links; authenticated members manage own company
DROP POLICY IF EXISTS "links public select active" ON public.links;
CREATE POLICY "links public select active"
  ON public.links
  FOR SELECT
  TO anon
  USING (
    status = 'active'
    AND (expires_at IS NULL OR expires_at > now())
  );

DROP POLICY IF EXISTS "links select company" ON public.links;
CREATE POLICY "links select company"
  ON public.links
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.company_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.company_id = links.company_id
        AND cm.status = 'active'
    )
    OR EXISTS (
      SELECT 1
      FROM public.company_members cm2
      WHERE cm2.user_id = auth.uid()
        AND cm2.role = 'super_admin'
        AND cm2.status = 'active'
    )
  );

DROP POLICY IF EXISTS "links insert member" ON public.links;
CREATE POLICY "links insert member"
  ON public.links
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.company_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.company_id = links.company_id
        AND cm.status = 'active'
    )
  );

DROP POLICY IF EXISTS "links update member/admin" ON public.links;
CREATE POLICY "links update member/admin"
  ON public.links
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.company_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.company_id = links.company_id
        AND cm.status = 'active'
        AND cm.role IN ('admin', 'super_admin')
    )
    OR user_id = auth.uid()
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.company_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.company_id = links.company_id
        AND cm.status = 'active'
    )
  );

-- Allow anonymous users to mark already-expired links as expired (redirect edge-case).
-- Restrict to rows that are currently active and already past their expiry.
DROP POLICY IF EXISTS "links anon mark expired" ON public.links;
CREATE POLICY "links anon mark expired"
  ON public.links
  FOR UPDATE
  TO anon
  USING (
    status = 'active'
    AND expires_at IS NOT NULL
    AND expires_at < now()
  )
  WITH CHECK (
    status = 'expired'
  );

DROP POLICY IF EXISTS "links delete member/admin" ON public.links;
CREATE POLICY "links delete member/admin"
  ON public.links
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.company_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.company_id = links.company_id
        AND cm.status = 'active'
        AND cm.role IN ('admin', 'super_admin')
    )
    OR user_id = auth.uid()
  );

-- Click events: allow public/anon inserts for active links; restrict reads to company members
DROP POLICY IF EXISTS "click_events insert for active links" ON public.click_events;
CREATE POLICY "click_events insert for active links"
  ON public.click_events
  FOR INSERT
  TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.links l
      WHERE l.id = click_events.link_id
        AND l.status = 'active'
        AND (l.expires_at IS NULL OR l.expires_at > now())
    )
  );

DROP POLICY IF EXISTS "click_events insert for active links auth" ON public.click_events;
CREATE POLICY "click_events insert for active links auth"
  ON public.click_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.links l
      WHERE l.id = click_events.link_id
        AND l.status = 'active'
        AND (l.expires_at IS NULL OR l.expires_at > now())
    )
  );

DROP POLICY IF EXISTS "click_events select company" ON public.click_events;
CREATE POLICY "click_events select company"
  ON public.click_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.company_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.company_id = click_events.company_id
        AND cm.status = 'active'
    )
    OR EXISTS (
      SELECT 1
      FROM public.company_members cm2
      WHERE cm2.user_id = auth.uid()
        AND cm2.role = 'super_admin'
        AND cm2.status = 'active'
    )
  );

-- Earnings: company scoped reads; writes limited to owner or admin
DROP POLICY IF EXISTS "earnings select company" ON public.earnings;
CREATE POLICY "earnings select company"
  ON public.earnings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.company_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.company_id = earnings.company_id
        AND cm.status = 'active'
    )
    OR EXISTS (
      SELECT 1
      FROM public.company_members cm2
      WHERE cm2.user_id = auth.uid()
        AND cm2.role = 'super_admin'
        AND cm2.status = 'active'
    )
  );

DROP POLICY IF EXISTS "earnings modify owner_or_admin" ON public.earnings;
CREATE POLICY "earnings modify owner_or_admin"
  ON public.earnings
  FOR UPDATE
  TO authenticated
  USING (
    earnings.user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.company_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.company_id = earnings.company_id
        AND cm.role IN ('admin', 'super_admin')
        AND cm.status = 'active'
    )
  )
  WITH CHECK (
    earnings.user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.company_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.company_id = earnings.company_id
        AND cm.status = 'active'
    )
  );

-- Campaigns: restrict CRUD to company members; reads are company-scoped
DROP POLICY IF EXISTS "campaigns select company" ON public.campaigns;
CREATE POLICY "campaigns select company"
  ON public.campaigns
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.company_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.company_id = campaigns.company_id
        AND cm.status = 'active'
    )
    OR EXISTS (
      SELECT 1
      FROM public.company_members cm2
      WHERE cm2.user_id = auth.uid()
        AND cm2.role = 'super_admin'
        AND cm2.status = 'active'
    )
  );

DROP POLICY IF EXISTS "campaigns insert member" ON public.campaigns;
CREATE POLICY "campaigns insert member"
  ON public.campaigns
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.company_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.company_id = campaigns.company_id
        AND cm.status = 'active'
    )
  );

-- Goals: company scoped reads; writes limited
DROP POLICY IF EXISTS "goals select company" ON public.goals;
CREATE POLICY "goals select company"
  ON public.goals
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.company_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.company_id = goals.company_id
        AND cm.status = 'active'
    )
    OR EXISTS (
      SELECT 1
      FROM public.company_members cm2
      WHERE cm2.user_id = auth.uid()
        AND cm2.role = 'super_admin'
        AND cm2.status = 'active'
    )
  );

DROP POLICY IF EXISTS "goals modify owner_or_admin" ON public.goals;
CREATE POLICY "goals modify owner_or_admin"
  ON public.goals
  FOR UPDATE
  TO authenticated
  USING (
    goals.user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.company_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.company_id = goals.company_id
        AND cm.role IN ('admin', 'super_admin')
        AND cm.status = 'active'
    )
  )
  WITH CHECK (
    goals.user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.company_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.company_id = goals.company_id
        AND cm.status = 'active'
    )
  );

-- IP exclusions: owner or admin within the row's company
DROP POLICY IF EXISTS "ip_exclusions select" ON public.ip_exclusions;
CREATE POLICY "ip_exclusions select"
  ON public.ip_exclusions
  FOR SELECT
  TO authenticated
  USING (
    ip_exclusions.user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.company_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.company_id = ip_exclusions.company_id
        AND cm.role IN ('admin', 'super_admin')
        AND cm.status = 'active'
    )
  );

DROP POLICY IF EXISTS "ip_exclusions modify" ON public.ip_exclusions;
CREATE POLICY "ip_exclusions modify"
  ON public.ip_exclusions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    ip_exclusions.user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.company_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.company_id = ip_exclusions.company_id
        AND cm.role IN ('admin', 'super_admin')
        AND cm.status = 'active'
    )
  );

DROP POLICY IF EXISTS "ip_exclusions delete" ON public.ip_exclusions;
CREATE POLICY "ip_exclusions delete"
  ON public.ip_exclusions
  FOR DELETE
  TO authenticated
  USING (
    ip_exclusions.user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.company_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.company_id = ip_exclusions.company_id
        AND cm.role IN ('admin', 'super_admin')
        AND cm.status = 'active'
    )
  );

-- API keys: owner or admin
DROP POLICY IF EXISTS "api_keys select" ON public.api_keys;
CREATE POLICY "api_keys select"
  ON public.api_keys
  FOR SELECT
  TO authenticated
  USING (
    api_keys.user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.company_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.company_id = api_keys.company_id
        AND cm.role IN ('admin', 'super_admin')
        AND cm.status = 'active'
    )
  );

DROP POLICY IF EXISTS "api_keys insert owner" ON public.api_keys;
CREATE POLICY "api_keys insert owner"
  ON public.api_keys
  FOR INSERT
  TO authenticated
  WITH CHECK (api_keys.user_id = auth.uid());

DROP POLICY IF EXISTS "api_keys delete owner_or_admin" ON public.api_keys;
CREATE POLICY "api_keys delete owner_or_admin"
  ON public.api_keys
  FOR DELETE
  TO authenticated
  USING (
    api_keys.user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.company_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.company_id = api_keys.company_id
        AND cm.role IN ('admin', 'super_admin')
        AND cm.status = 'active'
    )
  );

-- Invites: only admins/super_admin can create/manage within a company
DROP POLICY IF EXISTS "invites select admin" ON public.invites;
CREATE POLICY "invites select admin"
  ON public.invites
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.company_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.company_id = invites.company_id
        AND cm.role IN ('admin', 'super_admin')
        AND cm.status = 'active'
    )
  );

DROP POLICY IF EXISTS "invites insert admin" ON public.invites;
CREATE POLICY "invites insert admin"
  ON public.invites
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.company_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.company_id = invites.company_id
        AND cm.role IN ('admin', 'super_admin')
        AND cm.status = 'active'
    )
  );

DROP POLICY IF EXISTS "invites update admin" ON public.invites;
CREATE POLICY "invites update admin"
  ON public.invites
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.company_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.company_id = invites.company_id
        AND cm.role IN ('admin', 'super_admin')
        AND cm.status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.company_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.company_id = invites.company_id
        AND cm.role IN ('admin', 'super_admin')
        AND cm.status = 'active'
    )
  );

-- Notifications: user-scoped reads
DROP POLICY IF EXISTS "notifications select own" ON public.notifications;
CREATE POLICY "notifications select own"
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (
    notifications.user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.company_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.company_id = notifications.company_id
        AND cm.role IN ('admin', 'super_admin')
        AND cm.status = 'active'
    )
  );

DROP POLICY IF EXISTS "notifications insert own" ON public.notifications;
CREATE POLICY "notifications insert own"
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    notifications.user_id = auth.uid()
  );

-- Enforce RLS
ALTER TABLE public.companies FORCE ROW LEVEL SECURITY;
ALTER TABLE public.company_members FORCE ROW LEVEL SECURITY;
ALTER TABLE public.users FORCE ROW LEVEL SECURITY;
ALTER TABLE public.links FORCE ROW LEVEL SECURITY;
ALTER TABLE public.click_events FORCE ROW LEVEL SECURITY;
ALTER TABLE public.earnings FORCE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns FORCE ROW LEVEL SECURITY;
ALTER TABLE public.goals FORCE ROW LEVEL SECURITY;
ALTER TABLE public.ip_exclusions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys FORCE ROW LEVEL SECURITY;
ALTER TABLE public.invites FORCE ROW LEVEL SECURITY;
ALTER TABLE public.notifications FORCE ROW LEVEL SECURITY;

