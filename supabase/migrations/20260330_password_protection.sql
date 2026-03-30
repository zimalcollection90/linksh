-- Password protection: hash passwords on write and verify them on redirect.

CREATE OR REPLACE FUNCTION public.hash_link_password()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- We treat `password_hash` as a transient raw password coming from the client
  -- when `is_password_protected = true`. This prevents ever storing plaintext.
  IF NEW.is_password_protected = true AND NEW.password_hash IS NOT NULL THEN
    -- If it already looks like a bcrypt hash, don't double-hash.
    IF NEW.password_hash NOT LIKE '$2%' THEN
      -- bcrypt (bf) format is stored in `crypt` output (e.g. $2y$...)
      NEW.password_hash := crypt(NEW.password_hash, gen_salt('bf'));
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_links_hash_link_password ON public.links;
CREATE TRIGGER trg_links_hash_link_password
BEFORE INSERT OR UPDATE ON public.links
FOR EACH ROW EXECUTE FUNCTION public.hash_link_password();

-- Helper for redirect/password gate checks.
CREATE OR REPLACE FUNCTION public.verify_link_password(p_link_id uuid, p_password text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    CASE
      WHEN l.password_hash IS NULL THEN false
      ELSE crypt(p_password, l.password_hash) = l.password_hash
    END
  FROM public.links l
  WHERE l.id = p_link_id
  LIMIT 1;
$$;

