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
  ('landing.hero_subhead',    '"60-minute private session. Pick your teacher. Pick your time. We meet on Google Meet."'),
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

-- Plans (AUD)
insert into public.plans (slug, name, description, price_aud_cents, billing_interval, included_sessions_per_month, included_session_types, is_active, is_featured, sort_order) values
  ('starter',   'Starter',   'Unlimited group classes — the gentle on-ramp.',                4900,  'monthly', null, '{hatha,vinyasa,yin,restorative}',                            true, false, 1),
  ('unlimited', 'Unlimited', 'Unlimited group + 4 private 1:1 sessions per month.',          12900, 'monthly', null, '{hatha,vinyasa,yin,restorative,prenatal,therapy}',           true, true,  2),
  ('therapy',   'Therapy',   'Weekly 1:1 therapy yoga for pain relief and rehabilitation.',  19900, 'monthly', null, '{therapy,restorative,prenatal,hatha}',                       true, false, 3)
on conflict (slug) do nothing;

-- Plan features
do $$
declare
  starter_id   uuid := (select id from public.plans where slug='starter');
  unlimited_id uuid := (select id from public.plans where slug='unlimited');
  therapy_id   uuid := (select id from public.plans where slug='therapy');
begin
  insert into public.plan_features (plan_id, feature_text, is_included, sort_order) values
    (starter_id,   'Unlimited live group classes',           true, 1),
    (starter_id,   'All class types except therapy',         true, 2),
    (starter_id,   'Cancel anytime',                          true, 3),
    (starter_id,   '1:1 private sessions',                    false, 4),

    (unlimited_id, 'Everything in Starter',                   true, 1),
    (unlimited_id, '4 private 1:1 sessions / month',          true, 2),
    (unlimited_id, 'Personalised practice plan',              true, 3),
    (unlimited_id, 'Priority booking on popular slots',       true, 4),

    (therapy_id,   'Weekly 1:1 therapy yoga (~4/month)',      true, 1),
    (therapy_id,   'Unlimited group classes',                 true, 2),
    (therapy_id,   'Custom rehabilitation plan',              true, 3),
    (therapy_id,   'HSA/FSA-style invoicing for AU rebates',  true, 4)
  on conflict do nothing;
end $$;

-- Sample approved reviews (for landing testimonial wall)
insert into public.reviews (customer_id, teacher_id, rating, body, is_featured, is_approved, display_name_override, display_location)
select
  (select id from public.profiles limit 1), -- works once a customer exists; otherwise NULL via outer join
  (select id from public.teachers where slug='aarti-deshmukh'),
  5,
  'After three weeks with Aarti my chronic back pain is gone. The 1:1 attention made all the difference.',
  true, true, 'Sarah M.', 'Sydney, AU'
where exists (select 1 from public.profiles);
