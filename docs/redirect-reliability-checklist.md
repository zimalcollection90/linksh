# Redirect Reliability Deployment Checklist

Use this checklist when deploying changes related to short-link redirects.

## 1) Confirm latest RPC exists and is callable

Run in Supabase SQL editor:

```sql
select
  n.nspname as schema_name,
  p.proname as function_name,
  p.oid::regprocedure::text as signature
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'resolve_link_and_log_click';
```

Expected: one signature for `resolve_link_and_log_click(text,text,text,text,text,text,text,text)` that returns `destination_url`, `requires_password`, `click_event_id`.

## 2) Verify public link-read policy is active

```sql
select policyname, permissive, roles, cmd
from pg_policies
where schemaname = 'public'
  and tablename = 'links'
order by policyname;
```

Expected: a policy equivalent to `links public select active` exists for `anon`.

## 3) Validate redirect path manually

- Create a new active short link.
- Open it in an incognito window.
- Confirm immediate redirect to destination URL.

## 4) Validate analytics write-path

After opening the short link, verify:

```sql
select id, link_id, ip_address, country_code, device_type, browser, os, clicked_at
from public.click_events
order by clicked_at desc
limit 20;
```

Expected: new `click_events` rows appear; `country_code` may be null briefly until async enrichment completes.

## 5) Validate aggregate click count

```sql
select id, short_code, click_count
from public.links
order by updated_at desc
limit 20;
```

Expected: `click_count` increments according to unique-click logic.
