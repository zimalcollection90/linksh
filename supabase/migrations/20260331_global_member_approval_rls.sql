-- Global member approval controls (no company-facing gating in app layer).
-- Keeps existing schema intact while enforcing active member status for link mutations.

CREATE OR REPLACE FUNCTION public.admin_set_member_status_global(
  p_member_user_id uuid,
  p_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  actor_uid uuid := auth.uid();
  normalized_status text := lower(coalesce(p_status, ''));
BEGIN
  IF actor_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF normalized_status NOT IN ('active', 'suspended', 'pending') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = actor_uid
      AND u.role IN ('admin', 'super_admin')
      AND u.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  UPDATE public.users
  SET status = normalized_status, updated_at = now()
  WHERE id = p_member_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Member not found';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_member_role_global(
  p_member_user_id uuid,
  p_role text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  actor_uid uuid := auth.uid();
  normalized_role text := lower(coalesce(p_role, ''));
BEGIN
  IF actor_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF normalized_role NOT IN ('admin', 'member') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = actor_uid
      AND u.role IN ('admin', 'super_admin')
      AND u.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  UPDATE public.users
  SET role = normalized_role, updated_at = now()
  WHERE id = p_member_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Member not found';
  END IF;
END;
$$;

-- Enforce that only active users can create or mutate links.
DROP POLICY IF EXISTS "links insert member" ON public.links;
CREATE POLICY "links insert member"
  ON public.links
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.status = 'active'
    )
  );

DROP POLICY IF EXISTS "links update member/admin" ON public.links;
CREATE POLICY "links update member/admin"
  ON public.links
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'super_admin')
        AND u.status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.status = 'active'
    )
  );
