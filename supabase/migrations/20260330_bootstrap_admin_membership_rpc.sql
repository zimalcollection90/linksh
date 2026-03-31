-- Allows authenticated admin users (based on public.users.role) to self-bootstrap
-- their own company + active company_members row when legacy data is missing.
CREATE OR REPLACE FUNCTION public.bootstrap_admin_membership_for_self()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_uid uuid := auth.uid();
  u public.users%ROWTYPE;
BEGIN
  IF current_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT *
  INTO u
  FROM public.users
  WHERE id = current_uid
  LIMIT 1;

  IF u.id IS NULL THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  IF COALESCE(u.role, 'member') <> 'admin' THEN
    RAISE EXCEPTION 'Only admin users can bootstrap membership';
  END IF;

  INSERT INTO public.companies (id, name)
  VALUES (
    current_uid,
    COALESCE(u.display_name, u.full_name, u.email, 'Company')
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.company_members (company_id, user_id, role, status)
  VALUES (
    current_uid,
    current_uid,
    'admin',
    'active'
  )
  ON CONFLICT (company_id, user_id)
  DO UPDATE
  SET
    role = 'admin',
    status = 'active',
    updated_at = now();
END;
$$;
