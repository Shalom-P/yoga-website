// Hand-written Database type for v1 — replace with `supabase gen types typescript --project-id …`
// output once a Supabase project is provisioned. The shape below matches what supabase-js 2.46+
// expects: per-table { Row, Insert, Update, Relationships } and top-level
// { Tables, Views, Functions, Enums, CompositeTypes }.

export type UserRole = "customer" | "admin";
export type ExperienceLevel = "beginner" | "intermediate" | "advanced";
export type IntensityLevel = "gentle" | "moderate" | "intense";
export type SessionStatus = "scheduled" | "live" | "completed" | "cancelled";
export type BookingStatus = "confirmed" | "cancelled" | "attended" | "no_show";
export type BillingInterval = "monthly" | "quarterly" | "yearly";
export type DiscountType = "percentage" | "fixed_aud_cents";
export type SubscriptionStatus =
  | "pending" | "active" | "suspended" | "cancelled" | "expired";
export type PaymentStatus = "pending" | "completed" | "refunded" | "failed";
export type CreditReason = "purchase" | "booking_spend" | "refund" | "admin_adjust";
export type MediaKind =
  | "hero_video" | "hero_image" | "banner" | "testimonial_photo" | "class_thumbnail";

export type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  timezone: string;
  role: UserRole;
  experience_level: ExperienceLevel | null;
  goals: string[] | null;
  referral_source: string | null;
  marketing_opt_in: boolean;
  created_at: string;
  updated_at: string;
}
export type Teacher = {
  id: string;
  profile_id: string | null;
  slug: string;
  display_name: string;
  headline: string | null;
  bio: string | null;
  avatar_url: string | null;
  cover_image_url: string | null;
  intro_video_url: string | null;
  specialties: string[];
  languages: string[];
  years_experience: number;
  certifications: unknown;
  rating_avg: number;
  rating_count: number;
  timezone: string;
  google_calendar_id: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}
export type TeacherAvailability = {
  id: string;
  teacher_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_duration_minutes: number;
  created_at: string;
  updated_at: string;
}
export type TeacherSlotOverride = {
  id: string;
  teacher_id: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  is_blocked: boolean;
  reason: string | null;
  created_at: string;
}
export type ClassCategory = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  intensity: IntensityLevel;
  icon_name: string | null;
  cover_image_url: string | null;
  props_needed: string[];
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
export type MeetStatus = "pending" | "created" | "failed";
export type Session = {
  id: string;
  teacher_id: string;
  class_category_id: string | null;
  start_at: string;
  end_at: string;
  capacity: number;
  status: SessionStatus;
  meet_link: string | null;
  meet_event_id: string | null;
  meet_calendar_id: string | null;
  meet_status: MeetStatus | null;
  is_free_trial: boolean;
  recording_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
export type Booking = {
  id: string;
  session_id: string;
  customer_id: string;
  status: BookingStatus;
  is_free_trial: boolean;
  payment_id: string | null;
  cancellation_reason: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}
export type Plan = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  price_aud_cents: number;
  billing_interval: BillingInterval;
  session_credits: number;
  paypal_plan_id: string | null;
  included_sessions_per_month: number | null;
  included_session_types: string[];
  is_active: boolean;
  is_featured: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}
