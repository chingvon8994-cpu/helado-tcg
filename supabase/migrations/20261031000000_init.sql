-- ════════════════════════════════════════════════════════════════════════════
-- Helado Region TCG — initial schema
--
-- Security model
--   • Clients (anon/authenticated) may READ their own rows and may write ONLY:
--       decks (their own), profiles.avatar.
--   • Currency, collections, matches, rooms, rewards and stats are written exclusively by
--     the trusted API (Vercel function using the service-role key) through the
--     SECURITY DEFINER functions below, which are not executable by clients.
-- ════════════════════════════════════════════════════════════════════════════

create extension if not exists citext;

-- ── Profiles & progression ──────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username citext unique not null check (char_length(username) between 3 and 16 and username ~ '^[A-Za-z0-9_]+$'),
  avatar text not null default 'axolitl',
  xp integer not null default 0 check (xp >= 0),
  bootstrapped boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.wallets (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  scoops integer not null default 0 check (scoops >= 0),
  updated_at timestamptz not null default now()
);

create table public.player_stats (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  wins integer not null default 0,
  losses integer not null default 0,
  draws integer not null default 0,
  online_wins integer not null default 0,
  solo_wins integer not null default 0,
  expert_wins integer not null default 0,
  knockouts integer not null default 0,
  packs_opened integer not null default 0,
  updated_at timestamptz not null default now()
);

-- Every currency movement is recorded. (user_id, reason, ref) is unique so a reward can
-- never be granted twice for the same match/mission/day, even under concurrent requests.
create table public.scoop_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount integer not null,
  reason text not null,
  ref text not null,
  created_at timestamptz not null default now(),
  unique (user_id, reason, ref)
);
create index scoop_ledger_user_time on public.scoop_ledger (user_id, created_at desc);

-- ── Collection ──────────────────────────────────────────────────────────────
create table public.collection (
  user_id uuid not null references public.profiles (id) on delete cascade,
  card_id text not null,
  quantity integer not null check (quantity > 0),
  first_acquired_at timestamptz not null default now(),
  last_acquired_at timestamptz not null default now(),
  primary key (user_id, card_id)
);

create table public.pack_opens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  expansion_id text not null,
  cost integer not null,
  cards text[] not null,
  created_at timestamptz not null default now()
);
create index pack_opens_user_time on public.pack_opens (user_id, created_at desc);

create table public.card_acquisitions (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  card_id text not null,
  source text not null, -- 'pack' | 'starter' | 'reward'
  ref text,
  created_at timestamptz not null default now()
);
create index card_acq_user_time on public.card_acquisitions (user_id, created_at desc);

