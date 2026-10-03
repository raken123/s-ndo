-- Plans without payments: Stripe is gone, and anyone signed in can switch between Free, Lite and
-- Pro straight away. Lite and Pro still come with monthly credits (1,500 / 5,000), given once per
-- 30-day period. Switching up mid-period tops up the difference, and switching back and forth
-- never gives a period's credits twice.

alter table public.profiles
  drop column stripe_customer_id,
  drop column stripe_subscription_id,
  drop column pro_trial_used,
  drop column lite_intro_used,
  drop column trial_ends_at,
  drop column current_period_end,
  add column monthly_period_start timestamptz,
  add column monthly_granted bigint not null default 0;

comment on column public.profiles.plan_status is 'active on Lite/Pro, none on Free';
comment on column public.profiles.subscribed_at is 'when the account last moved from Free to Lite/Pro (December 23 offer)';

create function public.plan_monthly_credits(p_plan text) returns bigint
language sql immutable as $$
  select (case p_plan when 'pro' then 5000 when 'lite' then 1500 else 0 end)::bigint
$$;

-- Gives this period's monthly credits that haven't been given yet. Returns how many were added.
create function public.claim_monthly_credits() returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  p public.profiles;
  owed bigint;
begin
  if auth.uid() is null then
    return 0;
  end if;
  select * into p from public.profiles where id = auth.uid() for update;
  if not found or p.plan = 'free' then
    return 0;
  end if;
  if p.monthly_period_start is null or now() >= p.monthly_period_start + interval '30 days' then
    p.monthly_period_start := now();
    p.monthly_granted := 0;
  end if;
  owed := greatest(public.plan_monthly_credits(p.plan) - p.monthly_granted, 0);
  update public.profiles
    set monthly_period_start = p.monthly_period_start, monthly_granted = p.monthly_granted + owed
    where id = p.id;
  if owed > 0 then
    perform public.grant_credits(p.id, owed, p.plan || '_monthly', null);
  end if;
  return owed;
end $$;

-- Switch plan right away (no payment). Returns the monthly credits added.
create function public.switch_plan(p_plan text) returns bigint
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  if p_plan is null or p_plan not in ('free', 'lite', 'pro') then
    raise exception 'unknown plan';
  end if;
  update public.profiles set
    subscribed_at = case
      when p_plan = 'free' then null
      when plan = 'free' or subscribed_at is null then now()
      else subscribed_at end,
    plan = p_plan,
    plan_status = case when p_plan = 'free' then 'none' else 'active' end
  where id = auth.uid();
  return public.claim_monthly_credits();
end $$;

revoke execute on function public.claim_monthly_credits(), public.switch_plan(text) from public, anon;
grant execute on function public.claim_monthly_credits(), public.switch_plan(text) to authenticated;
