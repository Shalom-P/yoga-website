-- seed.sql
-- Demo data so the marketing site renders without a real admin setup yet.
-- Run this against your local Supabase (or in the SQL editor) AFTER all migrations.

-- Admin settings (read by the landing page server-side)
insert into public.admin_settings (key, value) values
  ('brand.name',              '"MYYOGACLASSES"'),
  ('brand.tagline',           '"Find your free 1:1 yoga teacher — no credit card."'),
  ('brand.primary_color',     '"#5B7C5A"'),
  ('brand.accent_color',      '"#C66B4E"'),
  ('support.email',           '"hello@myyogaclasses.fit"'),
  ('landing.hero_headline',   '"Find your free 1:1 yoga teacher — no credit card."'),
  ('landing.hero_subhead',    '"A 60-minute private session, live on Google Meet — shown in your local time. Pick your teacher, pick your time."'),
  ('landing.trust_count',     '"1,200+ reviews"'),
  ('landing.trust_rating',    '"4.9"'),
  ('landing.final_headline',  '"Your first session is on us."')
on conflict (key) do nothing;

-- Class categories
insert into public.class_categories (slug, name, description, intensity, icon_name, sort_order) values
  ('hatha',       'Hatha',        'Slow, foundational asanas to build strength and steadiness.',                'gentle',   'leaf',         1),
  ('vinyasa',     'Vinyasa Flow', 'Breath-linked movement that warms the body and frees the mind.',             'moderate', 'wind',         2),
  ('yin',         'Yin',          'Long-held passive postures that release deep connective tissue.',            'gentle',   'moon',         3),
  ('restorative', 'Restorative',  'Supported postures designed to switch your nervous system to rest.',         'gentle',   'cloud',        4),
  ('prenatal',    'Prenatal',     'Pregnancy-safe sequences, taught by certified prenatal yoga teachers.',      'gentle',   'heart',        5),
  ('therapy',     'Pain Relief',  'One-on-one therapy yoga for back, neck, knees, and posture rehabilitation.', 'moderate', 'stethoscope',  6)
on conflict (slug) do nothing;

-- Demo teachers (Indian teachers, Asia/Kolkata)
insert into public.teachers (slug, display_name, headline, bio, avatar_url, specialties, languages, years_experience, rating_avg, rating_count, timezone, is_active, sort_order) values
  ('aarti-deshmukh', 'Aarti Deshmukh', 'Hatha & Therapy Yoga · 14 years',  'Aarti trained at the Kaivalyadhama Institute and specialises in pain-relief yoga for desk workers.', null, '{Hatha,"Pain Relief",Beginners}',  '{English,Hindi,Marathi}',  14, 4.95, 312, 'Asia/Kolkata', true, 1),
  ('rohan-patel',     'Rohan Patel',    'Vinyasa & Strength · 9 years',     'Rohan is a 500-hour Yoga Alliance teacher who blends strength training with breath-led flow.',         null, '{Vinyasa,Strength,Athletes}',     '{English,Hindi,Gujarati}', 9,  4.9,  187, 'Asia/Kolkata', true, 2),
  ('meera-iyer',      'Meera Iyer',     'Prenatal & Restorative · 11 years','Meera holds a postgraduate diploma in yoga therapy and supports women through pregnancy and recovery.', null, '{Prenatal,Restorative,"Pelvic floor"}','{English,Tamil,Hindi}', 11, 5.0,  254, 'Asia/Kolkata', true, 3),
  ('vikram-singh',    'Vikram Singh',   'Yin & Meditation · 7 years',       'Vikram leads slow, contemplative classes drawing on both Hatha and Insight meditation traditions.',     null, '{Yin,Meditation,"Stress relief"}', '{English,Hindi,Punjabi}',  7,  4.9,  142, 'Asia/Kolkata', true, 4),
  ('priya-nair',      'Priya Nair',     'Hatha & Seniors · 17 years',       'Priya specialises in gentle, joint-friendly sequences for students 50+ and post-injury recovery.',     null, '{Hatha,Seniors,Mobility}',         '{English,Malayalam,Hindi}', 17, 4.97, 421, 'Asia/Kolkata', true, 5),
  ('arjun-rao',       'Arjun Rao',      'Vinyasa & Backbends · 6 years',    'Arjun is an enthusiastic, playful teacher who loves teaching first-timers their first sun salutation.', null, '{Vinyasa,Beginners,Backbends}',    '{English,Telugu,Hindi}',    6,  4.85, 98,  'Asia/Kolkata', true, 6)
