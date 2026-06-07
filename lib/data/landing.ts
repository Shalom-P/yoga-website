// Server-side data layer for the marketing site.
// Reads from Supabase if NEXT_PUBLIC_SUPABASE_URL is configured.
// Otherwise returns realistic mock data so the site renders cleanly during local dev / preview deploys.

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Teacher, Plan, PlanFeature, ClassCategory, Review } from "@/lib/supabase/types";

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

const MOCK_CATEGORIES: ClassCategory[] = [
  { id: "c1", slug: "hatha",       name: "Hatha",        description: "Slow, foundational asanas to build strength and steadiness.",        intensity: "gentle",   icon_name: "leaf",        cover_image_url: null, props_needed: ["mat"],            sort_order: 1, is_active: true, created_at: "", updated_at: "" },
  { id: "c2", slug: "vinyasa",     name: "Vinyasa Flow", description: "Breath-linked movement that warms the body and frees the mind.",     intensity: "moderate", icon_name: "wind",        cover_image_url: null, props_needed: ["mat"],            sort_order: 2, is_active: true, created_at: "", updated_at: "" },
  { id: "c3", slug: "yin",         name: "Yin",          description: "Long-held passive postures that release deep connective tissue.",    intensity: "gentle",   icon_name: "moon",        cover_image_url: null, props_needed: ["mat", "bolster"], sort_order: 3, is_active: true, created_at: "", updated_at: "" },
  { id: "c4", slug: "restorative", name: "Restorative",  description: "Supported postures designed to switch your nervous system to rest.", intensity: "gentle",   icon_name: "cloud",       cover_image_url: null, props_needed: ["mat", "bolster", "blanket"], sort_order: 4, is_active: true, created_at: "", updated_at: "" },
  { id: "c5", slug: "prenatal",    name: "Prenatal",     description: "Pregnancy-safe sequences, taught by certified prenatal yoga teachers.", intensity: "gentle",   icon_name: "heart",       cover_image_url: null, props_needed: ["mat", "bolster"], sort_order: 5, is_active: true, created_at: "", updated_at: "" },
  { id: "c6", slug: "therapy",     name: "Pain Relief",  description: "One-on-one therapy yoga for back, neck, knees, and posture rehab.",  intensity: "moderate", icon_name: "stethoscope", cover_image_url: null, props_needed: ["mat", "blocks"],  sort_order: 6, is_active: true, created_at: "", updated_at: "" },
];

const MOCK_PLANS: (Plan & { features: PlanFeature[] })[] = [
  {
    id: "p1", slug: "starter", name: "Starter",
    description: "Unlimited group classes — the gentle on-ramp.",
    price_aud_cents: 4900, billing_interval: "monthly", session_credits: 4,
    paypal_plan_id: null, included_sessions_per_month: null,
    included_session_types: ["hatha", "vinyasa", "yin", "restorative"],
    is_active: true, is_featured: false, sort_order: 1,
    created_at: "", updated_at: "",
    features: [
      { id: "f1", plan_id: "p1", feature_text: "Unlimited live group classes",     is_included: true,  sort_order: 1 },
      { id: "f2", plan_id: "p1", feature_text: "All class types except therapy",   is_included: true,  sort_order: 2 },
      { id: "f3", plan_id: "p1", feature_text: "Cancel anytime",                   is_included: true,  sort_order: 3 },
      { id: "f4", plan_id: "p1", feature_text: "1:1 private sessions",             is_included: false, sort_order: 4 },
    ],
  },
  {
    id: "p2", slug: "unlimited", name: "Unlimited",
    description: "Unlimited group + 4 private 1:1 sessions per month.",
    price_aud_cents: 12900, billing_interval: "monthly", session_credits: 12,
    paypal_plan_id: null, included_sessions_per_month: null,
    included_session_types: ["hatha", "vinyasa", "yin", "restorative", "prenatal", "therapy"],
    is_active: true, is_featured: true, sort_order: 2,
    created_at: "", updated_at: "",
    features: [
      { id: "f5", plan_id: "p2", feature_text: "Everything in Starter",            is_included: true, sort_order: 1 },
      { id: "f6", plan_id: "p2", feature_text: "4 private 1:1 sessions / month",   is_included: true, sort_order: 2 },
      { id: "f7", plan_id: "p2", feature_text: "Personalised practice plan",       is_included: true, sort_order: 3 },
      { id: "f8", plan_id: "p2", feature_text: "Priority booking on popular slots", is_included: true, sort_order: 4 },
    ],
  },
  {
    id: "p3", slug: "therapy", name: "Therapy",
    description: "Weekly 1:1 therapy yoga for pain relief and rehabilitation.",
    price_aud_cents: 19900, billing_interval: "monthly", session_credits: 4,
    paypal_plan_id: null, included_sessions_per_month: null,
    included_session_types: ["therapy", "restorative", "prenatal", "hatha"],
    is_active: true, is_featured: false, sort_order: 3,
    created_at: "", updated_at: "",
    features: [
      { id: "f9",  plan_id: "p3", feature_text: "Weekly 1:1 therapy yoga (~4/mo)",     is_included: true, sort_order: 1 },
      { id: "f10", plan_id: "p3", feature_text: "Unlimited group classes",              is_included: true, sort_order: 2 },
      { id: "f11", plan_id: "p3", feature_text: "Custom rehabilitation plan",           is_included: true, sort_order: 3 },
      { id: "f12", plan_id: "p3", feature_text: "Itemised tax invoices for your records", is_included: true, sort_order: 4 },
    ],
  },
];

