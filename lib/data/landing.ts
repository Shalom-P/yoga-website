// Server-side data layer for the marketing site.
// Reads from Supabase if NEXT_PUBLIC_SUPABASE_URL is configured.
// Otherwise returns realistic mock data so the site renders cleanly during local dev / preview deploys.

import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Teacher, Plan, PlanFeature, PlanPrice, ClassCategory, Review } from "@/lib/supabase/types";

/** A plan plus its features and per-currency prices (AED/INR), for pricing UIs. */
export type PlanWithFeatures = Plan & { features: PlanFeature[]; prices: PlanPrice[] };

const isSupabaseConfigured = !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// --------------------------------------------------------------------------
// Mock data (mirrors seed.sql so the site looks real before Supabase is wired up)
// --------------------------------------------------------------------------
const MOCK_TEACHERS: Teacher[] = [
  {
    id: "t1", profile_id: null, slug: "aarti-deshmukh",
    display_name: "Aarti Deshmukh",
    headline: "Hatha & Therapy Yoga · 14 years",
    bio: "Aarti trained at the Kaivalyadhama Institute and specialises in pain-relief yoga for desk workers.",
    avatar_url: null, cover_image_url: null, intro_video_url: null,
    specialties: ["Hatha", "Pain Relief", "Beginners"],
    languages: ["English", "Hindi", "Marathi"],
    years_experience: 14, certifications: [], rating_avg: 0, rating_count: 0,
    timezone: "Asia/Kolkata", google_calendar_id: null,
    is_active: true, sort_order: 1,
    created_at: "", updated_at: "",
  },
  {
    id: "t2", profile_id: null, slug: "rohan-patel",
    display_name: "Rohan Patel",
    headline: "Vinyasa & Strength · 9 years",
    bio: "Rohan is a 500-hour Yoga Alliance teacher who blends strength training with breath-led flow.",
    avatar_url: null, cover_image_url: null, intro_video_url: null,
    specialties: ["Vinyasa", "Strength", "Athletes"],
    languages: ["English", "Hindi", "Gujarati"],
    years_experience: 9, certifications: [], rating_avg: 0, rating_count: 0,
    timezone: "Asia/Kolkata", google_calendar_id: null,
    is_active: true, sort_order: 2,
    created_at: "", updated_at: "",
  },
  {
    id: "t3", profile_id: null, slug: "meera-iyer",
    display_name: "Meera Iyer",
    headline: "Prenatal & Restorative · 11 years",
    bio: "Meera holds a postgraduate diploma in yoga therapy and supports women through pregnancy and recovery.",
    avatar_url: null, cover_image_url: null, intro_video_url: null,
    specialties: ["Prenatal", "Restorative", "Pelvic floor"],
    languages: ["English", "Tamil", "Hindi"],
    years_experience: 11, certifications: [], rating_avg: 0, rating_count: 0,
    timezone: "Asia/Kolkata", google_calendar_id: null,
    is_active: true, sort_order: 3,
    created_at: "", updated_at: "",
  },
  {
    id: "t4", profile_id: null, slug: "vikram-singh",
    display_name: "Vikram Singh",
    headline: "Yin & Meditation · 7 years",
    bio: "Vikram leads slow, contemplative classes drawing on both Hatha and Insight meditation traditions.",
    avatar_url: null, cover_image_url: null, intro_video_url: null,
    specialties: ["Yin", "Meditation", "Stress relief"],
    languages: ["English", "Hindi", "Punjabi"],
    years_experience: 7, certifications: [], rating_avg: 0, rating_count: 0,
    timezone: "Asia/Kolkata", google_calendar_id: null,
    is_active: true, sort_order: 4,
    created_at: "", updated_at: "",
  },
  {
    id: "t5", profile_id: null, slug: "priya-nair",
    display_name: "Priya Nair",
    headline: "Hatha & Seniors · 17 years",
    bio: "Priya specialises in gentle, joint-friendly sequences for students 50+ and post-injury recovery.",
    avatar_url: null, cover_image_url: null, intro_video_url: null,
    specialties: ["Hatha", "Seniors", "Mobility"],
    languages: ["English", "Malayalam", "Hindi"],
    years_experience: 17, certifications: [], rating_avg: 0, rating_count: 0,
    timezone: "Asia/Kolkata", google_calendar_id: null,
    is_active: true, sort_order: 5,
    created_at: "", updated_at: "",
  },
  {
    id: "t6", profile_id: null, slug: "arjun-rao",
    display_name: "Arjun Rao",
    headline: "Vinyasa & Backbends · 6 years",
    bio: "Arjun is an enthusiastic, playful teacher who loves teaching first-timers their first sun salutation.",
    avatar_url: null, cover_image_url: null, intro_video_url: null,
    specialties: ["Vinyasa", "Beginners", "Backbends"],
    languages: ["English", "Telugu", "Hindi"],
    years_experience: 6, certifications: [], rating_avg: 0, rating_count: 0,
    timezone: "Asia/Kolkata", google_calendar_id: null,
    is_active: true, sort_order: 6,
    created_at: "", updated_at: "",
  },
];