export type PlanFeature = {
  id: string;
  plan_id: string;
  feature_text: string;
  is_included: boolean;
  sort_order: number;
}
export type DiscountCode = {
  id: string;
  code: string;
  discount_type: DiscountType;
  discount_value: number;
  applies_to_plan_ids: string[] | null;
  max_uses: number | null;
  times_used: number;
  valid_from: string;
  valid_until: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
export type Subscription = {
  id: string;
  customer_id: string;
  plan_id: string;
  paypal_subscription_id: string;
  status: SubscriptionStatus;
  discount_code_id: string | null;
  discount_applied_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  next_billing_at: string | null;
  started_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}
export type Payment = {
  id: string;
  customer_id: string;
  subscription_id: string | null;
  paypal_capture_id: string | null;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  amount_aud_cents: number;
  currency: string;
  status: PaymentStatus;
  paid_at: string | null;
  created_at: string;
}
export type Review = {
  id: string;
  customer_id: string;
  teacher_id: string | null;
  session_id: string | null;
  rating: number;
  body: string | null;
  is_featured: boolean;
  is_approved: boolean;
  display_name_override: string | null;
  display_location: string | null;
  created_at: string;
  updated_at: string;
}
export type PromotionalMedia = {
  id: string;
  kind: MediaKind;
  url: string;
  alt_text: string | null;
  caption: string | null;
  placement: string | null;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  sort_order: number;
}
export type AdminSettings = {
  key: string;
  value: unknown;
  updated_by: string | null;
  updated_at: string;
}
export type NewsletterSignup = {
  id: string;
  email: string;
  source: string | null;
  confirmed: boolean;
  created_at: string;
}
export type AuditLog = {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  payload: unknown;
  created_at: string;
}
export type PaypalWebhookEvent = {
  event_id: string;
  event_type: string;
  received_at: string;
  payload: unknown;
}
export type CustomerCredits = {
  customer_id: string;
  balance: number;
  updated_at: string;
}
export type CreditLedger = {
  id: string;
  customer_id: string;
  delta: number;
  reason: CreditReason;
  payment_id: string | null;
  booking_id: string | null;
  created_at: string;
}
export type RazorpayWebhookEvent = {
  event_id: string;
  event_type: string | null;
  received_at: string;
  payload: unknown;
}

type Table<R, I = Partial<R>, U = Partial<R>> = {
  Row: R;
  Insert: I;
  Update: U;
  Relationships: [];
};

export type Database = {
  // Required by @supabase/supabase-js 2.46+ — drives postgrest feature inference.
  __InternalSupabase: { PostgrestVersion: "12" };
  public: {
    Tables: {
      profiles: Table<Profile, Partial<Profile> & { id: string }>;
      teachers: Table<Teacher, Partial<Teacher> & { slug: string; display_name: string }>;
      teacher_availability: Table<TeacherAvailability, Partial<TeacherAvailability> & { teacher_id: string; day_of_week: number; start_time: string; end_time: string }>;
      teacher_slot_overrides: Table<TeacherSlotOverride, Partial<TeacherSlotOverride> & { teacher_id: string; date: string }>;
      class_categories: Table<ClassCategory, Partial<ClassCategory> & { slug: string; name: string }>;
      sessions: Table<Session, Partial<Session> & { teacher_id: string; start_at: string; end_at: string }>;
      bookings: Table<Booking, Partial<Booking> & { session_id: string; customer_id: string }>;
      plans: Table<Plan, Partial<Plan> & { slug: string; name: string; price_aud_cents: number }>;
      plan_features: Table<PlanFeature, Partial<PlanFeature> & { plan_id: string; feature_text: string }>;
      discount_codes: Table<DiscountCode, Partial<DiscountCode> & { code: string; discount_type: DiscountType; discount_value: number }>;
      subscriptions: Table<Subscription, Partial<Subscription> & { customer_id: string; plan_id: string; paypal_subscription_id: string }>;
      payments: Table<Payment, Partial<Payment> & { customer_id: string; amount_aud_cents: number }>;
      reviews: Table<Review, Partial<Review> & { customer_id: string; rating: number }>;
      promotional_media: Table<PromotionalMedia, Partial<PromotionalMedia> & { kind: MediaKind; url: string }>;
      admin_settings: Table<AdminSettings, { key: string; value: unknown; updated_by?: string | null }>;
      newsletter_signups: Table<NewsletterSignup, { email: string; source?: string | null }>;
      audit_log: Table<AuditLog, { action: string; entity_type: string; entity_id?: string | null; actor_id?: string | null; payload?: unknown }>;
      paypal_webhook_events: Table<PaypalWebhookEvent, { event_id: string; event_type: string; payload?: unknown }>;
      customer_credits: Table<CustomerCredits, Partial<CustomerCredits> & { customer_id: string }>;
      credit_ledger: Table<CreditLedger, Partial<CreditLedger> & { customer_id: string; delta: number; reason: CreditReason }>;
      razorpay_webhook_events: Table<RazorpayWebhookEvent, { event_id: string; event_type?: string | null; payload?: unknown }>;
    };
    Views: { [_ in never]: never };
    Functions: {
      get_admin_settings: {
        Args: { keys: string[] };
        Returns: Record<string, unknown>;
      };
      validate_discount_code: {
        Args: { p_code: string; p_plan_id: string };
        Returns:
          | { id: string; code: string; discount_type: DiscountType; discount_value: number }
          | null;
      };
      admin_kpis: {
        Args: Record<string, never>;
        Returns: {
          signups_today: number;
          trials_today: number;
          paid_active_subs: number;
          mrr_aud_cents: number;
        };
      };
      promote_to_admin: { Args: { target_user_id: string }; Returns: null };
      demote_from_admin: { Args: { target_user_id: string }; Returns: null };
      is_admin: { Args: { uid: string }; Returns: boolean };
      apply_discount_to_subscription: { Args: { p_subscription_id: string }; Returns: null };
      subscribe_newsletter: { Args: { p_email: string; p_source: string }; Returns: null };
      grant_session_credits: {
        Args: { p_customer: string; p_delta: number; p_reason: CreditReason; p_payment_id?: string | null };
        Returns: null;
      };
      spend_session_credit: {
        Args: { p_customer: string; p_booking_id?: string | null };
        Returns: boolean;
      };
    };
    Enums: {
      user_role: UserRole;
      experience_level: ExperienceLevel;
      intensity_level: IntensityLevel;
      session_status: SessionStatus;
      booking_status: BookingStatus;
      billing_interval: BillingInterval;
      discount_type: DiscountType;
      subscription_status: SubscriptionStatus;
      payment_status: PaymentStatus;
      media_kind: MediaKind;
      meet_status: MeetStatus;
      credit_reason: CreditReason;
    };
    CompositeTypes: { [_ in never]: never };
  };
};
