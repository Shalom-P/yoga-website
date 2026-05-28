// Drizzle client — server-side only. Used for complex typed queries.
// supabase-js still handles auth, storage, and simple CRUD.
//
// NB: Drizzle bypasses Supabase RLS because we connect with the service-role-equivalent
// pooler URL. ALWAYS gate Drizzle calls behind explicit auth/role checks in your handler.

import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.SUPABASE_DB_URL;

let _db: ReturnType<typeof drizzle> | null = null;

export function db() {
  if (!connectionString) {
    throw new Error(
      "SUPABASE_DB_URL is not set — Drizzle DB client cannot be created"
    );
  }
  if (_db) return _db;
  const client = postgres(connectionString, { prepare: false, max: 4 });
  _db = drizzle(client, { schema });
  return _db;
}
