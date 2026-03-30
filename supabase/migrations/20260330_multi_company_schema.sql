-- Multi-company foundation: companies + company_members + company_id across core tables.
-- This is the first step toward strict multi-tenant RLS.

create extension if not exists pgcrypto;

-- Companies
CREATE TABLE IF NOT EXISTS public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone
);

-- Company membership (roles per company)
CREATE TABLE IF NOT EXISTS public.company_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('super_admin', 'admin', 'member')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'pending')),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone,
  UNIQUE (company_id, user_id)
);

-- Notifications (for activity + weekly reports, etc.)
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  payload jsonb,
  is_read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

-- Add company_id columns (kept nullable for backward compatibility during migration)
ALTER TABLE public.links ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.click_events ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.earnings ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.invites ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.api_keys ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.ip_exclusions ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);

-- Backfill: create a 1:1 company for each existing user (company.id = user.id),
-- and set existing rows' company_id from their user ownership.
INSERT INTO public.companies (id, name, created_at)
SELECT
  u.id,
  COALESCE(u.display_name, u.full_name, u.email, 'Company') AS name,
  now()
FROM public.users u
WHERE NOT EXISTS (SELECT 1 FROM public.companies c WHERE c.id = u.id);

INSERT INTO public.company_members (company_id, user_id, role, status, created_at)
SELECT
  u.id AS company_id,
  u.id AS user_id,
  CASE
    WHEN u.role = 'admin' THEN 'admin'
    ELSE 'member'
  END AS role,
  COALESCE(u.status, 'active') AS status,
  now()
FROM public.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.company_members cm WHERE cm.company_id = u.id AND cm.user_id = u.id
);

UPDATE public.links l
SET company_id = l.user_id
WHERE l.company_id IS NULL;

UPDATE public.click_events ce
SET company_id = ce.user_id
WHERE ce.company_id IS NULL AND ce.user_id IS NOT NULL;

UPDATE public.earnings e
SET company_id = e.user_id
WHERE e.company_id IS NULL;

UPDATE public.campaigns c
SET company_id = c.user_id
WHERE c.company_id IS NULL;

UPDATE public.goals g
SET company_id = g.user_id
WHERE g.company_id IS NULL;

UPDATE public.invites i
SET company_id = i.invited_by
WHERE i.company_id IS NULL AND i.invited_by IS NOT NULL;

UPDATE public.api_keys k
SET company_id = k.user_id
WHERE k.company_id IS NULL;

UPDATE public.ip_exclusions x
SET company_id = x.user_id
WHERE x.company_id IS NULL;

-- Keep Supabase Realtime compatible (click_events + links were already enabled previously)

