// Hand-maintained Database type, mirroring supabase/migrations/* (the authoritative
// schema — see CLAUDE.md "Schema ownership"). Kept hand-written rather than re-running
// `supabase gen types` because (a) the live DB currently lags the migrations (0020's
// `one_time` interval, 0021's `refund_session_credit`), so a live regen would be stale,
// and (b) the app imports many named aliases + hand-written RPC signatures a raw regen
// wouldn't emit. The shape matches what supabase-js 2.46+ expects: per-table
// { Row, Insert, Update, Relationships } and top-level { Tables, Views, Functions, Enums,
// CompositeTypes }. The per-table Relationships (outgoing foreign keys, with literal
// `referencedRelation` names) are what let supabase-js resolve embedded selects
// (e.g. `bookings.select("session:sessions(...)")`) to a real row type instead of an
// error type — keep them in sync with the migrations.

export type UserRole = "customer" | "admin";
export type ExperienceLevel = "beginner" | "intermediate" | "advanced";
export type IntensityLevel = "gentle" | "moderate" | "intense";
export type SessionStatus = "scheduled" | "live" | "completed" | "cancelled";
export type BookingStatus = "confirmed" | "cancelled" | "attended" | "no_show";
export type BillingInterval = "monthly" | "quarterly" | "yearly" | "one_time";
export type DiscountType = "percentage" | "fixed_aud_cents" | "fixed_amount_cents";
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
  // Richer detail-page content (added in migration 0023). `helps_with` chips
  // surface the problems a category supports; the rest fill out the detail page.
  helps_with: string[];
  long_description: string | null;
  what_to_expect: string[];
  who_for: string | null;
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
  reminded_at_24h: string | null;
  reminded_at_1h: string | null;
  created_at: string;
  updated_at: string;
}
export type Plan = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  price_base_cents: number;
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
export type PlanPrice = {
  id: string;
  plan_id: string;
  currency: string; // 'INR' | 'AED'
  amount_cents: number;
  created_at: string;
  updated_at: string;
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
  amount_cents: number;
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

// One entry per outgoing foreign key, mirroring `supabase gen types` output.
type Relationship = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne: boolean;
  referencedRelation: string;
  referencedColumns: string[];
};

type Table<R, I = Partial<R>, U = Partial<R>, Rel extends readonly Relationship[] = []> = {
  Row: R;
  Insert: I;
  Update: U;
  Relationships: Rel;
};