on conflict (slug) do nothing;

-- Teacher availability: each teacher offers ~6h/day Mon-Sat, 6am-12pm IST (overlaps AU evening/morning).
insert into public.teacher_availability (teacher_id, day_of_week, start_time, end_time, slot_duration_minutes)
select t.id, dow, '06:00'::time, '12:00'::time, 60
from public.teachers t cross join generate_series(1,6) as dow
on conflict do nothing;

-- Session-credit packs (one-time). A pack = per-currency prices + N session-credits;
-- buying it grants credits, a paid booking spends one. The free 1:1 trial never
-- touches credits. (See supabase/migrations/0011 + 0020 + 0022.)
-- price_base_cents is the currency-neutral fallback; per-currency amounts below.
insert into public.plans (slug, name, description, price_base_cents, billing_interval, session_credits, included_sessions_per_month, included_session_types, is_active, is_featured, sort_order) values
  ('pack-5',  '5-Session Pack',  'Five private 1:1 sessions — your flexible way in.',       1000000, 'one_time', 5,  null, '{}', true, false, 1),
  ('pack-10', '10-Session Pack', 'Ten private 1:1 sessions — our best price per session.', 1900000, 'one_time', 10, null, '{}', true, true,  2)
on conflict (slug) do nothing;

-- Per-currency prices (UAE → AED, India → INR). Converted from the prior AUD pack
-- prices (A$180 / A$340); admin-editable in /admin/plans. See migration 0022.
insert into public.plan_prices (plan_id, currency, amount_cents)
select p.id, v.currency, v.amount_cents
from public.plans p
join (values
  ('pack-5',  'INR', 1000000),
  ('pack-5',  'AED',   43500),
  ('pack-10', 'INR', 1900000),
  ('pack-10', 'AED',   82500)
) as v(slug, currency, amount_cents) on v.slug = p.slug
on conflict (plan_id, currency) do nothing;

-- Plan features (only true capabilities — credits never expire; cancel refunds the credit)
do $$
declare
  p5  uuid := (select id from public.plans where slug='pack-5');
  p10 uuid := (select id from public.plans where slug='pack-10');
begin
  insert into public.plan_features (plan_id, feature_text, is_included, sort_order) values
    (p5,  '5 private 1:1 sessions',          true, 1),
    (p5,  'Book any teacher, any style',     true, 2),
    (p5,  '60-min sessions on Google Meet',  true, 3),
    (p5,  'Credits never expire',            true, 4),
    (p5,  'Cancel before the session — credit refunded', true, 5),

    (p10, '10 private 1:1 sessions',         true, 1),
    (p10, 'Book any teacher, any style',     true, 2),
    (p10, 'Lowest price per session',        true, 3),
    (p10, 'Credits never expire',            true, 4),
    (p10, 'Cancel before the session — credit refunded', true, 5)
  on conflict do nothing;
end $$;

-- Sample approved reviews (for landing testimonial wall)
insert into public.reviews (customer_id, teacher_id, rating, body, is_featured, is_approved, display_name_override, display_location)
select
  (select id from public.profiles limit 1), -- works once a customer exists; otherwise NULL via outer join
  (select id from public.teachers where slug='aarti-deshmukh'),
  5,
  'After three weeks with Aarti my chronic back pain is gone. The 1:1 attention made all the difference.',
  true, true, 'Sara M.', 'Dubai, AE'
where exists (select 1 from public.profiles);
