-- Member approval workflow:
-- 1) New public signups are pending by default.
-- 2) Admins can approve/suspend/reactivate/reject members through SECURITY DEFINER RPCs.

CREATE OR REPLACE FUNCTION public.ensure_company_membership_for_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.companies (id, name)
  VALUES (
    NEW.id,
    COALESCE(NEW.display_name, NEW.full_name, NEW.email, 'Company')
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.company_members (company_id, user_id, role, status)
  VALUES (
    NEW.id,
    NEW.id,
    CASE
      WHEN NEW.role = 'admin' THEN 'admin'
      ELSE 'member'
    END,
    CASE
      WHEN NEW.role = 'admin' THEN 'active'
      ELSE 'pending'
    END
  )
  ON CONFLICT (company_id, user_id) DO NOTHING;

  UPDATE public.users
  SET
    status = CASE
      WHEN NEW.role = 'admin' THEN 'active'
      ELSE 'pending'
    END,
    updated_at = now()
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

-- Backfill any self-owned memberships to pending when user is not admin.
UPDATE public.company_members cm
SET
  status = 'pending',
  updated_at = now()
FROM public.users u
WHERE cm.company_id = cm.user_id
  AND cm.user_id = u.id
  AND COALESCE(u.role, 'member') <> 'admin'
  AND cm.status <> 'pending';

UPDATE public.users u
SET
  status = 'pending',
  updated_at = now()
WHERE COALESCE(u.role, 'member') <> 'admin'
  AND u.status <> 'pending';

CREATE OR REPLACE FUNCTION public.admin_set_member_status(
  p_company_id uuid,
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
    FROM public.company_members cm
    WHERE cm.company_id = p_company_id
      AND cm.user_id = actor_uid
      AND cm.role IN ('admin', 'super_admin')
      AND cm.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  UPDATE public.company_members
  SET
    status = normalized_status,
    updated_at = now()
  WHERE company_id = p_company_id
    AND user_id = p_member_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Member not found';
  END IF;

  UPDATE public.users
  SET
    status = normalized_status,
    updated_at = now()
  WHERE id = p_member_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_member_role(
  p_company_id uuid,
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
    FROM public.company_members cm
    WHERE cm.company_id = p_company_id
      AND cm.user_id = actor_uid
      AND cm.role IN ('admin', 'super_admin')
      AND cm.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF actor_uid = p_member_user_id AND normalized_role = 'member' THEN
    RAISE EXCEPTION 'Cannot demote yourself';
  END IF;

  UPDATE public.company_members
  SET
    role = normalized_role,
    updated_at = now()
  WHERE company_id = p_company_id
    AND user_id = p_member_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Member not found';
  END IF;

  UPDATE public.users
  SET
    role = normalized_role,
    updated_at = now()
  WHERE id = p_member_user_id;
END;
$$;
