-- Admin dashboard analytics aggregation — run after 0001_init.sql.
-- Aggregating in SQL (instead of pulling raw rows into Node) keeps this fast
-- and correct regardless of date-range size.

create or replace function fn_admin_analytics(
  p_from timestamptz,
  p_to timestamptz,
  p_store_codes text[] default null
)
returns jsonb
language plpgsql
stable
as $$
declare
  v_now timestamptz := now();
  v_today_start timestamptz := vn_day_start(v_now);
  v_week_start timestamptz;
  v_month_start timestamptz;
  result jsonb;
begin
  v_week_start := v_today_start -
    make_interval(days => (extract(isodow from (v_now at time zone 'Asia/Ho_Chi_Minh'))::int - 1));
  v_month_start := date_trunc('month', v_now at time zone 'Asia/Ho_Chi_Minh') at time zone 'Asia/Ho_Chi_Minh';

  select jsonb_build_object(
    'kpis', (
      select jsonb_build_object(
        'totalSpins', (
          select count(*) from spins
          where created_at >= p_from and created_at <= p_to
            and (p_store_codes is null or store_code = any(p_store_codes))
        ),
        'uniqueCustomers', (
          select count(distinct regexp_replace(customer_phone, '\D', '', 'g')) from spins
          where created_at >= p_from and created_at <= p_to
            and (p_store_codes is null or store_code = any(p_store_codes))
        ),
        -- Always "as of now", independent of the selected date range, so
        -- these read the same no matter what range the admin is browsing.
        'spinsToday', (
          select count(*) from spins
          where created_at >= v_today_start
            and (p_store_codes is null or store_code = any(p_store_codes))
        ),
        'spinsThisWeek', (
          select count(*) from spins
          where created_at >= v_week_start
            and (p_store_codes is null or store_code = any(p_store_codes))
        ),
        'spinsThisMonth', (
          select count(*) from spins
          where created_at >= v_month_start
            and (p_store_codes is null or store_code = any(p_store_codes))
        )
      )
    ),
    'byDay', (
      select coalesce(jsonb_agg(jsonb_build_object('date', day, 'count', cnt) order by day), '[]'::jsonb)
      from (
        select to_char(created_at at time zone 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD') as day, count(*) as cnt
        from spins
        where created_at >= p_from and created_at <= p_to
          and (p_store_codes is null or store_code = any(p_store_codes))
        group by 1
      ) t
    ),
    'byStore', (
      select coalesce(jsonb_agg(jsonb_build_object('storeCode', s.store_code, 'storeName', st.name, 'count', s.cnt) order by s.cnt desc), '[]'::jsonb)
      from (
        select store_code, count(*) as cnt
        from spins
        where created_at >= p_from and created_at <= p_to
          and (p_store_codes is null or store_code = any(p_store_codes))
        group by store_code
      ) s
      join stores st on st.code = s.store_code
    ),
    'byPrize', (
      select coalesce(jsonb_agg(jsonb_build_object('prizeId', pr.prize_id, 'label', p.label, 'count', pr.cnt) order by pr.cnt desc), '[]'::jsonb)
      from (
        select prize_id, count(*) as cnt
        from spins
        where created_at >= p_from and created_at <= p_to
          and (p_store_codes is null or store_code = any(p_store_codes))
        group by prize_id
      ) pr
      join prizes p on p.id = pr.prize_id
    )
  ) into result;

  return result;
end;
$$;

revoke execute on function fn_admin_analytics(timestamptz, timestamptz, text[]) from public;
grant execute on function fn_admin_analytics(timestamptz, timestamptz, text[]) to service_role;
