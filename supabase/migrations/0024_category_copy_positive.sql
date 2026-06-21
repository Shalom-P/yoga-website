-- 0024_category_copy_positive.sql
-- Reframe class-category copy to LEAD with what the practice helps with and
-- drop the repetitive "not a cure / not a treatment / not a substitute /
-- never replacing it / alongside medical care" hedges that 0023 sprinkled
-- through description / long_description / who_for. The single disclaimer at
-- the bottom of /classes/[slug] ("Yoga supports your overall wellbeing ... it
-- is not a substitute for diagnosis, treatment, or medication.") now carries
-- that caveat once.
--
-- Health-claim line is unchanged: copy stays at wellbeing/support level
-- (support / help with / ease everyday tension / relaxation / sleep /
-- mobility) and NEVER implies the yoga cures/treats/reverses/controls/lowers
-- a disease or symptom. Rewrite was authored + vetted by an adversarial
-- UAE (DHA/MOH) + India (ASCI / Drugs & Magic Remedies Act) compliance pass.
-- (Notably "supports balance" was removed from Hormonal Health as an implied
-- "balances hormones" claim.)
--
-- Practice-SAFETY is intentionally preserved: helps_with and what_to_expect
-- are NOT touched (the what_to_expect bullets — no breath-holding, sugar
-- source nearby, doctor/midwife go-ahead, see-a-doctor for acute pain, etc. —
-- are safety guidance, not medical disclaimers).
--
-- Idempotent: only UPDATEs existing rows by slug; re-running re-applies the
-- same end state.

begin;

update public.class_categories set
  description = $c$Gentle movement and breathwork to support an active daily routine, steady energy, and everyday stress relief, shaped around how you feel.$c$,
  long_description = $c$These gentle one-on-one sessions blend easy movement, comfortable breathing, and relaxation to help you stay active and feel more at ease in your day. Sessions support a balanced routine, steadier energy, and calmer everyday stress. Each one is shaped around your comfort, fitness level, and how you feel that day.$c$,
  who_for = $c$Adults who want to support a healthy, active routine, keep moving gently, and ease everyday stress.$c$
where slug = 'diabetes';

update public.class_categories set
  description = $c$Slow, soothing movement and even, natural breathing to support relaxation and a calmer state of mind.$c$,
  long_description = $c$Slow, soothing one-on-one sessions use easy movement and gentle, natural breathing to support deep relaxation and a calmer state of mind. Your teacher keeps everything comfortable and unhurried, with no straining or forceful techniques at any point, so each session feels restful from start to finish.$c$,
  who_for = $c$Adults who want a calming, low-intensity practice for relaxation and everyday stress, with each session paced gently and adapted to feel comfortable for you.$c$
where slug = 'hypertension';

update public.class_categories set
  description = $c$Gentle, supportive sessions for pregnancy and the months after birth, tailored to your trimester or recovery stage to help you stay comfortable, mobile, and rested.$c$,
  long_description = $c$Gentle sessions designed for pregnancy and the postnatal period, practised once your doctor or midwife gives the go-ahead and tailored to your trimester or recovery stage. Each session helps you stay comfortable, move with easy mobility within a stable range, and find moments of rest, with nothing strenuous. Your teacher adapts the practice week to week as your body changes, so it always feels supportive and safe.$c$,
  who_for = $c$Expecting and new mothers, once cleared by their doctor or midwife, who want a gentle, supportive practice to feel comfortable and rested through pregnancy and recovery.$c$
where slug = 'prenatal';

update public.class_categories set
  description = $c$Soothing, restorative yoga and breathwork to help you rest deeply, sleep better, and feel steadier through different life stages.$c$,
  long_description = $c$Soothing, restorative one-on-one sessions use gentle movement, breathwork, and relaxation to help you feel rested, comfortable, and steady through different life stages. The focus is on rest and ease rather than intensity, so you can wind down and find a calmer, more settled state. Breathing stays gentle and natural with no breath-holding, and your teacher checks for pregnancy or any conditions so each session is adapted to feel safe and comfortable for you.$c$,
  who_for = $c$Anyone wanting a gentle, restorative practice to support rest, sleep, and a sense of steadiness through changing life stages.$c$
where slug = 'hormonal-health';

update public.class_categories set
  description = $c$Gentle stretching and posture work to help ease the everyday back, neck, and joint tension that builds up from sitting and daily life.$c$,
  long_description = $c$Gentle stretching, mobility, and posture work to help ease the everyday back, neck, and joint tension that builds up from sitting and daily life. Sessions move at your pace and stay within a comfortable, pain-free range, with your teacher adjusting each movement to suit your body so you can build easier, more comfortable everyday movement.$c$,
  who_for = $c$Adults with everyday stiffness or tension who want gentle, comfortable movement to feel looser and more at ease in daily life.$c$
where slug = 'pain-relief';

update public.class_categories set
  description = $c$Restful breath, gentle movement, and meditation to help you ease everyday stress, settle a busy mind, and rest more easily.$c$,
  long_description = $c$Restful one-on-one sessions blend gentle movement, breathwork, and meditation to help you ease everyday stress, settle a busy mind, and rest more easily. The pace is calm and the space is private, so you can fully unwind. Each session is shaped around how you're feeling that day, giving you simple, supportive practices for relaxation, focus, and a steadier sense of calm you can carry into daily life.$c$,
  who_for = $c$Anyone wanting a calm, supportive practice to ease everyday stress, quiet the mind, and rest better. Ideal if you'd like a private, unhurried space to slow down and build relaxing habits at your own pace.$c$
where slug = 'mental-health';

update public.class_categories set
  description = $c$Energising, sustainable flows scaled to your fitness level that help you build an active routine and healthy everyday habits you can keep up.$c$,
  long_description = $c$Energising, sustainable flows scaled to your fitness level help you build an active routine and healthy everyday habits. Sessions build gradually so movement stays enjoyable and something you can keep up, with intensity matched to your fitness and adjusted as needed. Your teacher challenges you comfortably without overdoing it, and we ease off whenever you need to.$c$,
  who_for = $c$Adults who want an enjoyable, sustainable flow practice to support an active, healthy routine.$c$
where slug = 'weight-loss';

update public.class_categories set
  description = $c$Slow, supportive yoga for older adults to help with everyday mobility, balance, and confidence — with chair options as needed.$c$,
  long_description = $c$Slow, supportive one-on-one yoga for older adults to help with everyday mobility, balance, and confidence in daily movement. Chair-supported and standing options keep everything safe and accessible. Your teacher works gently at your pace, moving slowly between positions, and adapts each session to suit you.$c$,
  who_for = $c$Older adults who want a safe, gentle, supportive practice for everyday movement and confidence.$c$
where slug = 'geriatric';

update public.class_categories set
  description = $c$Playful, age-appropriate yoga that helps children build focus, flexibility, and calm in a fun, friendly 1:1 setting.$c$,
  long_description = $c$Playful, age-appropriate one-on-one yoga that helps children build focus, flexibility, and calm in a fun, friendly setting. Sessions use games, stories, and simple poses so children stay engaged and enjoy themselves. Your teacher adapts the energy and activities to suit each child's age and mood, keeping everything gentle and body-safe.$c$,
  who_for = $c$Children who would enjoy a playful, friendly one-on-one setting to build focus, flexibility, and calm.$c$
where slug = 'kids-yoga';

commit;