// Condition / life-stage 1:1 categories — the studio's "what you can work on" set.
// Copy LEADS with what the practice helps with (support/help-with verbs only;
// never cure/treat/lower/control a condition) for the UAE (DHA/MOH) + India
// (DMRA/ASCI) markets. The "not a substitute for medical care" caveat lives once,
// in the disclaimer at the bottom of /classes/[slug], not in every field — so the
// per-field hedges from 0023 were removed in 0024. Practice-safety stays in
// what_to_expect. Kept in sync with supabase/migrations/0024 + seed.sql.
const MOCK_CATEGORIES: ClassCategory[] = [
  {
    id: "c1", slug: "diabetes", name: "Diabetes",
    description: "Gentle movement and breathwork to support an active daily routine, steady energy, and everyday stress relief, shaped around how you feel.",
    helps_with: ["Healthy weight", "Gentle activity", "Steady energy", "Stress management", "Feeling more active"],
    long_description: "These gentle one-on-one sessions blend easy movement, comfortable breathing, and relaxation to help you stay active and feel more at ease in your day. Sessions support a balanced routine, steadier energy, and calmer everyday stress. Each one is shaped around your comfort, fitness level, and how you feel that day.",
    what_to_expect: ["A short check-in on how you feel, including any signs of a low", "Best practised after eating, not fasting or right after medication, with a quick sugar source nearby", "Gentle, low-impact, foot-friendly movement at a pace that suits you", "Simple, comfortable breathing and relaxation practices", "A calm wind-down to leave you feeling steady"],
    who_for: "Adults who want to support a healthy, active routine, keep moving gently, and ease everyday stress.",
    intensity: "gentle", icon_name: "droplet", cover_image_url: null,
    props_needed: ["mat", "chair"], sort_order: 1, is_active: true, created_at: "", updated_at: "",
  },
  {
    id: "c2", slug: "hypertension", name: "Hypertension",
    description: "Slow, soothing movement and even, natural breathing to support relaxation and a calmer state of mind.",
    helps_with: ["Relaxation", "Calmer breathing", "Better sleep", "Lower tension", "Stress management"],
    long_description: "Slow, soothing one-on-one sessions use easy movement and gentle, natural breathing to support deep relaxation and a calmer state of mind. Your teacher keeps everything comfortable and unhurried, with no straining or forceful techniques at any point, so each session feels restful from start to finish.",
    what_to_expect: ["A gentle, seated or standing warm-up at an easy pace", "Soft, even breathing with no breath-holding or forcing", "Slow movement that avoids strain or sudden effort", "Head kept at or above heart level, avoiding full inversions", "Guided relaxation and quiet meditation with plenty of rest"],
    who_for: "Adults who want a calming, low-intensity practice for relaxation and everyday stress, with each session paced gently and adapted to feel comfortable for you.",
    intensity: "gentle", icon_name: "gauge", cover_image_url: null,
    props_needed: ["mat", "chair"], sort_order: 2, is_active: true, created_at: "", updated_at: "",
  },
  {
    id: "c3", slug: "prenatal", name: "Prenatal & Postnatal",
    description: "Gentle, supportive sessions for pregnancy and the months after birth, tailored to your trimester or recovery stage to help you stay comfortable, mobile, and rested.",
    helps_with: ["Gentle mobility", "Easing aches", "Better sleep", "Relaxation", "Calmer breathing"],
    long_description: "Gentle sessions designed for pregnancy and the postnatal period, practised once your doctor or midwife gives the go-ahead and tailored to your trimester or recovery stage. Each session helps you stay comfortable, move with easy mobility within a stable range, and find moments of rest, with nothing strenuous. Your teacher adapts the practice week to week as your body changes, so it always feels supportive and safe.",
    what_to_expect: ["Confirmation your doctor or midwife has cleared you to practise", "Wall, chair, or bolster support for balance and comfort", "Gentle movement within a stable, comfortable range, not deepening stretch", "No deep twists, deep backbends, strong abdominal or core work, lying flat on the belly or (after early pregnancy) flat on the back, or strong inversions", "Calm, natural breathing without straining, finishing with restful relaxation"],
    who_for: "Expecting and new mothers, once cleared by their doctor or midwife, who want a gentle, supportive practice to feel comfortable and rested through pregnancy and recovery.",
    intensity: "gentle", icon_name: "baby", cover_image_url: null,
    props_needed: ["mat", "bolster"], sort_order: 3, is_active: true, created_at: "", updated_at: "",
  },
  {
    id: "c4", slug: "hormonal-health", name: "Hormonal Health",
    description: "Soothing, restorative yoga and breathwork to help you rest deeply, sleep better, and feel steadier through different life stages.",
    helps_with: ["Restful practice", "Better sleep", "Daily energy", "Relaxation", "Wellbeing"],
    long_description: "Soothing, restorative one-on-one sessions use gentle movement, breathwork, and relaxation to help you feel rested, comfortable, and steady through different life stages. The focus is on rest and ease rather than intensity, so you can wind down and find a calmer, more settled state. Breathing stays gentle and natural with no breath-holding, and your teacher checks for pregnancy or any conditions so each session is adapted to feel safe and comfortable for you.",
    what_to_expect: ["A relaxed check-in on your energy, rest, and anything to adapt for", "Slow, restorative movement and supported postures", "Gentle, comfortable breathing with no breath-holding or forcing", "Guided relaxation to help settle the mind", "A calm, unhurried close to the session"],
    who_for: "Anyone wanting a gentle, restorative practice to support rest, sleep, and a sense of steadiness through changing life stages.",
    intensity: "gentle", icon_name: "flower-2", cover_image_url: null,
    props_needed: ["mat"], sort_order: 4, is_active: true, created_at: "", updated_at: "",
  },
  {
    id: "c5", slug: "pain-relief", name: "Pain Relief",
    description: "Gentle stretching and posture work to help ease the everyday back, neck, and joint tension that builds up from sitting and daily life.",
    helps_with: ["Mobility", "Posture", "Less everyday tension", "Flexibility", "Relaxation"],
    long_description: "Gentle stretching, mobility, and posture work to help ease the everyday back, neck, and joint tension that builds up from sitting and daily life. Sessions move at your pace and stay within a comfortable, pain-free range, with your teacher adjusting each movement to suit your body so you can build easier, more comfortable everyday movement.",
    what_to_expect: ["A check-in on areas of tension and your comfortable range", "A note to check with your doctor first if pain is recent, severe, or comes with numbness or radiating pain", "Gentle stretches and mobility work kept pain-free, never pushed into pain", "Posture guidance, avoiding deep loaded spinal bends or twists for sensitive backs", "Simple movements for daily life and a relaxing wind-down"],
    who_for: "Adults with everyday stiffness or tension who want gentle, comfortable movement to feel looser and more at ease in daily life.",
    intensity: "gentle", icon_name: "bone", cover_image_url: null,
    props_needed: ["mat", "blocks"], sort_order: 5, is_active: true, created_at: "", updated_at: "",
  },
  {
    id: "c6", slug: "mental-health", name: "Mental Health",
    description: "Restful breath, gentle movement, and meditation to help you ease everyday stress, settle a busy mind, and rest more easily.",
    helps_with: ["Stress management", "A settled mind", "Better sleep", "Mood support", "Focus"],
    long_description: "Restful one-on-one sessions blend gentle movement, breathwork, and meditation to help you ease everyday stress, settle a busy mind, and rest more easily. The pace is calm and the space is private, so you can fully unwind. Each session is shaped around how you're feeling that day, giving you simple, supportive practices for relaxation, focus, and a steadier sense of calm you can carry into daily life.",
    what_to_expect: ["A gentle check-in on how you're feeling", "Slow movement to release everyday tension", "Calming, comfortable breathing practices", "Guided meditation and quiet relaxation", "A soft close to leave you feeling steadier"],
    who_for: "Anyone wanting a calm, supportive practice to ease everyday stress, quiet the mind, and rest better. Ideal if you'd like a private, unhurried space to slow down and build relaxing habits at your own pace.",
    intensity: "gentle", icon_name: "brain", cover_image_url: null,
    props_needed: ["mat", "cushion"], sort_order: 6, is_active: true, created_at: "", updated_at: "",
  },
  {
    id: "c7", slug: "weight-loss", name: "Weight Loss",
    description: "Energising, sustainable flows scaled to your fitness level that help you build an active routine and healthy everyday habits you can keep up.",
    helps_with: ["Active routine", "Daily energy", "Healthy habits", "Strength", "Stamina"],
    long_description: "Energising, sustainable flows scaled to your fitness level help you build an active routine and healthy everyday habits. Sessions build gradually so movement stays enjoyable and something you can keep up, with intensity matched to your fitness and adjusted as needed. Your teacher challenges you comfortably without overdoing it, and we ease off whenever you need to.",
    what_to_expect: ["A short screening, with a note to check with your doctor first if you're inactive or have heart, blood-pressure, or joint concerns", "A warm-up matched to your current fitness", "Flowing, energising sequences at a sustainable pace", "Gradual progression with modifications so every level feels achievable", "We ease off if you feel dizzy, breathless, or any pain, finishing with a cool-down and stretch"],
    who_for: "Adults who want an enjoyable, sustainable flow practice to support an active, healthy routine.",
    intensity: "moderate", icon_name: "flame", cover_image_url: null,
    props_needed: ["mat"], sort_order: 7, is_active: true, created_at: "", updated_at: "",
  },
  {
    id: "c8", slug: "geriatric", name: "Geriatric Yoga",
    description: "Slow, supportive yoga for older adults to help with everyday mobility, balance, and confidence — with chair options as needed.",
    helps_with: ["Mobility", "Balance", "Steadiness", "Flexibility", "Relaxation"],
    long_description: "Slow, supportive one-on-one yoga for older adults to help with everyday mobility, balance, and confidence in daily movement. Chair-supported and standing options keep everything safe and accessible. Your teacher works gently at your pace, moving slowly between positions, and adapts each session to suit you.",
    what_to_expect: ["Seated, chair-supported, and standing options as needed", "Standing balance work always within reach of a chair or wall", "Gentle movement to support mobility and balance", "We move slowly between positions to avoid dizziness, with steady breathing throughout", "Plenty of time, clear guidance, and a relaxing close"],
    who_for: "Older adults who want a safe, gentle, supportive practice for everyday movement and confidence.",
    intensity: "gentle", icon_name: "accessibility", cover_image_url: null,
    props_needed: ["mat", "chair"], sort_order: 8, is_active: true, created_at: "", updated_at: "",
  },
  {
    id: "c9", slug: "kids-yoga", name: "Kids Yoga",
    description: "Playful, age-appropriate yoga that helps children build focus, flexibility, and calm in a fun, friendly 1:1 setting.",
    helps_with: ["Focus", "Flexibility", "Calm", "Confidence", "Fun movement"],
    long_description: "Playful, age-appropriate one-on-one yoga that helps children build focus, flexibility, and calm in a fun, friendly setting. Sessions use games, stories, and simple poses so children stay engaged and enjoy themselves. Your teacher adapts the energy and activities to suit each child's age and mood, keeping everything gentle and body-safe.",
    what_to_expect: ["A friendly warm-up with playful movement", "Animal poses, games, and simple stretches", "Playful, gentle breathing games with no forceful breath-holding", "Age-appropriate poses that avoid neck-loading inversions", "Encouragement and fun, never pressure, with a settling activity to finish"],
    who_for: "Children who would enjoy a playful, friendly one-on-one setting to build focus, flexibility, and calm.",
    intensity: "gentle", icon_name: "smile", cover_image_url: null,
    props_needed: ["mat"], sort_order: 9, is_active: true, created_at: "", updated_at: "",
  },
];

