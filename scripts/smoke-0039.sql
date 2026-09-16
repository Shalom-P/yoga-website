-- smoke-0039.sql
-- Transactional, ALWAYS-ROLLED-BACK exercise of the credit-critical paths added
-- by supabase/migrations/0039_admin_overrides_and_manual_payments.sql.
--
-- Why a SQL script and not a vitest file: the repo's test setup is node-env and
-- deliberately limited to pure, dependency-free helpers (CLAUDE.md, "Test
-- convention"). There is no DB or RPC harness and adding one is out of scope, so
-- the RPCs are exercised where they live. Nothing here is a substitute for
-- applying the migration; it is how you find out the migration did what it says.
--
-- It creates its own fixtures (auth.users -> profiles via the 0001 trigger, one
-- teacher, two sessions) and ends in ROLLBACK, so it is safe on any database
-- that is not mid-deploy. Run it as the Supabase SQL editor / postgres role:
-- it writes auth.users and calls service-role-only functions.
--
-- Run:  psql "$SUPABASE_DB_URL" -f scripts/smoke-0039.sql
-- Pass: the final NOTICE reads "smoke-0039 OK". Any assertion raises and the
--       transaction aborts, which is also a rollback.
--
-- Assertion 4 is the one that matters most. It is the second refund after a
-- re-enrol, and it is what the old TOTAL unique on (session_id, customer_id)
-- made impossible: any design that resurrects the cancelled booking row instead
-- of creating a new one silently eats the customer's paid session there.

begin;

do $$
declare
  v_admin   uuid := gen_random_uuid();
  v_c1      uuid := gen_random_uuid();
  v_c2      uuid := gen_random_uuid();
  v_c3      uuid := gen_random_uuid();
  v_teacher uuid;
  v_s1      uuid;   -- capacity 2, the class under test
  v_s2      uuid;   -- capacity 2, the move target
  v_b1      uuid;
  v_b2      uuid;
  v_b_c2    uuid;
  v_b_comp  uuid;
  v_bal     int;
  v_n       int;
  v_before  int;
  v_charged boolean;
  v_comped  boolean;
  v_refunded boolean;
  v_flag    boolean;
  v_caught  boolean;
  v_moved   uuid;
begin
  -- --- fixtures ------------------------------------------------------------
  -- profiles rows appear via the on_auth_user_created trigger (0001), so these
  -- are real accounts as far as every RLS helper and RPC is concerned.
  insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values
    ('00000000-0000-0000-0000-000000000000', v_admin, 'authenticated', 'authenticated', 'smoke0039-admin@example.test', '{}'::jsonb, jsonb_build_object('full_name', 'Smoke Admin'), now(), now()),
    ('00000000-0000-0000-0000-000000000000', v_c1,    'authenticated', 'authenticated', 'smoke0039-c1@example.test',    '{}'::jsonb, jsonb_build_object('full_name', 'Smoke One'),   now(), now()),
    ('00000000-0000-0000-0000-000000000000', v_c2,    'authenticated', 'authenticated', 'smoke0039-c2@example.test',    '{}'::jsonb, jsonb_build_object('full_name', 'Smoke Two'),   now(), now()),
    ('00000000-0000-0000-0000-000000000000', v_c3,    'authenticated', 'authenticated', 'smoke0039-c3@example.test',    '{}'::jsonb, jsonb_build_object('full_name', 'Smoke Three'), now(), now());

  update public.profiles set role = 'admin' where id = v_admin;
  if not public.is_admin(v_admin) then
    raise exception 'fixture: admin profile did not take the admin role';
  end if;

  insert into public.teachers (slug, display_name)
  values ('smoke-0039-teacher-' || substr(v_admin::text, 1, 8), 'Smoke Teacher')
  returning id into v_teacher;

  insert into public.sessions (teacher_id, start_at, end_at, capacity, status)
  values (v_teacher, now() + interval '3 days', now() + interval '3 days 1 hour', 2, 'scheduled')
  returning id into v_s1;

  insert into public.sessions (teacher_id, start_at, end_at, capacity, status)
  values (v_teacher, now() + interval '4 days', now() + interval '4 days 1 hour', 2, 'scheduled')
  returning id into v_s2;

  perform public.grant_session_credits(v_c1, 2, 'admin_adjust', null);
  perform public.grant_session_credits(v_c2, 2, 'admin_adjust', null);
  perform public.grant_session_credits(v_c3, 2, 'admin_adjust', null);

  -- --- 1. enrol spends exactly one credit ----------------------------------
  select booking_id, charged into v_b1, v_charged
    from public.admin_enrol_booking(v_s1, v_c1, false, true, v_admin, 'smoke enrol');
  if not v_charged then raise exception '1: enrol did not charge a credit'; end if;

  select balance into v_bal from public.customer_credits where customer_id = v_c1;
  if v_bal <> 1 then raise exception '1: balance is %, expected 1', v_bal; end if;

  select count(*) into v_n from public.credit_ledger
   where booking_id = v_b1 and reason = 'booking_spend';
  if v_n <> 1 then raise exception '1: booking_spend ledger rows = %, expected 1', v_n; end if;

  -- --- 2. cancel with refund returns it ------------------------------------
  select refunded into v_refunded
    from public.admin_cancel_booking(v_b1, true, v_admin, 'smoke cancel');
  if not v_refunded then raise exception '2: cancel did not refund'; end if;

  select balance into v_bal from public.customer_credits where customer_id = v_c1;
  if v_bal <> 2 then raise exception '2: balance is %, expected 2', v_bal; end if;

  select credit_refunded into v_flag from public.bookings where id = v_b1;
  if not v_flag then raise exception '2: bookings.credit_refunded was not set'; end if;

  select count(*) into v_n from public.credit_ledger
   where booking_id = v_b1 and reason = 'refund';
  if v_n <> 1 then raise exception '2: refund ledger rows = %, expected 1', v_n; end if;

  -- --- 3. the SAME customer can be re-added to the SAME class --------------
  -- Impossible before 0039: the total unique on (session_id, customer_id) made
  -- this a 23505.
  select booking_id into v_b2
    from public.admin_enrol_booking(v_s1, v_c1, false, true, v_admin, 'smoke re-enrol');
  if v_b2 is null then raise exception '3: re-enrol produced no booking'; end if;
  if v_b2 = v_b1 then raise exception '3: re-enrol resurrected the old booking row'; end if;

  select balance into v_bal from public.customer_credits where customer_id = v_c1;
  if v_bal <> 1 then raise exception '3: balance is %, expected 1', v_bal; end if;

  -- --- 4. THE ONE THAT MATTERS: the second refund still lands --------------
  select refunded into v_refunded
    from public.admin_cancel_booking(v_b2, true, v_admin, 'smoke cancel 2');
  if not v_refunded then raise exception '4: second cancel did not refund'; end if;

  select balance into v_bal from public.customer_credits where customer_id = v_c1;
  if v_bal <> 2 then
    raise exception '4: balance is %, expected 2. A paid session was destroyed.', v_bal;
  end if;

  -- --- 5. capacity is real, in the RPC and in the trigger ------------------
  perform * from public.admin_enrol_booking(v_s1, v_c1, false, true, v_admin, 'smoke fill 1');
  select booking_id into v_b_c2
    from public.admin_enrol_booking(v_s1, v_c2, false, true, v_admin, 'smoke fill 2');

  v_caught := false;
  begin
    perform * from public.admin_enrol_booking(v_s1, v_c3, false, true, v_admin, 'smoke overflow');
  exception when others then
    if sqlerrm <> 'session_full' then
      raise exception '5: expected session_full from the RPC, got %', sqlerrm;
    end if;
    v_caught := true;
  end;
  if not v_caught then raise exception '5: the RPC filled a capacity-2 class with 3 students'; end if;

  v_caught := false;
  begin
    insert into public.bookings (session_id, customer_id, status)
    values (v_s1, v_c3, 'confirmed');
  exception when others then
    if sqlerrm <> 'session_full' then
      raise exception '5: expected session_full from the trigger, got %', sqlerrm;
    end if;
    v_caught := true;
  end;
  if not v_caught then raise exception '5: a raw INSERT bypassed capacity'; end if;

  -- --- 6. a comped enrolment never touches the ledger, in either direction --
  select booking_id, comped into v_b_comp, v_comped
    from public.admin_enrol_booking(v_s2, v_c3, false, false, v_admin, 'smoke comp');
  if not v_comped then raise exception '6: p_charge_credit => false did not comp'; end if;

  select balance into v_bal from public.customer_credits where customer_id = v_c3;
  if v_bal <> 2 then raise exception '6: comped enrol moved the balance to %', v_bal; end if;

  select count(*) into v_n from public.credit_ledger where booking_id = v_b_comp;
  if v_n <> 0 then raise exception '6: comped enrol wrote % ledger rows', v_n; end if;

  select refunded into v_refunded
    from public.admin_cancel_booking(v_b_comp, true, v_admin, 'smoke comp cancel');
  if v_refunded then raise exception '6: cancelling a comped booking refunded a credit'; end if;

  select balance into v_bal from public.customer_credits where customer_id = v_c3;
  if v_bal <> 2 then raise exception '6: comped cancel moved the balance to %', v_bal; end if;

  -- --- 7. a move is credit-neutral and re-arms the reminders ---------------
  update public.bookings
     set reminded_at_24h = now(), reminded_at_1h = now()
   where id = v_b_c2;

  select count(*) into v_before from public.credit_ledger where customer_id = v_c2;

  select booking_id into v_moved
    from public.admin_move_booking(v_b_c2, v_s2, v_admin, 'smoke move');
  if v_moved <> v_b_c2 then raise exception '7: move returned a different booking'; end if;

  select count(*) into v_n from public.credit_ledger where customer_id = v_c2;
  if v_n <> v_before then
    raise exception '7: move wrote % ledger rows, expected 0', v_n - v_before;
  end if;

  select (session_id = v_s2
          and moved_from_session_id = v_s1
          and reminded_at_24h is null
          and reminded_at_1h is null)
    into v_flag
    from public.bookings where id = v_b_c2;
  if not v_flag then
    raise exception '7: moved booking did not land on the target with its reminders cleared';
  end if;

  -- --- 8. cancelling a whole class does NOT refund a consumed seat ----------
  -- admin_cancel_session's cursor takes every booking `where status <>
  -- 'cancelled'`, which includes 'attended' and 'no_show'. Both mean the seat
  -- WAS consumed, so refunding them mints a credit. Found in review; this pins
  -- the fix. v_b_c2 now sits on v_s2 after assertion 7, so use that class.
  perform public.admin_set_booking_attendance(v_b_c2, 'attended', null, v_admin, 'smoke attended');

  select balance into v_before from public.customer_credits where customer_id = v_c2;

  perform * from public.admin_cancel_session(v_s2, true, v_admin, 'smoke cancel class');

  select balance into v_bal from public.customer_credits where customer_id = v_c2;
  if v_bal <> v_before then
    raise exception
      '8: cancelling a class refunded an attended seat (balance % -> %). A consumed session was handed back.',
      v_before, v_bal;
  end if;

  raise notice 'smoke-0039 OK: all 8 assertions passed (rolling back)';
end $$;

rollback;
