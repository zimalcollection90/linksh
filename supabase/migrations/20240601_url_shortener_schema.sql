-- URL Shortener & Analytics Platform Schema

-- Profiles table (extends public.users)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS username text UNIQUE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS bio text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role text DEFAULT 'member' CHECK (role IN ('admin', 'member'));
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS display_name text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS earnings_rate numeric(10,4) DEFAULT 0.01;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS status text DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'pending'));
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS theme text DEFAULT 'dark';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS accent_color text DEFAULT 'purple';

-- Short links table
CREATE TABLE IF NOT EXISTS public.links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  short_code text UNIQUE NOT NULL,
  destination_url text NOT NULL,
  title text,
  password_hash text,
  is_password_protected boolean DEFAULT false,
  expires_at timestamp with time zone,
  status text DEFAULT 'active' CHECK (status IN ('active', 'expired', 'paused')),
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  campaign_id uuid,
  click_count bigint DEFAULT 0,
  fraud_score numeric(5,2) DEFAULT 0,
  is_fraud_flagged boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Click events table
CREATE TABLE IF NOT EXISTS public.click_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id uuid REFERENCES public.links(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ip_address text,
  country text,
  country_code text,
  city text,
  device_type text,
  browser text,
  os text,
  referrer text,
  user_agent text,
  is_unique boolean DEFAULT true,
  is_bot boolean DEFAULT false,
  quality_score numeric(5,2) DEFAULT 100,
  clicked_at timestamp with time zone DEFAULT now()
);

-- Campaigns table
CREATE TABLE IF NOT EXISTS public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  status text DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Earnings table
CREATE TABLE IF NOT EXISTS public.earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  link_id uuid REFERENCES public.links(id) ON DELETE SET NULL,
  clicks bigint DEFAULT 0,
  rate numeric(10,4) DEFAULT 0.01,
  amount numeric(10,2) DEFAULT 0,
  period_start timestamp with time zone,
  period_end timestamp with time zone,
  payment_status text DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid', 'pending')),
  paid_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

-- Goals table
CREATE TABLE IF NOT EXISTS public.goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  target_clicks bigint DEFAULT 1000,
  target_earnings numeric(10,2) DEFAULT 100,
  period text DEFAULT 'monthly' CHECK (period IN ('daily', 'weekly', 'monthly')),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- IP exclusions table
CREATE TABLE IF NOT EXISTS public.ip_exclusions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  ip_address text NOT NULL,
  reason text,
  created_at timestamp with time zone DEFAULT now()
);

-- API keys table
CREATE TABLE IF NOT EXISTS public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  key_hash text NOT NULL,
  key_prefix text NOT NULL,
  last_used_at timestamp with time zone,
  usage_count bigint DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

-- Invites table
CREATE TABLE IF NOT EXISTS public.invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invited_by uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  email text NOT NULL,
  role text DEFAULT 'member',
  token text UNIQUE NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  expires_at timestamp with time zone DEFAULT now() + interval '7 days',
  created_at timestamp with time zone DEFAULT now()
);

-- Add foreign key for campaigns
ALTER TABLE public.links ADD CONSTRAINT fk_links_campaign 
  FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE SET NULL
  NOT VALID;

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_links_updated_at ON public.links;
CREATE TRIGGER update_links_updated_at
  BEFORE UPDATE ON public.links
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_campaigns_updated_at ON public.campaigns;
CREATE TRIGGER update_campaigns_updated_at
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to increment click count
CREATE OR REPLACE FUNCTION increment_link_clicks(link_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE public.links SET click_count = click_count + 1 WHERE id = link_id;
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- Enable realtime for click_events
ALTER publication supabase_realtime ADD TABLE public.click_events;
ALTER publication supabase_realtime ADD TABLE public.links;