// Session-credit packs (one-time) — mirrors supabase/migrations/0020 + 0022 + seed.sql.
// A pack = per-currency prices (AED/INR) + N session-credits; the free 1:1 trial
// never spends credits. TODO(pricing): placeholder amounts — confirm with business.
const MOCK_PLANS: PlanWithFeatures[] = [
  {
    id: "p5", slug: "pack-5", name: "5-Session Pack",
    description: "Five personalised 1:1 sessions — your flexible way in.",
    price_base_cents: 1000000, billing_interval: "one_time", session_credits: 5,
    paypal_plan_id: null, included_sessions_per_month: null,
    included_session_types: [],
    is_active: true, is_featured: false, sort_order: 1,
    created_at: "", updated_at: "",
    prices: [
      { id: "pp5-inr", plan_id: "p5", currency: "INR", amount_cents: 1000000, created_at: "", updated_at: "" },
      { id: "pp5-aed", plan_id: "p5", currency: "AED", amount_cents: 43500,   created_at: "", updated_at: "" },
    ],
    features: [
      { id: "f1", plan_id: "p5", feature_text: "5 personalised 1:1 sessions",     is_included: true, sort_order: 1 },
      { id: "f2", plan_id: "p5", feature_text: "Book any teacher, any style",     is_included: true, sort_order: 2 },
      { id: "f3", plan_id: "p5", feature_text: "60-min sessions on Google Meet",  is_included: true, sort_order: 3 },
      { id: "f4", plan_id: "p5", feature_text: "Credits never expire",            is_included: true, sort_order: 4 },
      { id: "f5", plan_id: "p5", feature_text: "Cancel before the session — credit refunded", is_included: true, sort_order: 5 },
    ],
  },
  {
    id: "p10", slug: "pack-10", name: "10-Session Pack",
    description: "Ten personalised 1:1 sessions — our best price per session.",
    price_base_cents: 1900000, billing_interval: "one_time", session_credits: 10,
    paypal_plan_id: null, included_sessions_per_month: null,
    included_session_types: [],
    is_active: true, is_featured: true, sort_order: 2,
    created_at: "", updated_at: "",
    prices: [
      { id: "pp10-inr", plan_id: "p10", currency: "INR", amount_cents: 1900000, created_at: "", updated_at: "" },
      { id: "pp10-aed", plan_id: "p10", currency: "AED", amount_cents: 82500,   created_at: "", updated_at: "" },
    ],
    features: [
      { id: "f6",  plan_id: "p10", feature_text: "10 personalised 1:1 sessions",   is_included: true, sort_order: 1 },
      { id: "f7",  plan_id: "p10", feature_text: "Book any teacher, any style",    is_included: true, sort_order: 2 },
      { id: "f8",  plan_id: "p10", feature_text: "Lowest price per session",       is_included: true, sort_order: 3 },
      { id: "f9",  plan_id: "p10", feature_text: "Credits never expire",           is_included: true, sort_order: 4 },
      { id: "f10", plan_id: "p10", feature_text: "Cancel before the session — credit refunded", is_included: true, sort_order: 5 },
    ],
  },
];

