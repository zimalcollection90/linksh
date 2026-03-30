-- Ensure new auth users automatically get a company + company_members row.
-- This keeps multi-tenant RLS functional for signups without needing UI code changes.

CREATE OR REPLACE FUNCTION public.ensure_company_membership_for_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Bootstrap: create a 1:1 company for the new user (company.id == user.id).
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
    COALESCE(NEW.status, 'active')
  )
  ON CONFLICT (company_id, user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_company_membership_for_new_user ON public.users;
CREATE TRIGGER trg_ensure_company_membership_for_new_user
AFTER INSERT ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.ensure_company_membership_for_new_user();