const MOCK_REVIEWS: (Review & { teacher_name?: string })[] = [
  { id: "r1", customer_id: "", teacher_id: "t1", session_id: null, rating: 5, body: "After three weeks with Aarti my chronic back pain is gone. The 1:1 attention made all the difference.", is_featured: true, is_approved: true, display_name_override: "Sarah M.", display_location: "Sydney, AU", created_at: "", updated_at: "", teacher_name: "Aarti Deshmukh" },
  { id: "r2", customer_id: "", teacher_id: "t2", session_id: null, rating: 5, body: "Rohan's flow classes are exactly the strength + mobility combo I needed. I look forward to every 7am session.", is_featured: true, is_approved: true, display_name_override: "James K.", display_location: "Melbourne, AU", created_at: "", updated_at: "", teacher_name: "Rohan Patel" },
  { id: "r3", customer_id: "", teacher_id: "t3", session_id: null, rating: 5, body: "Meera made me feel safe during a difficult pregnancy. She actually understands the body.", is_featured: true, is_approved: true, display_name_override: "Priya N.", display_location: "Brisbane, AU", created_at: "", updated_at: "", teacher_name: "Meera Iyer" },
  { id: "r4", customer_id: "", teacher_id: "t4", session_id: null, rating: 5, body: "Vikram's yin classes are the only thing that turns my brain off after long days. Worth every cent.", is_featured: true, is_approved: true, display_name_override: "Ethan B.", display_location: "Perth, AU", created_at: "", updated_at: "", teacher_name: "Vikram Singh" },
  { id: "r5", customer_id: "", teacher_id: "t5", session_id: null, rating: 5, body: "I'm 64 and I haven't moved this well in 20 years. Priya is patient and brilliant.", is_featured: true, is_approved: true, display_name_override: "Margaret R.", display_location: "Adelaide, AU", created_at: "", updated_at: "", teacher_name: "Priya Nair" },
  { id: "r6", customer_id: "", teacher_id: "t6", session_id: null, rating: 5, body: "Arjun made it possible for a total beginner like me to actually start. No judgment, lots of laughs.", is_featured: true, is_approved: true, display_name_override: "Chloe W.", display_location: "Hobart, AU", created_at: "", updated_at: "", teacher_name: "Arjun Rao" },
];

const MOCK_SETTINGS: Record<string, unknown> = {
  "brand.name": "My Yoga Classes",
  "landing.hero_headline": "Find your free 1:1 yoga teacher — no credit card.",
  "landing.hero_subhead":
    "60-minute private session. Pick your teacher. Pick your time. We meet on Google Meet.",
  "landing.trust_count": "Private 1:1 sessions",
  "landing.trust_rating": "",
  "landing.final_headline": "Your first session is on us.",
};

// --------------------------------------------------------------------------
// Public data accessors
// --------------------------------------------------------------------------
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

export async function getClassCategories(): Promise<ClassCategory[]> {
  if (!isSupabaseConfigured) return MOCK_CATEGORIES;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("class_categories")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");
  return data && data.length ? data : MOCK_CATEGORIES;
}

export async function getPlansWithFeatures(): Promise<(Plan & { features: PlanFeature[] })[]> {
  if (!isSupabaseConfigured) return MOCK_PLANS;
  const supabase = await createSupabaseServerClient();
  const { data: plans } = await supabase
    .from("plans").select("*").eq("is_active", true).order("sort_order");
  if (!plans || plans.length === 0) return MOCK_PLANS;
  const { data: features } = await supabase
    .from("plan_features").select("*").order("sort_order");
  return plans.map((p) => ({
    ...p,
    features: features?.filter((f) => f.plan_id === p.id) ?? [],
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
  return (data as unknown as Array<Review & { teacher?: { display_name: string } | null }>).map((r) => ({
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
  return (v as T) ?? fallback;
}