const MOCK_REVIEWS: (Review & { teacher_name?: string })[] = [
  { id: "r1", customer_id: "", teacher_id: "t1", session_id: null, rating: 5, body: "After three weeks with Aarti my chronic back pain is gone. The 1:1 attention made all the difference.", is_featured: true, is_approved: true, display_name_override: "Sara M.", display_location: "Dubai, AE", created_at: "", updated_at: "", teacher_name: "Aarti Deshmukh" },
  { id: "r2", customer_id: "", teacher_id: "t2", session_id: null, rating: 5, body: "Rohan's flow classes are exactly the strength + mobility combo I needed. I look forward to every 7am session.", is_featured: true, is_approved: true, display_name_override: "Karan K.", display_location: "Abu Dhabi, AE", created_at: "", updated_at: "", teacher_name: "Rohan Patel" },
  { id: "r3", customer_id: "", teacher_id: "t3", session_id: null, rating: 5, body: "Meera made me feel safe during a difficult pregnancy. She actually understands the body.", is_featured: true, is_approved: true, display_name_override: "Priya N.", display_location: "Mumbai, IN", created_at: "", updated_at: "", teacher_name: "Meera Iyer" },
  { id: "r4", customer_id: "", teacher_id: "t4", session_id: null, rating: 5, body: "Vikram's yin classes are the only thing that turns my brain off after long days. Worth every cent.", is_featured: true, is_approved: true, display_name_override: "Aisha B.", display_location: "Sharjah, AE", created_at: "", updated_at: "", teacher_name: "Vikram Singh" },
  { id: "r5", customer_id: "", teacher_id: "t5", session_id: null, rating: 5, body: "I'm 64 and I haven't moved this well in 20 years. Priya is patient and brilliant.", is_featured: true, is_approved: true, display_name_override: "Lakshmi R.", display_location: "Bengaluru, IN", created_at: "", updated_at: "", teacher_name: "Priya Nair" },
  { id: "r6", customer_id: "", teacher_id: "t6", session_id: null, rating: 5, body: "Arjun made it possible for a total beginner like me to actually start. No judgment, lots of laughs.", is_featured: true, is_approved: true, display_name_override: "Zara W.", display_location: "Delhi, IN", created_at: "", updated_at: "", teacher_name: "Arjun Rao" },
];

