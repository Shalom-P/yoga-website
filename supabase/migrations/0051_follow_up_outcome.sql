-- 0051_follow_up_outcome.sql
--
-- "Not interested" for the follow-up log (0050).
--
-- Until now the only way to stop chasing someone was to keep writing notes
-- with no next date, and the auto-suggest brought them back a week later.
-- Each follow-up row now carries an outcome. The newest row per customer
-- decides, exactly like next_follow_up_on: outcome = 'not_interested' on the
-- newest row takes the customer off the "To follow up" list and out of the
-- lead stage filters, and puts them under "Not interested" on /admin/customers.
-- Writing a newer row with outcome = 'open' brings them back, so the log stays
-- append-only and nothing is ever edited or deleted.
--
-- A closed lead has no due date: the CHECK keeps the two columns from
-- disagreeing.
--
-- Additive, safe to apply before the code that reads it deploys. The page
-- selects the column, so the reads fail (and the page renders with an empty
-- history) between a deploy and this migration; apply it first.
alter table public.customer_follow_ups
  add column if not exists outcome text not null default 'open';

alter table public.customer_follow_ups
  drop constraint if exists customer_follow_ups_outcome_check;
alter table public.customer_follow_ups
  add constraint customer_follow_ups_outcome_check
  check (outcome in ('open', 'not_interested'));

alter table public.customer_follow_ups
  drop constraint if exists customer_follow_ups_closed_has_no_date;
alter table public.customer_follow_ups
  add constraint customer_follow_ups_closed_has_no_date
  check (outcome <> 'not_interested' or next_follow_up_on is null);

comment on column public.customer_follow_ups.outcome is
  'open | not_interested. The newest row per customer decides; not_interested hides the customer from follow-up lists until a newer open row (0051).';
