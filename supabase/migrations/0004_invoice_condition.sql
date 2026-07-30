-- Adds a "minimum invoice amount" spin condition (admin-configurable, on top
-- of the existing time-window condition) and records the invoice amount the
-- customer entered on every spin, so it shows up in reports/exports.

alter table campaign_settings
  add column if not exists min_invoice_amount numeric
    check (min_invoice_amount is null or min_invoice_amount >= 0);

alter table spins
  add column if not exists invoice_amount numeric;

-- Replace fn_spin with a 4-parameter version (invoice amount added at the
-- end so this is a clean drop-in). Drop the old 3-parameter signature first
-- so the two don't coexist as ambiguous overloads.
drop function if exists fn_spin(text, text, text);

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
    status, voucher_usable_from, voucher_expires_at, used_at, invoice_amount
  ) values (
    p_store_code, btrim(p_name), btrim(p_phone), v_chosen.id, v_wheel_face.id, v_slice.slot_index,
    v_status, v_usable_from, v_expires_at, v_used_at, p_invoice_amount
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

revoke execute on function fn_spin(text, text, text, numeric) from public;
grant execute on function fn_spin(text, text, text, numeric) to service_role;
