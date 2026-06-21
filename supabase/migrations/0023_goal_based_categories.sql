-- 0023_goal_based_categories.sql
-- Reframe class_categories from yoga STYLES to CONDITION / life-stage areas, and
-- enrich each with detail-page content (helps_with chips, long_description,
-- what_to_expect, who_for).
--
-- The public site previously listed categories by style (Hatha, Vinyasa, Yin,
-- Restorative, Prenatal, Therapy). This switches the taxonomy to what the
-- customer is working on -- diabetes, hypertension, prenatal, hormonal health,
-- pain relief, mental health, weight loss, geriatric, kids -- which converts
-- better because visitors search by need, not by asana lineage.
--
-- Copy note: ALL copy is intentionally health-claim-SAFE (support / complement /
-- alongside medical care -- never cure / treat / replace medication) for the UAE
-- (DHA/MOH) and India (Drugs & Magic Remedies Act / ASCI) markets. The
-- what_to_expect bullets also encode practice-safety guardrails (e.g. no
-- breath-holding for hypertension, no deep twists in pregnancy).
--
-- Safe + idempotent:
--   * Adds the four content columns if missing.
--   * Upserts the 9 categories by slug (prenatal / pain-relief / weight-loss
--     already exist and are rewritten in place; the rest are inserted).
--   * Every superseded slug is RETIRED (is_active = false), not deleted, so any
--     sessions.class_category_id pointing at them stays valid (FK is
--     `on delete set null`). The retire list covers both the original style slugs
--     and any intermediate goal slugs.
--   * Re-running re-applies the same end state.

begin;

alter table public.class_categories
  add column if not exists helps_with     text[] not null default '{}',
  add column if not exists long_description text,
  add column if not exists what_to_expect text[] not null default '{}',
  add column if not exists who_for         text;

insert into public.class_categories
  (slug, name, description, helps_with, long_description, what_to_expect, who_for, intensity, icon_name, props_needed, sort_order, is_active)
