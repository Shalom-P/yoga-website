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
-- Condition / life-stage 1:1 categories (by need, not yoga style) -- see migrations 0023 + 0024.
-- Copy leads with what the practice helps with (support/help-with verbs only, never
-- cure/treat/lower a condition); the "not a substitute for medical care" caveat lives
-- once in the /classes/[slug] bottom disclaimer, not per field. Safety stays in what_to_expect.
insert into public.class_categories (slug, name, description, helps_with, long_description, what_to_expect, who_for, intensity, icon_name, props_needed, sort_order) values
  ('diabetes', 'Diabetes', 'Gentle movement and breathwork to support an active daily routine, steady energy, and everyday stress relief, shaped around how you feel.', ARRAY['Healthy weight', 'Gentle activity', 'Steady energy', 'Stress management', 'Feeling more active'], 'These gentle one-on-one sessions blend easy movement, comfortable breathing, and relaxation to help you stay active and feel more at ease in your day. Sessions support a balanced routine, steadier energy, and calmer everyday stress. Each one is shaped around your comfort, fitness level, and how you feel that day.', ARRAY['A short check-in on how you feel, including any signs of a low', 'Best practised after eating, not fasting or right after medication, with a quick sugar source nearby', 'Gentle, low-impact, foot-friendly movement at a pace that suits you', 'Simple, comfortable breathing and relaxation practices', 'A calm wind-down to leave you feeling steady'], 'Adults who want to support a healthy, active routine, keep moving gently, and ease everyday stress.', 'gentle', 'droplet', ARRAY['mat', 'chair'], 1),
  ('hypertension', 'Hypertension', 'Slow, soothing movement and even, natural breathing to support relaxation and a calmer state of mind.', ARRAY['Relaxation', 'Calmer breathing', 'Better sleep', 'Lower tension', 'Stress management'], 'Slow, soothing one-on-one sessions use easy movement and gentle, natural breathing to support deep relaxation and a calmer state of mind. Your teacher keeps everything comfortable and unhurried, with no straining or forceful techniques at any point, so each session feels restful from start to finish.', ARRAY['A gentle, seated or standing warm-up at an easy pace', 'Soft, even breathing with no breath-holding or forcing', 'Slow movement that avoids strain or sudden effort', 'Head kept at or above heart level, avoiding full inversions', 'Guided relaxation and quiet meditation with plenty of rest'], 'Adults who want a calming, low-intensity practice for relaxation and everyday stress, with each session paced gently and adapted to feel comfortable for you.', 'gentle', 'gauge', ARRAY['mat', 'chair'], 2),
  ('prenatal', 'Prenatal & Postnatal', 'Gentle, supportive sessions for pregnancy and the months after birth, tailored to your trimester or recovery stage to help you stay comfortable, mobile, and rested.', ARRAY['Gentle mobility', 'Easing aches', 'Better sleep', 'Relaxation', 'Calmer breathing'], 'Gentle sessions designed for pregnancy and the postnatal period, practised once your doctor or midwife gives the go-ahead and tailored to your trimester or recovery stage. Each session helps you stay comfortable, move with easy mobility within a stable range, and find moments of rest, with nothing strenuous. Your teacher adapts the practice week to week as your body changes, so it always feels supportive and safe.', ARRAY['Confirmation your doctor or midwife has cleared you to practise', 'Wall, chair, or bolster support for balance and comfort', 'Gentle movement within a stable, comfortable range, not deepening stretch', 'No deep twists, deep backbends, strong abdominal or core work, lying flat on the belly or (after early pregnancy) flat on the back, or strong inversions', 'Calm, natural breathing without straining, finishing with restful relaxation'], 'Expecting and new mothers, once cleared by their doctor or midwife, who want a gentle, supportive practice to feel comfortable and rested through pregnancy and recovery.', 'gentle', 'baby', ARRAY['mat', 'bolster'], 3),
  ('hormonal-health', 'Hormonal Health', 'Soothing, restorative yoga and breathwork to help you rest deeply, sleep better, and feel steadier through different life stages.', ARRAY['Restful practice', 'Better sleep', 'Daily energy', 'Relaxation', 'Wellbeing'], 'Soothing, restorative one-on-one sessions use gentle movement, breathwork, and relaxation to help you feel rested, comfortable, and steady through different life stages. The focus is on rest and ease rather than intensity, so you can wind down and find a calmer, more settled state. Breathing stays gentle and natural with no breath-holding, and your teacher checks for pregnancy or any conditions so each session is adapted to feel safe and comfortable for you.', ARRAY['A relaxed check-in on your energy, rest, and anything to adapt for', 'Slow, restorative movement and supported postures', 'Gentle, comfortable breathing with no breath-holding or forcing', 'Guided relaxation to help settle the mind', 'A calm, unhurried close to the session'], 'Anyone wanting a gentle, restorative practice to support rest, sleep, and a sense of steadiness through changing life stages.', 'gentle', 'flower-2', ARRAY['mat'], 4),
  ('pain-relief', 'Pain Relief', 'Gentle stretching and posture work to help ease the everyday back, neck, and joint tension that builds up from sitting and daily life.', ARRAY['Mobility', 'Posture', 'Less everyday tension', 'Flexibility', 'Relaxation'], 'Gentle stretching, mobility, and posture work to help ease the everyday back, neck, and joint tension that builds up from sitting and daily life. Sessions move at your pace and stay within a comfortable, pain-free range, with your teacher adjusting each movement to suit your body so you can build easier, more comfortable everyday movement.', ARRAY['A check-in on areas of tension and your comfortable range', 'A note to check with your doctor first if pain is recent, severe, or comes with numbness or radiating pain', 'Gentle stretches and mobility work kept pain-free, never pushed into pain', 'Posture guidance, avoiding deep loaded spinal bends or twists for sensitive backs', 'Simple movements for daily life and a relaxing wind-down'], 'Adults with everyday stiffness or tension who want gentle, comfortable movement to feel looser and more at ease in daily life.', 'gentle', 'bone', ARRAY['mat', 'blocks'], 5),
  ('mental-health', 'Mental Health', 'Restful breath, gentle movement, and meditation to help you ease everyday stress, settle a busy mind, and rest more easily.', ARRAY['Stress management', 'A settled mind', 'Better sleep', 'Mood support', 'Focus'], 'Restful one-on-one sessions blend gentle movement, breathwork, and meditation to help you ease everyday stress, settle a busy mind, and rest more easily. The pace is calm and the space is private, so you can fully unwind. Each session is shaped around how you''re feeling that day, giving you simple, supportive practices for relaxation, focus, and a steadier sense of calm you can carry into daily life.', ARRAY['A gentle check-in on how you''re feeling', 'Slow movement to release everyday tension', 'Calming, comfortable breathing practices', 'Guided meditation and quiet relaxation', 'A soft close to leave you feeling steadier'], 'Anyone wanting a calm, supportive practice to ease everyday stress, quiet the mind, and rest better. Ideal if you''d like a private, unhurried space to slow down and build relaxing habits at your own pace.', 'gentle', 'brain', ARRAY['mat', 'cushion'], 6),
  ('weight-loss', 'Weight Loss', 'Energising, sustainable flows scaled to your fitness level that help you build an active routine and healthy everyday habits you can keep up.', ARRAY['Active routine', 'Daily energy', 'Healthy habits', 'Strength', 'Stamina'], 'Energising, sustainable flows scaled to your fitness level help you build an active routine and healthy everyday habits. Sessions build gradually so movement stays enjoyable and something you can keep up, with intensity matched to your fitness and adjusted as needed. Your teacher challenges you comfortably without overdoing it, and we ease off whenever you need to.', ARRAY['A short screening, with a note to check with your doctor first if you''re inactive or have heart, blood-pressure, or joint concerns', 'A warm-up matched to your current fitness', 'Flowing, energising sequences at a sustainable pace', 'Gradual progression with modifications so every level feels achievable', 'We ease off if you feel dizzy, breathless, or any pain, finishing with a cool-down and stretch'], 'Adults who want an enjoyable, sustainable flow practice to support an active, healthy routine.', 'moderate', 'flame', ARRAY['mat'], 7),
  ('geriatric', 'Geriatric Yoga', 'Slow, supportive yoga for older adults to help with everyday mobility, balance, and confidence — with chair options as needed.', ARRAY['Mobility', 'Balance', 'Steadiness', 'Flexibility', 'Relaxation'], 'Slow, supportive one-on-one yoga for older adults to help with everyday mobility, balance, and confidence in daily movement. Chair-supported and standing options keep everything safe and accessible. Your teacher works gently at your pace, moving slowly between positions, and adapts each session to suit you.', ARRAY['Seated, chair-supported, and standing options as needed', 'Standing balance work always within reach of a chair or wall', 'Gentle movement to support mobility and balance', 'We move slowly between positions to avoid dizziness, with steady breathing throughout', 'Plenty of time, clear guidance, and a relaxing close'], 'Older adults who want a safe, gentle, supportive practice for everyday movement and confidence.', 'gentle', 'accessibility', ARRAY['mat', 'chair'], 8),
  ('kids-yoga', 'Kids Yoga', 'Playful, age-appropriate yoga that helps children build focus, flexibility, and calm in a fun, friendly 1:1 setting.', ARRAY['Focus', 'Flexibility', 'Calm', 'Confidence', 'Fun movement'], 'Playful, age-appropriate one-on-one yoga that helps children build focus, flexibility, and calm in a fun, friendly setting. Sessions use games, stories, and simple poses so children stay engaged and enjoy themselves. Your teacher adapts the energy and activities to suit each child''s age and mood, keeping everything gentle and body-safe.', ARRAY['A friendly warm-up with playful movement', 'Animal poses, games, and simple stretches', 'Playful, gentle breathing games with no forceful breath-holding', 'Age-appropriate poses that avoid neck-loading inversions', 'Encouragement and fun, never pressure, with a settling activity to finish'], 'Children who would enjoy a playful, friendly one-on-one setting to build focus, flexibility, and calm.', 'gentle', 'smile', ARRAY['mat'], 9)
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