const MOCK_SETTINGS: Record<string, unknown> = {
  "brand.name": "My Yoga Classes",
  "landing.hero_headline": "Find your free 1:1 yoga teacher — no credit card.",
  "landing.hero_subhead":
    "A 60-minute personalised session, live on Google Meet — shown in your local time. Pick your teacher, pick your time.",
  "landing.trust_count": "1,200+ reviews",
  "landing.trust_rating": "4.9",
  "landing.final_headline": "Your first session is on us.",
};

// --------------------------------------------------------------------------
// Public data accessors
// --------------------------------------------------------------------------
// Homepage carousel only — capped at 8. Use getAllActiveTeachers for the full
// /teachers grid and getTeacherBySlug for detail pages (a capped list would 404
// the 9th+ teacher's detail page and over-fetch for a slug filter).
export async function getFeaturedTeachers(): Promise<Teacher[]> {
  if (!isSupabaseConfigured) return MOCK_TEACHERS;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("teachers")
    .select("*")
    .eq("is_active", true)
    .order("sort_order")
    .limit(8);
  return data && data.length ? data : MOCK_TEACHERS;
}

// Uncapped active-teacher list for the public /teachers grid and the dashboard
// booking grid.
export async function getAllActiveTeachers(): Promise<Teacher[]> {
  if (!isSupabaseConfigured) return MOCK_TEACHERS;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("teachers")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");
  return data && data.length ? data : MOCK_TEACHERS;
}