-- ── Decks (client-writable, validated server-side when a match starts) ─────
create table public.decks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 32),
  cards text[] not null default '{}' check (cardinality(cards) <= 60),
  essence text[] not null default '{}' check (cardinality(essence) <= 3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index decks_user on public.decks (user_id);

-- ── Missions, achievements, daily rewards ───────────────────────────────────
create table public.mission_progress (
  user_id uuid not null references public.profiles (id) on delete cascade,
  mission_id text not null,
  period_key text not null, -- e.g. '2026-10-31' or '2026-W44'
  progress integer not null default 0,
  claimed boolean not null default false,
  primary key (user_id, mission_id, period_key)
);

create table public.achievements (
  user_id uuid not null references public.profiles (id) on delete cascade,
  achievement_id text not null,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

-- ── Matches & rooms ─────────────────────────────────────────────────────────
create table public.matches (
  id uuid primary key default gen_random_uuid(),
  mode text not null check (mode in ('online', 'solo')),
  status text not null default 'active' check (status in ('active', 'finished', 'abandoned')),
  player0 uuid not null references public.profiles (id) on delete cascade,
  player1 uuid references public.profiles (id) on delete cascade, -- null when the opponent is the AI
  ai_difficulty text,
  state jsonb not null, -- full authoritative state incl. hidden zones and RNG; never exposed to clients
  version integer not null default 0,
  turn_deadline timestamptz,
  winner smallint,
  win_reason text,
  rewards_granted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz
);
create index matches_p0 on public.matches (player0, status);
create index matches_p1 on public.matches (player1, status);

-- Redacted per-player views. Realtime streams these rows; RLS ensures each player only
-- ever receives their own view.
create table public.match_views (
  match_id uuid not null references public.matches (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  seat smallint not null,
  view jsonb not null,
  events jsonb not null default '[]',
  version integer not null,
  status text not null,
  deadline timestamptz,
  updated_at timestamptz not null default now(),
  primary key (match_id, user_id)
);

create table public.match_results (
  id bigint generated always as identity primary key,
  match_id uuid not null references public.matches (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  mode text not null,
  opponent_name text not null,
  difficulty text,
  result text not null check (result in ('win', 'loss', 'draw')),
  reason text,
  turns integer not null,
  scoops integer not null default 0,
  xp integer not null default 0,
  created_at timestamptz not null default now(),
  unique (match_id, user_id)
);
create index match_results_user_time on public.match_results (user_id, created_at desc);

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  host uuid not null references public.profiles (id) on delete cascade,
  guest uuid references public.profiles (id) on delete cascade,
  host_deck uuid references public.decks (id) on delete set null,
  guest_deck uuid references public.decks (id) on delete set null,
  host_ready boolean not null default false,
  guest_ready boolean not null default false,
  host_name text not null,
  guest_name text,
  status text not null default 'open' check (status in ('open', 'started', 'closed')),
  match_id uuid references public.matches (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index rooms_host on public.rooms (host);
create index rooms_guest on public.rooms (guest);

-- ════════════════════════════════════════════════════════════════════════════
-- Row Level Security
-- ════════════════════════════════════════════════════════════════════════════
alter table public.profiles enable row level security;
alter table public.wallets enable row level security;
alter table public.player_stats enable row level security;
alter table public.scoop_ledger enable row level security;
alter table public.collection enable row level security;
alter table public.pack_opens enable row level security;
alter table public.card_acquisitions enable row level security;
alter table public.decks enable row level security;
alter table public.mission_progress enable row level security;
alter table public.achievements enable row level security;
alter table public.matches enable row level security;
alter table public.match_views enable row level security;
alter table public.match_results enable row level security;
alter table public.rooms enable row level security;

-- Public profile info (username/avatar/xp) is readable by any signed-in player (friends, opponents).
create policy "profiles readable" on public.profiles for select to authenticated using (true);
create policy "own avatar update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from authenticated, anon;
grant update (avatar) on public.profiles to authenticated;

create policy "own wallet" on public.wallets for select to authenticated using (user_id = auth.uid());
create policy "own stats" on public.player_stats for select to authenticated using (user_id = auth.uid());
create policy "own ledger" on public.scoop_ledger for select to authenticated using (user_id = auth.uid());
create policy "own collection" on public.collection for select to authenticated using (user_id = auth.uid());
create policy "own packs" on public.pack_opens for select to authenticated using (user_id = auth.uid());
create policy "own acquisitions" on public.card_acquisitions for select to authenticated using (user_id = auth.uid());
create policy "own missions" on public.mission_progress for select to authenticated using (user_id = auth.uid());
create policy "own achievements" on public.achievements for select to authenticated using (user_id = auth.uid());
create policy "own results" on public.match_results for select to authenticated using (user_id = auth.uid());
create policy "own match views" on public.match_views for select to authenticated using (user_id = auth.uid());
create policy "room members" on public.rooms for select to authenticated using (host = auth.uid() or guest = auth.uid());
-- matches: no client policies at all → full state (hidden cards, RNG) is unreadable by clients.

create policy "own decks read" on public.decks for select to authenticated using (user_id = auth.uid());
create policy "own decks insert" on public.decks for insert to authenticated with check (user_id = auth.uid());
create policy "own decks update" on public.decks for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own decks delete" on public.decks for delete to authenticated using (user_id = auth.uid());

-- Belt and braces: clients get no write privileges on server-owned tables.
revoke insert, update, delete on public.wallets, public.player_stats, public.scoop_ledger, public.collection,
  public.pack_opens, public.card_acquisitions, public.mission_progress, public.achievements, public.matches,
  public.match_views, public.match_results, public.rooms from anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- New-user trigger: profile, wallet and stats rows
-- ════════════════════════════════════════════════════════════════════════════
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  base text := regexp_replace(coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1), 'player'), '[^A-Za-z0-9_]', '', 'g');
  candidate text;
  n integer := 0;
begin
  if char_length(base) < 3 then base := 'player'; end if;
  base := left(base, 12);
  candidate := base;
  while exists (select 1 from public.profiles where username = candidate) loop
    n := n + 1;
    candidate := base || floor(random() * 9000 + 1000)::int;
    exit when n > 20;
  end loop;
  insert into public.profiles (id, username) values (new.id, candidate);
  insert into public.wallets (user_id, scoops) values (new.id, 0);
  insert into public.player_stats (user_id) values (new.id);
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ════════════════════════════════════════════════════════════════════════════
-- Trusted economy functions (service role only)
-- ════════════════════════════════════════════════════════════════════════════

-- Grants scoops once per (reason, ref). Returns true if granted, false if it already was.
create or replace function public.grant_scoops(p_user uuid, p_amount integer, p_reason text, p_ref text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if p_amount < 0 then raise exception 'negative grant'; end if;
  insert into scoop_ledger (user_id, amount, reason, ref) values (p_user, p_amount, p_reason, p_ref)
    on conflict (user_id, reason, ref) do nothing;
  if not found then return false; end if;
  update wallets set scoops = scoops + p_amount, updated_at = now() where user_id = p_user;
  return true;
end $$;

-- Adds cards to a collection and records acquisition history.
create or replace function public.add_cards(p_user uuid, p_cards text[], p_source text, p_ref text)
returns void language plpgsql security definer set search_path = public as $$
declare c text;
begin
  foreach c in array p_cards loop
    insert into collection (user_id, card_id, quantity) values (p_user, c, 1)
      on conflict (user_id, card_id) do update set quantity = collection.quantity + 1, last_acquired_at = now();
    insert into card_acquisitions (user_id, card_id, source, ref) values (p_user, c, p_source, p_ref);
  end loop;
end $$;

-- Atomically pays for a pack and adds its (server-rolled) cards. Fails without side effects
-- if the balance is insufficient.
create or replace function public.open_pack_tx(p_user uuid, p_expansion text, p_cost integer, p_cards text[])
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid := gen_random_uuid();
begin
  update wallets set scoops = scoops - p_cost, updated_at = now() where user_id = p_user and scoops >= p_cost;
  if not found then raise exception 'INSUFFICIENT_SCOOPS'; end if;
  insert into scoop_ledger (user_id, amount, reason, ref) values (p_user, -p_cost, 'pack', v_id::text);
  insert into pack_opens (id, user_id, expansion_id, cost, cards) values (v_id, p_user, p_expansion, p_cost, p_cards);
  perform add_cards(p_user, p_cards, 'pack', v_id::text);
  update player_stats set packs_opened = packs_opened + 1, updated_at = now() where user_id = p_user;
  return v_id;
end $$;

-- Records a finished match for one player exactly once and applies stats/xp/scoops.
create or replace function public.record_match_result(
  p_match uuid, p_user uuid, p_mode text, p_opponent text, p_difficulty text, p_result text, p_reason text,
  p_turns integer, p_scoops integer, p_xp integer, p_knockouts integer
) returns boolean language plpgsql security definer set search_path = public as $$
begin
  insert into match_results (match_id, user_id, mode, opponent_name, difficulty, result, reason, turns, scoops, xp)
    values (p_match, p_user, p_mode, p_opponent, p_difficulty, p_result, p_reason, p_turns, p_scoops, p_xp)
    on conflict (match_id, user_id) do nothing;
  if not found then return false; end if;
  update player_stats set
    wins = wins + (p_result = 'win')::int,
    losses = losses + (p_result = 'loss')::int,
    draws = draws + (p_result = 'draw')::int,
    online_wins = online_wins + (p_result = 'win' and p_mode = 'online')::int,
    solo_wins = solo_wins + (p_result = 'win' and p_mode = 'solo')::int,
    expert_wins = expert_wins + (p_result = 'win' and p_difficulty = 'expert')::int,
    knockouts = knockouts + p_knockouts,
    updated_at = now()
  where user_id = p_user;
  update profiles set xp = xp + p_xp where id = p_user;
  if p_scoops > 0 then perform grant_scoops(p_user, p_scoops, 'match', p_match::text); end if;
  return true;
end $$;

-- Mission progress increment (idempotency is handled by callers via match/pack refs).
create or replace function public.bump_mission(p_user uuid, p_mission text, p_period text, p_amount integer)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into mission_progress (user_id, mission_id, period_key, progress) values (p_user, p_mission, p_period, p_amount)
    on conflict (user_id, mission_id, period_key) do update set progress = mission_progress.progress + p_amount;
end $$;

create or replace function public.claim_mission(p_user uuid, p_mission text, p_period text, p_target integer, p_reward integer)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  update mission_progress set claimed = true
    where user_id = p_user and mission_id = p_mission and period_key = p_period and progress >= p_target and not claimed;
  if not found then return false; end if;
  perform grant_scoops(p_user, p_reward, 'mission', p_mission || ':' || p_period);
  return true;
end $$;

create or replace function public.unlock_achievement(p_user uuid, p_achievement text, p_reward integer)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  insert into achievements (user_id, achievement_id) values (p_user, p_achievement) on conflict do nothing;
  if not found then return false; end if;
  if p_reward > 0 then perform grant_scoops(p_user, p_reward, 'achievement', p_achievement); end if;
  return true;
end $$;

-- Optimistic-concurrency match update: succeeds only if the stored version matches.
create or replace function public.update_match_state(p_match uuid, p_expected integer, p_state jsonb, p_version integer,
  p_status text, p_deadline timestamptz, p_winner smallint, p_reason text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  update matches set state = p_state, version = p_version, status = p_status, turn_deadline = p_deadline,
    winner = p_winner, win_reason = p_reason, updated_at = now(),
    finished_at = case when p_status <> 'active' then now() else null end
  where id = p_match and version = p_expected;
  return found;
end $$;

create or replace function public.mark_rewards_granted(p_match uuid) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  update matches set rewards_granted = true where id = p_match and not rewards_granted and status <> 'active';
  return found;
end $$;

-- Lock all trusted functions down to the service role.
revoke all on function public.grant_scoops(uuid, integer, text, text) from public, anon, authenticated;
revoke all on function public.add_cards(uuid, text[], text, text) from public, anon, authenticated;
revoke all on function public.open_pack_tx(uuid, text, integer, text[]) from public, anon, authenticated;
revoke all on function public.record_match_result(uuid, uuid, text, text, text, text, text, integer, integer, integer, integer) from public, anon, authenticated;
revoke all on function public.bump_mission(uuid, text, text, integer) from public, anon, authenticated;
revoke all on function public.claim_mission(uuid, text, text, integer, integer) from public, anon, authenticated;
revoke all on function public.unlock_achievement(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.update_match_state(uuid, integer, jsonb, integer, text, timestamptz, smallint, text) from public, anon, authenticated;
revoke all on function public.mark_rewards_granted(uuid) from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.grant_scoops(uuid, integer, text, text) to service_role;
grant execute on function public.add_cards(uuid, text[], text, text) to service_role;
grant execute on function public.open_pack_tx(uuid, text, integer, text[]) to service_role;
grant execute on function public.record_match_result(uuid, uuid, text, text, text, text, text, integer, integer, integer, integer) to service_role;
grant execute on function public.bump_mission(uuid, text, text, integer) to service_role;
grant execute on function public.claim_mission(uuid, text, text, integer, integer) to service_role;
grant execute on function public.unlock_achievement(uuid, text, integer) to service_role;
grant execute on function public.update_match_state(uuid, integer, jsonb, integer, text, timestamptz, smallint, text) to service_role;
grant execute on function public.mark_rewards_granted(uuid) to service_role;

-- ════════════════════════════════════════════════════════════════════════════
-- Realtime: stream per-player match views and room changes (RLS-filtered).
-- ════════════════════════════════════════════════════════════════════════════
alter publication supabase_realtime add table public.match_views;
alter publication supabase_realtime add table public.rooms;