export type Database = {
  // Required by @supabase/supabase-js 2.46+ — drives postgrest feature inference.
  __InternalSupabase: { PostgrestVersion: "12" };
  public: {
    Tables: {
      profiles: Table<Profile, Partial<Profile> & { id: string }, Partial<Profile>, [
        { foreignKeyName: "profiles_id_fkey"; columns: ["id"]; isOneToOne: true; referencedRelation: "users"; referencedColumns: ["id"] },
      ]>;
      teachers: Table<Teacher, Partial<Teacher> & { slug: string; display_name: string }, Partial<Teacher>, [
        { foreignKeyName: "teachers_profile_id_fkey"; columns: ["profile_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
      ]>;
      teacher_availability: Table<TeacherAvailability, Partial<TeacherAvailability> & { teacher_id: string; day_of_week: number; start_time: string; end_time: string }, Partial<TeacherAvailability>, [
        { foreignKeyName: "teacher_availability_teacher_id_fkey"; columns: ["teacher_id"]; isOneToOne: false; referencedRelation: "teachers"; referencedColumns: ["id"] },
      ]>;
      teacher_slot_overrides: Table<TeacherSlotOverride, Partial<TeacherSlotOverride> & { teacher_id: string; date: string }, Partial<TeacherSlotOverride>, [
        { foreignKeyName: "teacher_slot_overrides_teacher_id_fkey"; columns: ["teacher_id"]; isOneToOne: false; referencedRelation: "teachers"; referencedColumns: ["id"] },
      ]>;
      class_categories: Table<ClassCategory, Partial<ClassCategory> & { slug: string; name: string }>;
      sessions: Table<Session, Partial<Session> & { teacher_id: string; start_at: string; end_at: string }, Partial<Session>, [
        { foreignKeyName: "sessions_teacher_id_fkey"; columns: ["teacher_id"]; isOneToOne: false; referencedRelation: "teachers"; referencedColumns: ["id"] },
        { foreignKeyName: "sessions_class_category_id_fkey"; columns: ["class_category_id"]; isOneToOne: false; referencedRelation: "class_categories"; referencedColumns: ["id"] },
      ]>;
      bookings: Table<Booking, Partial<Booking> & { session_id: string; customer_id: string }, Partial<Booking>, [
        { foreignKeyName: "bookings_session_id_fkey"; columns: ["session_id"]; isOneToOne: false; referencedRelation: "sessions"; referencedColumns: ["id"] },
        { foreignKeyName: "bookings_customer_id_fkey"; columns: ["customer_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        { foreignKeyName: "bookings_payment_fk"; columns: ["payment_id"]; isOneToOne: false; referencedRelation: "payments"; referencedColumns: ["id"] },
      ]>;
      plans: Table<Plan, Partial<Plan> & { slug: string; name: string; price_base_cents: number }>;
      plan_features: Table<PlanFeature, Partial<PlanFeature> & { plan_id: string; feature_text: string }, Partial<PlanFeature>, [
        { foreignKeyName: "plan_features_plan_id_fkey"; columns: ["plan_id"]; isOneToOne: false; referencedRelation: "plans"; referencedColumns: ["id"] },
      ]>;
      plan_prices: Table<PlanPrice, Partial<PlanPrice> & { plan_id: string; currency: string; amount_cents: number }, Partial<PlanPrice>, [
        { foreignKeyName: "plan_prices_plan_id_fkey"; columns: ["plan_id"]; isOneToOne: false; referencedRelation: "plans"; referencedColumns: ["id"] },
      ]>;
      discount_codes: Table<DiscountCode, Partial<DiscountCode> & { code: string; discount_type: DiscountType; discount_value: number }>;
      subscriptions: Table<Subscription, Partial<Subscription> & { customer_id: string; plan_id: string; paypal_subscription_id: string }, Partial<Subscription>, [
        { foreignKeyName: "subscriptions_customer_id_fkey"; columns: ["customer_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        { foreignKeyName: "subscriptions_plan_id_fkey"; columns: ["plan_id"]; isOneToOne: false; referencedRelation: "plans"; referencedColumns: ["id"] },
        { foreignKeyName: "subscriptions_discount_code_id_fkey"; columns: ["discount_code_id"]; isOneToOne: false; referencedRelation: "discount_codes"; referencedColumns: ["id"] },
      ]>;
      payments: Table<Payment, Partial<Payment> & { customer_id: string; amount_cents: number }, Partial<Payment>, [
        { foreignKeyName: "payments_customer_id_fkey"; columns: ["customer_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        { foreignKeyName: "payments_subscription_id_fkey"; columns: ["subscription_id"]; isOneToOne: false; referencedRelation: "subscriptions"; referencedColumns: ["id"] },
      ]>;
      reviews: Table<Review, Partial<Review> & { customer_id: string; rating: number }, Partial<Review>, [
        { foreignKeyName: "reviews_customer_id_fkey"; columns: ["customer_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        { foreignKeyName: "reviews_teacher_id_fkey"; columns: ["teacher_id"]; isOneToOne: false; referencedRelation: "teachers"; referencedColumns: ["id"] },
        { foreignKeyName: "reviews_session_id_fkey"; columns: ["session_id"]; isOneToOne: false; referencedRelation: "sessions"; referencedColumns: ["id"] },
      ]>;
      promotional_media: Table<PromotionalMedia, Partial<PromotionalMedia> & { kind: MediaKind; url: string }>;
      admin_settings: Table<AdminSettings, { key: string; value: unknown; updated_by?: string | null }, Partial<AdminSettings>, [
        { foreignKeyName: "admin_settings_updated_by_fkey"; columns: ["updated_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
      ]>;
      newsletter_signups: Table<NewsletterSignup, { email: string; source?: string | null }>;
      audit_log: Table<AuditLog, { action: string; entity_type: string; entity_id?: string | null; actor_id?: string | null; payload?: unknown }, Partial<AuditLog>, [
        { foreignKeyName: "audit_log_actor_id_fkey"; columns: ["actor_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
      ]>;
      paypal_webhook_events: Table<PaypalWebhookEvent, { event_id: string; event_type: string; payload?: unknown }>;
      customer_credits: Table<CustomerCredits, Partial<CustomerCredits> & { customer_id: string }, Partial<CustomerCredits>, [
        { foreignKeyName: "customer_credits_customer_id_fkey"; columns: ["customer_id"]; isOneToOne: true; referencedRelation: "profiles"; referencedColumns: ["id"] },
      ]>;
      credit_ledger: Table<CreditLedger, Partial<CreditLedger> & { customer_id: string; delta: number; reason: CreditReason }, Partial<CreditLedger>, [
        { foreignKeyName: "credit_ledger_customer_id_fkey"; columns: ["customer_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        { foreignKeyName: "credit_ledger_payment_id_fkey"; columns: ["payment_id"]; isOneToOne: false; referencedRelation: "payments"; referencedColumns: ["id"] },
        { foreignKeyName: "credit_ledger_booking_id_fkey"; columns: ["booking_id"]; isOneToOne: false; referencedRelation: "bookings"; referencedColumns: ["id"] },
      ]>;
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
          // Month-to-date completed revenue, keyed by currency (e.g. { INR, AED }).
          // Never summed across currencies.
          revenue_mtd_by_currency: Record<string, number>;
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
      refund_session_credit: {
        Args: { p_customer: string; p_booking_id: string };
        Returns: boolean;
      };
      book_session: {
        Args: {
          p_customer: string;
          p_teacher: string;
          p_start: string;
          p_end: string;
          p_is_free_trial: boolean;
        };
        Returns: { booking_id: string; session_id: string }[];
      };
      clawback_session_credits: {
        Args: {
          p_customer: string;
          p_amount: number;
          p_external_ref: string;
          p_payment_id?: string | null;
        };
        Returns: null;
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
