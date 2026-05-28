import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./supabase/migrations",
  dialect: "postgresql",
  dbCredentials: { url: process.env.SUPABASE_DB_URL! },
  // Authoritative migration files live in supabase/migrations/. drizzle-kit is here for
  // local schema introspection and ad-hoc generation, not as the source of truth.
});
