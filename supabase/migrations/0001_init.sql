-- Xing Fu Cha spin wheel — initial schema
-- Run this whole file once in the Supabase SQL editor (or `supabase db push`).
-- All application access goes through the Next.js server using the service-role
-- key, so RLS is enabled everywhere with NO policies: the anon/authenticated
-- roles get zero direct access even if a key ever leaks, while the service
-- role (used only server-side) always bypasses RLS regardless.

create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────────────────────────────────
-- Helper: local-midnight (Asia/Ho_Chi_Minh) boundary, reused by fn_spin,
-- fn_redeem_voucher and the admin analytics queries so "today/this week/
-- this month" always means Vietnam wall-clock time regardless of where the
-- Postgres server itself is hosted.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function vn_day_start(ts timestamptz default now())
returns timestamptz
language sql
stable
as $$
  select date_trunc('day', ts at time zone 'Asia/Ho_Chi_Minh') at time zone 'Asia/Ho_Chi_Minh'
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists stores (
  code text primary key,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists prizes (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  code text,
  weight numeric not null default 0 check (weight >= 0),
  daily_limit int check (daily_limit is null or daily_limit >= 0),
  total_limit int check (total_limit is null or total_limit >= 0),
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists wheel_faces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  image_path text not null,
  slice_count int not null default 0,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists wheel_slices (
  id uuid primary key default gen_random_uuid(),
  wheel_face_id uuid not null references wheel_faces(id) on delete cascade,
  slot_index int not null,
  start_angle numeric not null check (start_angle >= 0 and start_angle < 360),
  end_angle numeric not null check (end_angle > 0 and end_angle <= 360),
  prize_id uuid references prizes(id) on delete set null,
  unique (wheel_face_id, slot_index)
);

create table if not exists campaign_settings (
  id smallint primary key default 1 check (id = 1),
  active_wheel_face_id uuid references wheel_faces(id) on delete set null,
  starts_at timestamptz,
  ends_at timestamptz,
  max_spins_per_customer_per_day int not null default 3 check (max_spins_per_customer_per_day > 0),
  wallet_enabled boolean not null default true,
  voucher_usable_from timestamptz,
  voucher_expires_at timestamptz,
  voucher_activation_delay_minutes int check (voucher_activation_delay_minutes is null or voucher_activation_delay_minutes >= 0),
  voucher_validity_days int check (voucher_validity_days is null or voucher_validity_days > 0),
  max_voucher_uses_per_day int not null default 3 check (max_voucher_uses_per_day > 0),
  updated_at timestamptz not null default now()
);

create table if not exists spins (
  id uuid primary key default gen_random_uuid(),
  store_code text not null references stores(code),
  customer_name text not null,
  customer_phone text not null,
  prize_id uuid not null references prizes(id),
  wheel_face_id uuid references wheel_faces(id),
  slot_index int,
  status text not null default 'used' check (status in ('used', 'unused')),
  voucher_usable_from timestamptz,
  voucher_expires_at timestamptz,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_spins_phone on spins (customer_phone);
create index if not exists idx_spins_created_at on spins (created_at);
create index if not exists idx_spins_store on spins (store_code);
create index if not exists idx_spins_prize on spins (prize_id);
create index if not exists idx_wheel_slices_face on wheel_slices (wheel_face_id);
create index if not exists idx_prizes_active on prizes (is_active);

alter table stores enable row level security;
alter table prizes enable row level security;
alter table wheel_faces enable row level security;
alter table wheel_slices enable row level security;
alter table campaign_settings enable row level security;
alter table spins enable row level security;

-- ─────────────────────────────────────────────────────────────────────────
-- fn_spin: the single, race-safe entry point for "customer spins the wheel".
-- Locks all active prize rows for the duration of the transaction so
-- concurrent spins (across all 11 stores) can never oversell a
-- daily/total-limited prize. At this traffic scale (thousands/day, not
-- per-second) fully serializing the decision step is simple and correct;
-- it does not serialize the (fast) insert-only tail of unrelated work.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function fn_spin(p_store_code text, p_name text, p_phone text)
returns jsonb
language plpgsql
as $$
declare
  v_settings campaign_settings%rowtype;
  v_store stores%rowtype;
  v_day_start timestamptz;
  v_day_end timestamptz;
  v_today_count int;
  v_total_weight numeric;
  v_roll numeric;
  v_cumulative numeric := 0;
  v_prize record;
  v_chosen record;
  v_wheel_face wheel_faces%rowtype;
  v_slice wheel_slices%rowtype;
  v_status text;
  v_usable_from timestamptz;
  v_expires_at timestamptz;
  v_used_at timestamptz;
  v_spin spins%rowtype;
begin
  if p_name is null or btrim(p_name) = '' then
    raise exception 'invalid_name' using errcode = 'P0001';
  end if;
  if p_phone is null or btrim(regexp_replace(p_phone, '\D', '', 'g')) = '' then
    raise exception 'invalid_phone' using errcode = 'P0001';
  end if;

  select * into v_store from stores where code = p_store_code and active for update;
  if not found then
    raise exception 'unknown_store' using errcode = 'P0001';
  end if;

  select * into v_settings from campaign_settings where id = 1 for update;
  if not found then
    raise exception 'campaign_not_configured' using errcode = 'P0001';
  end if;
  if v_settings.starts_at is not null and now() < v_settings.starts_at then
    raise exception 'campaign_not_started' using errcode = 'P0001';
  end if;
  if v_settings.ends_at is not null and now() > v_settings.ends_at then
    raise exception 'campaign_ended' using errcode = 'P0001';
  end if;

  v_day_start := vn_day_start(now());
  v_day_end := v_day_start + interval '1 day';

  select count(*) into v_today_count
  from spins
  where regexp_replace(customer_phone, '\D', '', 'g') = regexp_replace(p_phone, '\D', '', 'g')
    and created_at >= v_day_start and created_at < v_day_end;

  if v_today_count >= v_settings.max_spins_per_customer_per_day then
    raise exception 'daily_limit_reached' using errcode = 'P0001';
  end if;

  -- Lock every active prize row up front so no concurrent fn_spin call can
  -- read a stale remaining-quota count for the same prize.
  perform 1 from prizes where is_active for update;

  v_total_weight := 0;
  for v_prize in
    select p.id, p.label, p.code, p.weight
    from prizes p
    where p.is_active and p.weight > 0
      and (p.total_limit is null or (select count(*) from spins s where s.prize_id = p.id) < p.total_limit)
      and (p.daily_limit is null or (
        select count(*) from spins s
        where s.prize_id = p.id and s.created_at >= v_day_start and s.created_at < v_day_end
      ) < p.daily_limit)
  loop
    v_total_weight := v_total_weight + v_prize.weight;
  end loop;

  if v_total_weight <= 0 then
    raise exception 'no_prizes_available' using errcode = 'P0001';
  end if;

  v_roll := random() * v_total_weight;
  for v_prize in
    select p.id, p.label, p.code, p.weight
    from prizes p
    where p.is_active and p.weight > 0
      and (p.total_limit is null or (select count(*) from spins s where s.prize_id = p.id) < p.total_limit)
      and (p.daily_limit is null or (
        select count(*) from spins s
        where s.prize_id = p.id and s.created_at >= v_day_start and s.created_at < v_day_end
      ) < p.daily_limit)
    order by p.sort_order, p.id
  loop
    v_cumulative := v_cumulative + v_prize.weight;
    if v_roll < v_cumulative then
      v_chosen := v_prize;
      exit;
    end if;
  end loop;

  if v_chosen.id is null then
    raise exception 'no_prizes_available' using errcode = 'P0001';
  end if;

  select * into v_wheel_face from wheel_faces where id = v_settings.active_wheel_face_id and is_active;
  if not found then
    raise exception 'no_active_wheel' using errcode = 'P0001';
  end if;

  select * into v_slice
  from wheel_slices
  where wheel_face_id = v_wheel_face.id and prize_id = v_chosen.id
  order by random()
  limit 1;

  if not found then
    raise exception 'prize_not_mapped_to_wheel' using errcode = 'P0001';
  end if;

  if v_settings.wallet_enabled then
    v_status := 'unused';
    if v_settings.voucher_usable_from is not null or v_settings.voucher_expires_at is not null then
      v_usable_from := v_settings.voucher_usable_from;
      v_expires_at := v_settings.voucher_expires_at;
    else
      v_usable_from := now() + make_interval(mins => coalesce(v_settings.voucher_activation_delay_minutes, 0));
      v_expires_at := now() + make_interval(days => coalesce(v_settings.voucher_validity_days, 30));
    end if;
    v_used_at := null;
  else
    v_status := 'used';
    v_usable_from := null;
    v_expires_at := null;
    v_used_at := now();
  end if;

  insert into spins (
    store_code, customer_name, customer_phone, prize_id, wheel_face_id, slot_index,
    status, voucher_usable_from, voucher_expires_at, used_at
  ) values (
    p_store_code, btrim(p_name), btrim(p_phone), v_chosen.id, v_wheel_face.id, v_slice.slot_index,
    v_status, v_usable_from, v_expires_at, v_used_at
  ) returning * into v_spin;

  return jsonb_build_object(
    'spinId', v_spin.id,
    'prize', jsonb_build_object('id', v_chosen.id, 'label', v_chosen.label, 'code', v_chosen.code),
    'wheelFace', jsonb_build_object('id', v_wheel_face.id, 'imagePath', v_wheel_face.image_path),
    'slice', jsonb_build_object('slotIndex', v_slice.slot_index, 'startAngle', v_slice.start_angle, 'endAngle', v_slice.end_angle),
    'wallet', jsonb_build_object(
      'enabled', v_settings.wallet_enabled,
      'status', v_status,
      'usableFrom', v_usable_from,
      'expiresAt', v_expires_at
    )
  );
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- fn_redeem_voucher: customer-facing "use this voucher now" action.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function fn_redeem_voucher(p_spin_id uuid, p_phone text)
returns jsonb
language plpgsql
as $$
declare
  v_spin spins%rowtype;
  v_settings campaign_settings%rowtype;
  v_day_start timestamptz;
  v_day_end timestamptz;
  v_used_today int;
begin
  select * into v_spin from spins where id = p_spin_id for update;
  if not found or regexp_replace(v_spin.customer_phone, '\D', '', 'g') <> regexp_replace(p_phone, '\D', '', 'g') then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  if v_spin.status = 'used' then
    raise exception 'already_used' using errcode = 'P0001';
  end if;

  if v_spin.voucher_usable_from is not null and now() < v_spin.voucher_usable_from then
    raise exception 'not_usable_yet' using errcode = 'P0001';
  end if;

  if v_spin.voucher_expires_at is not null and now() > v_spin.voucher_expires_at then
    raise exception 'expired' using errcode = 'P0001';
  end if;

  select * into v_settings from campaign_settings where id = 1;
  v_day_start := vn_day_start(now());
  v_day_end := v_day_start + interval '1 day';

  select count(*) into v_used_today
  from spins
  where regexp_replace(customer_phone, '\D', '', 'g') = regexp_replace(p_phone, '\D', '', 'g')
    and status = 'used'
    and used_at >= v_day_start and used_at < v_day_end;

  if v_used_today >= coalesce(v_settings.max_voucher_uses_per_day, 3) then
    raise exception 'daily_usage_limit_reached' using errcode = 'P0001';
  end if;

  update spins set status = 'used', used_at = now() where id = p_spin_id returning * into v_spin;

  return jsonb_build_object(
    'spinId', v_spin.id,
    'status', v_spin.status,
    'usedAt', v_spin.used_at
  );
end;
$$;

-- Defense in depth: only the server-side service-role key may call these
-- (the app never exposes the anon key to a flow that needs them).
revoke execute on function fn_spin(text, text, text) from public;
revoke execute on function fn_redeem_voucher(uuid, text) from public;
grant execute on function fn_spin(text, text, text) to service_role;
grant execute on function fn_redeem_voucher(uuid, text) to service_role;