values
  ('diabetes', 'Diabetes', 'Gentle movement and breathwork to support circulation, healthy weight, and stress management — practised alongside your doctor''s care, never replacing it.', ARRAY['Healthy weight', 'Gentle activity', 'Steady energy', 'Stress management', 'Feeling more active'], 'These gentle one-on-one sessions blend easy movement, comfortable breathing, and relaxation to support an active, balanced daily routine. This is general wellbeing support, never a treatment for any medical condition, and your teacher works alongside your doctor''s care, not in place of it. Each session is shaped around your comfort, fitness level, and how you feel that day.', ARRAY['A short check-in on how you feel, including any signs of a low', 'Best practised after eating, not fasting or right after medication, with a quick sugar source nearby', 'Gentle, low-impact, foot-friendly movement at a pace that suits you', 'Simple, comfortable breathing and relaxation practices', 'A calm wind-down to leave you feeling steady'], 'Adults looking to support a healthy, active routine and manage stress alongside their regular medical care. This is not a treatment for diabetes or any medical condition.', 'gentle', 'droplet', ARRAY['mat', 'chair'], 1, true),
  ('hypertension', 'Hypertension', 'Slow, soothing movement and even, natural breathing to support relaxation — a complement to, not a substitute for, your medical care.', ARRAY['Relaxation', 'Calmer breathing', 'Better sleep', 'Lower tension', 'Stress management'], 'Slow, soothing one-on-one sessions use easy movement and gentle, natural breathing to support deep relaxation and a calmer state of mind. This is general relaxation and stress support, a complement to your medical care and not a substitute for it. Your teacher keeps everything comfortable and unhurried, with no straining or forceful techniques at any point.', ARRAY['A gentle, seated or standing warm-up at an easy pace', 'Soft, even breathing with no breath-holding or forcing', 'Slow movement that avoids strain or sudden effort', 'Head kept at or above heart level, avoiding full inversions', 'Guided relaxation and quiet meditation with plenty of rest'], 'Adults who want a calming, low-intensity practice for relaxation and stress, alongside their doctor''s guidance. This is not a treatment for high blood pressure or any medical condition.', 'gentle', 'gauge', ARRAY['mat', 'chair'], 2, true),
  ('prenatal', 'Prenatal & Postnatal', 'Safe, gentle sessions for pregnancy and the postnatal period, tailored to each trimester and cleared with your doctor before you begin.', ARRAY['Gentle mobility', 'Easing aches', 'Better sleep', 'Relaxation', 'Calmer breathing'], 'Gentle, supportive sessions designed for pregnancy and the months after birth, practised only after your doctor or midwife has cleared you, and tailored to your trimester or recovery stage. Practices focus on comfort, easy mobility within a stable range, and rest, avoiding anything strenuous. Your teacher adapts each session week to week and this is not antenatal medical care.', ARRAY['Confirmation your doctor or midwife has cleared you to practise', 'Wall, chair, or bolster support for balance and comfort', 'Gentle movement within a stable, comfortable range, not deepening stretch', 'No deep twists, deep backbends, strong abdominal or core work, lying flat on the belly or (after early pregnancy) flat on the back, or strong inversions', 'Calm, natural breathing without straining, finishing with restful relaxation'], 'Expecting and new mothers, cleared by their doctor or midwife, who want a gentle, supportive practice through pregnancy and recovery. This is not a substitute for antenatal care.', 'gentle', 'baby', ARRAY['mat', 'bolster'], 3, true),
  ('hormonal-health', 'Hormonal Health', 'Soothing, restorative yoga and breathwork that supports balance, sleep, and wellbeing through different life stages — alongside your medical guidance.', ARRAY['Restful practice', 'Better sleep', 'Daily energy', 'Relaxation', 'Wellbeing'], 'Soothing, restorative one-on-one sessions use gentle movement, breathwork, and relaxation to support your overall sense of wellbeing through different life stages. The focus is on rest, comfort, and steadiness rather than intensity. Breathing stays gentle and natural with no breath-holding, and your teacher checks for pregnancy or medical conditions to adapt the session and complement your own health professional''s care.', ARRAY['A relaxed check-in on your energy, rest, and anything to adapt for', 'Slow, restorative movement and supported postures', 'Gentle, comfortable breathing with no breath-holding or forcing', 'Guided relaxation to help settle the mind', 'A calm, unhurried close to the session'], 'Anyone seeking a gentle, restorative practice to support wellbeing and rest through changing life stages, alongside their own health professional''s care.', 'gentle', 'flower-2', ARRAY['mat'], 4, true),
  ('pain-relief', 'Pain Relief', 'Gentle stretching and posture work to help ease everyday back, neck, and joint tension — complementing your treatment.', ARRAY['Mobility', 'Posture', 'Less everyday tension', 'Flexibility', 'Relaxation'], 'Gentle stretching, mobility, and posture work to help ease the everyday back, neck, and joint tension that builds up from sitting and daily life. Sessions move at your pace and stay within a comfortable, pain-free range, complementing any treatment you''re already receiving. Your teacher adjusts each movement to suit your body, and this is general movement support, not medical treatment.', ARRAY['A check-in on areas of tension and your comfortable range', 'A note to check with your doctor first if pain is recent, severe, or comes with numbness or radiating pain', 'Gentle stretches and mobility work kept pain-free, never pushed into pain', 'Posture guidance, avoiding deep loaded spinal bends or twists for sensitive backs', 'Simple movements for daily life and a relaxing wind-down'], 'Adults with everyday stiffness or tension who want gentle movement alongside any treatment they''re receiving. This is not a treatment for any injury or condition.', 'gentle', 'bone', ARRAY['mat', 'blocks'], 5, true),
  ('mental-health', 'Mental Health', 'Restful breath, movement, and meditation to help you manage stress, settle the mind, and rest better — alongside professional support.', ARRAY['Stress management', 'A settled mind', 'Better sleep', 'Mood support', 'Focus'], 'Restful one-on-one sessions blend gentle movement, breathwork, and meditation to help you manage everyday stress, settle a busy mind, and rest more easily. The pace is calm and the space is private, so you can fully unwind. This is general relaxation and wellbeing support, a complement to and not a substitute for professional mental-health care.', ARRAY['A gentle check-in on how you''re feeling', 'Slow movement to release everyday tension', 'Calming, comfortable breathing practices', 'Guided meditation and quiet relaxation', 'A soft close to leave you feeling steadier'], 'Anyone wanting a calm, supportive practice to ease everyday stress, quiet the mind, and rest better. This is not a substitute for mental-health treatment or therapy.', 'gentle', 'brain', ARRAY['mat', 'cushion'], 6, true),
  ('weight-loss', 'Weight Loss', 'Energising, sustainable flows scaled to your fitness level that support an active routine and healthy habits as part of your lifestyle.', ARRAY['Active routine', 'Daily energy', 'Healthy habits', 'Strength', 'Stamina'], 'Energising, sustainable flows scaled to your fitness level to support an active routine and healthy everyday habits, alongside your own lifestyle choices. Sessions build gradually so movement stays enjoyable and something you can keep up, with intensity matched to your fitness and adjusted as needed. Your teacher challenges you comfortably without overdoing it, and we ease off whenever you need to.', ARRAY['A short screening, with a note to check with your doctor first if you''re inactive or have heart, blood-pressure, or joint concerns', 'A warm-up matched to your current fitness', 'Flowing, energising sequences at a sustainable pace', 'Gradual progression with modifications so every level feels achievable', 'We ease off if you feel dizzy, breathless, or any pain, finishing with a cool-down and stretch'], 'Adults who want an enjoyable, sustainable flow practice to support an active, healthy routine, rather than a guaranteed weight result.', 'moderate', 'flame', ARRAY['mat'], 7, true),
  ('geriatric', 'Geriatric Yoga', 'Slow, supportive yoga for older adults to help support everyday mobility, balance, and confidence — with chair options as needed.', ARRAY['Mobility', 'Balance', 'Steadiness', 'Flexibility', 'Relaxation'], 'Slow, supportive one-on-one yoga for older adults to help with everyday mobility, balance, and confidence in daily movement. Chair-supported and standing options keep everything safe and accessible. Your teacher works gently at your pace, moving slowly between positions, and adapts each session to suit you, complementing any care from your own health professional.', ARRAY['Seated, chair-supported, and standing options as needed', 'Standing balance work always within reach of a chair or wall', 'Gentle movement to support mobility and balance', 'We move slowly between positions to avoid dizziness, with steady breathing throughout', 'Plenty of time, clear guidance, and a relaxing close'], 'Older adults who want a safe, gentle, supportive practice for everyday movement and confidence.', 'gentle', 'accessibility', ARRAY['mat', 'chair'], 8, true),
  ('kids-yoga', 'Kids Yoga', 'Playful, age-appropriate yoga to help children build focus, flexibility, and calm in a fun, friendly 1:1 setting.', ARRAY['Focus', 'Flexibility', 'Calm', 'Confidence', 'Fun movement'], 'Playful, age-appropriate one-on-one yoga that helps children build focus, flexibility, and calm in a fun, friendly setting. Sessions use games, stories, and simple poses so children stay engaged and enjoy themselves. Your teacher adapts the energy and activities to suit each child''s age and mood, keeping everything gentle and body-safe.', ARRAY['A friendly warm-up with playful movement', 'Animal poses, games, and simple stretches', 'Playful, gentle breathing games with no forceful breath-holding', 'Age-appropriate poses that avoid neck-loading inversions', 'Encouragement and fun, never pressure, with a settling activity to finish'], 'Children who would enjoy a playful, friendly one-on-one setting to build focus, flexibility, and calm.', 'gentle', 'smile', ARRAY['mat'], 9, true)
on conflict (slug) do update set
  name             = excluded.name,
  description      = excluded.description,
  helps_with       = excluded.helps_with,
  long_description = excluded.long_description,
  what_to_expect   = excluded.what_to_expect,
  who_for          = excluded.who_for,
  intensity        = excluded.intensity,
  icon_name        = excluded.icon_name,
  props_needed     = excluded.props_needed,
  sort_order       = excluded.sort_order,
  is_active        = true;

-- Retire every superseded category (original styles + any intermediate goal
-- slugs). Kept, not deleted, for referential integrity.
update public.class_categories
  set is_active = false
  where slug in (
    'hatha', 'vinyasa', 'yin', 'restorative', 'therapy',
    'flexibility-strength', 'stress-relief', 'seniors'
  );

commit;
