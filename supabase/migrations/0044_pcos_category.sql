-- 0044_pcos_category.sql
--
-- Split PCOS out of "Hormonal Health" into its own class category.
--
-- The hormonal-health page serves cycle changes, perimenopause and menopause,
-- and could not name PCOS more than twice without losing those readers. PCOS
-- is the condition people actually search for, and peer providers rank on
-- dedicated /online-yoga-classes-for-pcos-pcod/ pages. The rich landing copy
-- lives in lib/data/condition-pages/pcos.json; this row is what makes
-- /classes/pcos resolve (the page 404s on a missing category) and what puts
-- the card in the /classes grid and the homepage practice section.
--
-- Copy follows the same claim-safe framing as 0024_category_copy_positive:
-- support for rest, calm and an active routine alongside medical care, never
-- a treatment, never a promised result.
--
-- Apply together with the deploy that removes the /classes/pcos redirect from
-- next.config.ts: before that deploy the card would link to a URL that bounces
-- to hormonal-health; after it, without this row, the page is a 404.

-- Make room after hormonal-health (sort_order 4) so the two sit together.
update public.class_categories
   set sort_order = sort_order + 1
 where sort_order >= 5;

insert into public.class_categories
  (slug, name, description, helps_with, long_description, what_to_expect, who_for, intensity, icon_name, props_needed, sort_order, is_active)
values
  (
    'pcos',
    'PCOS',
    'Gentle, restorative yoga and breathwork for people living with PCOS or PCOD, supporting rest, calm, and an active routine alongside your doctor''s care.',
    ARRAY['Active routine', 'Restful practice', 'Calmer days', 'Comfort through your cycle', 'Better sleep'],
    'Gentle one-on-one sessions of easy movement, breathwork, and rest for people living with PCOS or PCOD. The focus is on building an active routine you can keep, settling stress, and resting properly, with hip- and abdomen-friendly poses adapted to where you are in your cycle. This is general wellbeing support alongside your doctor''s care, never a treatment for PCOS or any medical condition, and never a promised weight result.',
    ARRAY['A relaxed check-in on your energy, your cycle, and anything to adapt for', 'A gentle warm-up and a slow, steady flow matched to your fitness', 'Hip- and abdomen-friendly poses, with props where they help', 'Gentle, comfortable breathing with no breath-holding or forcing', 'Guided relaxation and a calm, unhurried close'],
    'Anyone diagnosed with PCOS or PCOD, or told their cycles are irregular, who wants a gentle, consistent practice alongside their doctor''s plan. This is not a treatment for PCOS or any medical condition.',
    'gentle',
    'sparkles',
    ARRAY['mat', 'bolster', 'blocks'],
    5,
    true
  )
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
  is_active        = excluded.is_active;
