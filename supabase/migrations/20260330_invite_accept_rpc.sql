-- Invite acceptance RPC for the `/invite?token=...` flow.
-- Uses SECURITY DEFINER so it can safely assign company membership under strict RLS.

CREATE OR REPLACE FUNCTION public.accept_invite(p_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  inv_row public.invites%ROWTYPE;
  current_email text;
  current_uid uuid := auth.uid();
  target_company uuid;
BEGIN
  IF current_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT *
  INTO inv_row
  FROM public.invites
  WHERE token = p_token
  LIMIT 1;

  IF inv_row.id IS NULL THEN
    RAISE EXCEPTION 'Invalid invite token';
  END IF;

  IF inv_row.status <> 'pending' THEN
    RAISE EXCEPTION 'Invite is not pending';
  END IF;

  IF inv_row.expires_at IS NOT NULL AND inv_row.expires_at < now() THEN
    RAISE EXCEPTION 'Invite expired';
  END IF;

  SELECT email
  INTO current_email
  FROM public.users
  WHERE id = current_uid
  LIMIT 1;

  IF current_email IS NULL OR current_email <> inv_row.email THEN
    RAISE EXCEPTION 'Invite email mismatch';
  END IF;

  target_company := inv_row.company_id;

  IF target_company IS NULL THEN
    -- Fallback: derive from the inviter's membership
    SELECT cm.company_id
    INTO target_company
    FROM public.company_members cm
    WHERE cm.user_id = inv_row.invited_by
      AND cm.status = 'active'
    ORDER BY cm.created_at DESC
    LIMIT 1;
  END IF;

  IF target_company IS NULL THEN
    RAISE EXCEPTION 'Invite company not found';
  END IF;

  -- Assign membership to the current user
  INSERT INTO public.company_members (company_id, user_id, role, status)
  VALUES (
    target_company,
    current_uid,
    CASE WHEN inv_row.role = 'admin' THEN 'admin' ELSE 'member' END,
    'active'
  )
  ON CONFLICT (company_id, user_id)
  DO UPDATE
  SET
    role = EXCLUDED.role,
    status = 'active',
    updated_at = now();

  -- Update legacy profile fields used by the current UI
  UPDATE public.users
  SET
    role = CASE WHEN inv_row.role = 'admin' THEN 'admin' ELSE 'member' END,
    status = 'active',
    updated_at = now()
  WHERE id = current_uid;

  -- Mark invite accepted
  UPDATE public.invites
  SET status = 'accepted'
  WHERE id = inv_row.id;
END;
$$;

