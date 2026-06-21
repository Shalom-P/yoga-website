// Drizzle schema mirroring the Supabase migrations.
// Used by server code for type-safe complex queries (booking conflicts, KPI rollups, etc.).
// Auth is still done via supabase-js. This is a *secondary* access path.

import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  pgEnum,
  date,
  time,
  numeric,
  primaryKey,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["customer", "admin", "teacher"]);
export const experienceLevelEnum = pgEnum("experience_level", [
  "beginner",
  "intermediate",
  "advanced",
]);
export const intensityEnum = pgEnum("intensity_level", ["gentle", "moderate", "intense"]);
export const sessionStatusEnum = pgEnum("session_status", [
  "scheduled",
  "live",
  "completed",
  "cancelled",
]);
export const bookingStatusEnum = pgEnum("booking_status", [
  "confirmed",
  "cancelled",
  "attended",
  "no_show",
]);
export const billingIntervalEnum = pgEnum("billing_interval", [
  "monthly",
  "quarterly",
  "yearly",
  "one_time",
]);
export const discountTypeEnum = pgEnum("discount_type", [
  "percentage",
  "fixed_aud_cents", // deprecated: kept because Postgres can't drop an enum value
  "fixed_amount_cents",
]);
export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "pending",
  "active",
  "suspended",
  "cancelled",
  "expired",
]);

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  full_name: text("full_name"),
  email: text("email"),
  phone: text("phone"),
  avatar_url: text("avatar_url"),
  timezone: text("timezone").notNull().default("Asia/Kolkata"),
  role: userRoleEnum("role").notNull().default("customer"),
  experience_level: experienceLevelEnum("experience_level"),
  goals: text("goals").array(),
  referral_source: text("referral_source"),
  marketing_opt_in: boolean("marketing_opt_in").notNull().default(false),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const teachers = pgTable(
  "teachers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profile_id: uuid("profile_id"),
    slug: text("slug").notNull(),
    display_name: text("display_name").notNull(),
    headline: text("headline"),
    bio: text("bio"),
    avatar_url: text("avatar_url"),
    cover_image_url: text("cover_image_url"),
    intro_video_url: text("intro_video_url"),
    specialties: text("specialties").array(),
    languages: text("languages").array(),
    years_experience: integer("years_experience").default(0),
    certifications: jsonb("certifications").default([]),
    rating_avg: numeric("rating_avg", { precision: 3, scale: 2 }).default("5.0"),
    rating_count: integer("rating_count").default(0),
    timezone: text("timezone").notNull().default("Asia/Kolkata"),
    google_calendar_id: text("google_calendar_id"),
    is_active: boolean("is_active").notNull().default(true),
    sort_order: integer("sort_order").default(0),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    slugIdx: uniqueIndex("teachers_slug_idx").on(t.slug),
    activeIdx: index("teachers_active_idx").on(t.is_active),
  })
);

export const classCategories = pgTable("class_categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  helps_with: text("helps_with").array(),
  long_description: text("long_description"),
  what_to_expect: text("what_to_expect").array(),
  who_for: text("who_for"),
  intensity: intensityEnum("intensity").notNull().default("moderate"),
  icon_name: text("icon_name"),
  cover_image_url: text("cover_image_url"),
  props_needed: text("props_needed").array(),
  sort_order: integer("sort_order").default(0),
  is_active: boolean("is_active").notNull().default(true),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teacher_id: uuid("teacher_id").notNull(),
    class_category_id: uuid("class_category_id"),
    start_at: timestamp("start_at", { withTimezone: true }).notNull(),
    end_at: timestamp("end_at", { withTimezone: true }).notNull(),
    capacity: integer("capacity").notNull().default(1),
    status: sessionStatusEnum("status").notNull().default("scheduled"),
    meet_link: text("meet_link"),
    meet_event_id: text("meet_event_id"),
    meet_calendar_id: text("meet_calendar_id"),
    is_free_trial: boolean("is_free_trial").notNull().default(false),
    recording_url: text("recording_url"),
    notes: text("notes"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    startAtIdx: index("sessions_start_at_idx").on(t.start_at),
    teacherIdx: index("sessions_teacher_idx").on(t.teacher_id),
  })
);

export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    session_id: uuid("session_id").notNull(),
    customer_id: uuid("customer_id").notNull(),
    status: bookingStatusEnum("status").notNull().default("confirmed"),
    is_free_trial: boolean("is_free_trial").notNull().default(false),
    payment_id: uuid("payment_id"),
    cancellation_reason: text("cancellation_reason"),
    cancelled_at: timestamp("cancelled_at", { withTimezone: true }),
    reminded_at_24h: timestamp("reminded_at_24h", { withTimezone: true }),
    reminded_at_1h: timestamp("reminded_at_1h", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    sessionCustomer: uniqueIndex("bookings_session_customer_uq").on(t.session_id, t.customer_id),
  })
);

export const plans = pgTable("plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  // Currency-neutral fallback price (smallest unit). Per-currency amounts live
  // in plan_prices; this is the default when a currency row is missing.
  price_base_cents: integer("price_base_cents").notNull(),
  billing_interval: billingIntervalEnum("billing_interval").notNull().default("monthly"),
  paypal_plan_id: text("paypal_plan_id"),
  included_sessions_per_month: integer("included_sessions_per_month"),
  included_session_types: text("included_session_types").array(),
  is_active: boolean("is_active").notNull().default(true),
  is_featured: boolean("is_featured").notNull().default(false),
  sort_order: integer("sort_order").default(0),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const planPrices = pgTable(
  "plan_prices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    plan_id: uuid("plan_id").notNull(),
    currency: text("currency").notNull(), // 'INR' | 'AED'
    amount_cents: integer("amount_cents").notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    planCurrency: uniqueIndex("plan_prices_plan_currency_uq").on(t.plan_id, t.currency),
  })
);

export const planFeatures = pgTable("plan_features", {
  id: uuid("id").primaryKey().defaultRandom(),
  plan_id: uuid("plan_id").notNull(),
  feature_text: text("feature_text").notNull(),
  is_included: boolean("is_included").notNull().default(true),
  sort_order: integer("sort_order").default(0),
});

export const adminSettings = pgTable("admin_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updated_by: uuid("updated_by"),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
