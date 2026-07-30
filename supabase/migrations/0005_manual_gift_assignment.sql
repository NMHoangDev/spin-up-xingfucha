-- Admin can pin a guaranteed prize to a specific phone number ahead of time.
-- Whether that phone already has spin history or not, the next time it spins
-- fn_spin awards the pinned prize instead of the weighted random draw, then
-- marks the assignment fulfilled and links it to the resulting spin. Matching
-- is always done on digits-only phone (regexp_replace(..., '\D', '', 'g')),
-- same convention as every other phone comparison in this schema, so it
-- doesn't matter how the admin or the customer format the number.

create table if not exists assigned_gifts (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  prize_id uuid not null references prizes(id),
  status text not null default 'pending' check (status in ('pending', 'fulfilled', 'cancelled')),
  note text,
  existing_customer_name text,
  spin_id uuid references spins(id) on delete set null,
  created_at timestamptz not null default now(),
  fulfilled_at timestamptz
);

create index if not exists idx_assigned_gifts_phone on assigned_gifts (phone);
create index if not exists idx_assigned_gifts_status on assigned_gifts (status);

alter table assigned_gifts enable row level security;

-- ─────────────────────────────────────────────────────────────────────────
-- fn_assign_gift: admin action — pin a prize to a phone number. A phone can
-- only have one pending pin at a time; assigning again while one is still
-- pending replaces it rather than creating a duplicate. Also snapshots
-- whether this phone already has spin history (existing customer) at
-- assignment time, so the admin UI can show that back immediately.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function fn_assign_gift(p_phone text, p_prize_id uuid, p_note text default null)
returns jsonb
language plpgsql
as $$
declare
  v_phone_digits text;
  v_prize prizes%rowtype;
  v_existing assigned_gifts%rowtype;
  v_last_spin spins%rowtype;
  v_row assigned_gifts%rowtype;
begin
  v_phone_digits := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  if v_phone_digits = '' then
    raise exception 'invalid_phone' using errcode = 'P0001';
  end if;

  select * into v_prize from prizes where id = p_prize_id;
  if not found then
    raise exception 'unknown_prize' using errcode = 'P0001';
  end if;

  select * into v_last_spin
  from spins
  where regexp_replace(customer_phone, '\D', '', 'g') = v_phone_digits
  order by created_at desc
  limit 1;

  select * into v_existing
  from assigned_gifts
  where status = 'pending'
    and regexp_replace(phone, '\D', '', 'g') = v_phone_digits
  order by created_at asc
  limit 1
  for update;

  if found then
    update assigned_gifts
    set prize_id = p_prize_id,
        note = p_note,
        existing_customer_name = v_last_spin.customer_name,
        phone = btrim(p_phone)
    where id = v_existing.id
    returning * into v_row;
  else
    insert into assigned_gifts (phone, prize_id, note, existing_customer_name)
    values (btrim(p_phone), p_prize_id, p_note, v_last_spin.customer_name)
    returning * into v_row;
  end if;

  return jsonb_build_object(
    'id', v_row.id,
    'phone', v_row.phone,
    'prizeId', v_row.prize_id,
    'status', v_row.status,
    'note', v_row.note,
    'existingCustomerName', v_row.existing_customer_name,
    'isExistingCustomer', v_last_spin.id is not null,
    'createdAt', v_row.created_at
  );
end;
$$;

revoke execute on function fn_assign_gift(text, uuid, text) from public;
grant execute on function fn_assign_gift(text, uuid, text) to service_role;

-- ─────────────────────────────────────────────────────────────────────────
-- fn_spin: same signature as 0004 (no client change needed) — before the
-- weighted random draw, check for a pending manual assignment on this phone
-- and award that prize instead when one exists. Everything else (campaign
-- window, daily spin limit, invoice condition, wallet/voucher logic) still
-- applies as before — the pin only overrides which prize is chosen, not
-- whether the customer is allowed to spin.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function fn_spin(
  p_store_code text,
  p_name text,
  p_phone text,
  p_invoice_amount numeric default null
)
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
  v_assignment assigned_gifts%rowtype;
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

  if v_settings.min_invoice_amount is not null
     and (p_invoice_amount is null or p_invoice_amount < v_settings.min_invoice_amount) then
    raise exception 'invoice_amount_too_low' using errcode = 'P0001';
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

  -- Admin-pinned prize takes priority over the weighted random draw. Locks
  -- the row so a concurrent fn_spin call for the same phone can't award the
  -- same pin twice.
  select * into v_assignment
  from assigned_gifts
  where status = 'pending'
    and regexp_replace(phone, '\D', '', 'g') = regexp_replace(p_phone, '\D', '', 'g')
  order by created_at asc
  limit 1
  for update;

  if found then
    select p.id, p.label, p.code into v_chosen from prizes p where p.id = v_assignment.prize_id;
    if not found then
      raise exception 'assigned_prize_missing' using errcode = 'P0001';
    end if;
  else
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
    status, voucher_usable_from, voucher_expires_at, used_at, invoice_amount
  ) values (
    p_store_code, btrim(p_name), btrim(p_phone), v_chosen.id, v_wheel_face.id, v_slice.slot_index,
    v_status, v_usable_from, v_expires_at, v_used_at, p_invoice_amount
  ) returning * into v_spin;

  if v_assignment.id is not null then
    update assigned_gifts
    set status = 'fulfilled', fulfilled_at = now(), spin_id = v_spin.id
    where id = v_assignment.id;
  end if;

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
    ),
    'assigned', v_assignment.id is not null
  );
end;
$$;

revoke execute on function fn_spin(text, text, text, numeric) from public;
grant execute on function fn_spin(text, text, text, numeric) to service_role;
