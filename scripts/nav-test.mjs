// Disposable navigation E2E helper. Creates a throwaway auth user, signs in,
// and prints the Supabase SSR cookies so curl can drive authed routes.
// Usage: node scripts/nav-test.mjs create|cookies|onboard|cleanup
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const EMAIL = "nav-test-disposable@example.com";
const PASSWORD = "nav-test-Passw0rd!12345";

const admin = createClient(url, service, { auth: { persistSession: false } });

async function findUser() {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (error) throw error;
  return data.users.find((u) => u.email === EMAIL);
}

const cmd = process.argv[2];

if (cmd === "create") {
  const existing = await findUser();
  if (existing) await admin.auth.admin.deleteUser(existing.id);
  const { data, error } = await admin.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error) throw error;
  console.log(data.user.id);
} else if (cmd === "cookies") {
  const jar = [];
  const ssr = createServerClient(url, anon, {
    cookies: { getAll: () => [], setAll: (cs) => jar.push(...cs) },
  });
  const { error } = await ssr.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (error) throw error;
  console.log(jar.map((c) => `${c.name}=${c.value}`).join("; "));
} else if (cmd === "onboard") {
  const user = await findUser();
  const { error } = await admin
    .from("profiles")
    .upsert({ id: user.id, full_name: "Nav Test", experience_level: "beginner" })
    .select("id");
  if (error) throw error;
  console.log("onboarded", user.id);
} else if (cmd === "cleanup") {
  const user = await findUser();
  if (user) {
    await admin.auth.admin.deleteUser(user.id);
    console.log("deleted", user.id);
  } else {
    console.log("no test user found");
  }
} else {
  throw new Error("unknown command");
}
