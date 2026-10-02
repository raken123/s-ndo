-- BFDI Talk accounts: profiles, credit wallet, subscriptions, December 23 bonus.
--
-- Credits are a wallet separate from the free usage meter. 1 credit = 1 second of Flash Live
-- talk (Extended Thinking spends 2.5 per second). Only server code (service role) can add
-- credits or change a plan; signed-in users can read their own row, spend their own credits,
-- set a username and claim the December 23 bonus.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique check (username ~ '^[A-Za-z0-9_ .-]{2,24}$'),
  credits bigint not null default 0 check (credits >= 0),
  plan text not null default 'free' check (plan in ('free', 'lite', 'pro')),
  -- Stripe subscription status: none | trialing | active | past_due | unpaid | canceled | incomplete ...
  plan_status text not null default 'none',
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  subscribed_at timestamptz,            -- when the current subscription was created
  stripe_customer_id text unique,
  stripe_subscription_id text,
  pro_trial_used boolean not null default false,
  lite_intro_used boolean not null default false,
  dec23_bonus_claimed boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
create policy "read own profile" on public.profiles for select to authenticated using (auth.uid() = id);
-- No insert/update/delete policies: every change goes through the functions below or the service role.

create table public.credit_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  delta bigint not null,
  reason text not null,
  ref text unique,                      -- idempotency key (Stripe invoice, receipt hash, order id ...)
  created_at timestamptz not null default now()
);
create index credit_ledger_user_idx on public.credit_ledger (user_id, created_at desc);

alter table public.credit_ledger enable row level security;
create policy "read own ledger" on public.credit_ledger for select to authenticated using (auth.uid() = user_id);

-- Profile row for every new account. A taken username falls back to none (the app checks first).
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  begin
    insert into public.profiles (id, username) values (new.id, nullif(trim(new.raw_user_meta_data ->> 'username'), ''));
  exception when unique_violation or check_violation then
    insert into public.profiles (id) values (new.id);
  end;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Server-only: add (or remove) credits once per ref. Returns the new balance, or null if the
-- ref was already used.
create function public.grant_credits(p_user uuid, p_delta bigint, p_reason text, p_ref text default null)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  bal bigint;
begin
  insert into public.credit_ledger (user_id, delta, reason, ref)
  values (p_user, p_delta, p_reason, p_ref)
  on conflict (ref) do nothing;
  if not found then
    return null;
  end if;
  update public.profiles set credits = greatest(credits + p_delta, 0) where id = p_user returning credits into bal;
  return bal;
end $$;

revoke execute on function public.grant_credits(uuid, bigint, text, text) from public, anon, authenticated;

-- Called by the app while talking once the free meter is empty. Max one hour per call.
create function public.spend_credits(p_amount bigint) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  bal bigint;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount > 9000 then
    raise exception 'invalid amount';
  end if;
  update public.profiles set credits = greatest(credits - p_amount, 0)
  where id = auth.uid() returning credits into bal;
  return bal;
end $$;

create function public.username_available(p_name text) returns boolean
language sql security definer set search_path = '' stable as $$
  select not exists (select 1 from public.profiles where lower(username) = lower(trim(p_name)));
$$;

create function public.set_username(p_name text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  update public.profiles set username = nullif(trim(p_name), '') where id = auth.uid();
end $$;

-- December 23 offer. Anyone whose current subscription started before the cutoff and is paid up
-- (status active, so free-trial-only accounts don't qualify until their first payment) can claim
-- once, on or after the cutoff: Pro 500,000,000 credits, Lite 100,000 credits.
create function public.dec23_cutoff() returns timestamptz
language sql stable as $$ select timestamptz '2026-12-23 00:00:00+00' $$;

create function public.claim_dec23_bonus() returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  p public.profiles;
  amount bigint;
begin
  if auth.uid() is null or now() < public.dec23_cutoff() then
    return 0;
  end if;
  select * into p from public.profiles where id = auth.uid() for update;
  if not found or p.dec23_bonus_claimed or p.plan_status <> 'active'
     or p.subscribed_at is null or p.subscribed_at >= public.dec23_cutoff() then
    return 0;
  end if;
  amount := case p.plan when 'pro' then 500000000 when 'lite' then 100000 else 0 end;
  if amount = 0 then
    return 0;
  end if;
  update public.profiles set dec23_bonus_claimed = true where id = p.id;
  perform public.grant_credits(p.id, amount, 'dec23_bonus', 'dec23:' || p.id);
  return amount;
end $$;

revoke execute on function public.spend_credits(bigint), public.set_username(text), public.claim_dec23_bonus() from public, anon;
grant execute on function public.spend_credits(bigint), public.set_username(text), public.claim_dec23_bonus() to authenticated;
grant execute on function public.username_available(text) to anon, authenticated;