// Single teacher by slug for detail pages. Wrapped in React cache so the page and
// its generateMetadata share ONE query per request (supabase-js isn't
// request-deduped). Returns null when not found / inactive.
export const getTeacherBySlug = cache(async (slug: string): Promise<Teacher | null> => {
  if (!isSupabaseConfigured) return MOCK_TEACHERS.find((t) => t.slug === slug) ?? null;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("teachers")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  return data ?? null;
});

// Wrapped in React cache so a page that calls it in both generateMetadata and the
// component body (e.g. classes/[slug]) issues one query per request.
export const getClassCategories = cache(async (): Promise<ClassCategory[]> => {
  if (!isSupabaseConfigured) return MOCK_CATEGORIES;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("class_categories")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");
  return data && data.length ? data : MOCK_CATEGORIES;
});

export async function getPlansWithFeatures(): Promise<PlanWithFeatures[]> {
  if (!isSupabaseConfigured) return MOCK_PLANS;
  const supabase = await createSupabaseServerClient();
  const { data: plans } = await supabase
    .from("plans").select("*").eq("is_active", true).order("sort_order");
  if (!plans || plans.length === 0) return MOCK_PLANS;
  const [{ data: features }, { data: prices }] = await Promise.all([
    supabase.from("plan_features").select("*").order("sort_order"),
    supabase.from("plan_prices").select("*"),
  ]);
  return plans.map((p) => ({
    ...p,
    features: features?.filter((f) => f.plan_id === p.id) ?? [],
    prices: prices?.filter((pp) => pp.plan_id === p.id) ?? [],
  }));
}

export async function getFeaturedReviews(): Promise<(Review & { teacher_name?: string })[]> {
  if (!isSupabaseConfigured) return MOCK_REVIEWS;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("reviews")
    .select("*, teacher:teachers(display_name)")
    .eq("is_featured", true)
    .eq("is_approved", true)
    .limit(9);
  if (!data || data.length === 0) return MOCK_REVIEWS;
  return data.map((r) => ({
    ...r,
    teacher_name: r.teacher?.display_name,
  }));
}

export async function getLandingSettings(keys: string[]): Promise<Record<string, unknown>> {
  if (!isSupabaseConfigured) return Object.fromEntries(keys.map((k) => [k, MOCK_SETTINGS[k]]));
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.rpc("get_admin_settings", { keys });
  return (data as Record<string, unknown>) ?? {};
}

export function landingSetting<T = string>(
  settings: Record<string, unknown>,
  key: string,
  fallback: T
): T {
  const v = settings?.[key];
  // Treat null/undefined AND empty strings as "unset" so an admin who clears a
  // field (or an empty mock value) falls back to the default instead of
  // rendering a blank trust badge / headline.
  if (v === null || v === undefined || (typeof v === "string" && v.trim() === "")) {
    return fallback;
  }
  return v as T;
}
