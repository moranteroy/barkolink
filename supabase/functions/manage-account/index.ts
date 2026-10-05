import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (status: number, body: object) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
Deno.serve(async (request) => {
  if (request.method === "OPTIONS")
    return new Response("ok", { headers: cors });
  if (request.method !== "POST") return reply(405, { error: "Use POST." });
  const token = request.headers
    .get("Authorization")
    ?.replace(/^Bearer\s+/i, "");
  if (!token) return reply(401, { error: "Sign in first." });
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  // getUser validates the token and fetches authoritative metadata after demotions.
  const {
    data: { user },
    error,
  } = await admin.auth.getUser(token);
  if (error || !user)
    return reply(401, { error: "Your session has expired. Sign in again." });
  if (user.app_metadata.role !== "ADMIN")
    return reply(403, { error: "Administrator access required." });
  try {
    const { action, input } = await request.json();
    if (action === "generateTemporaryPassword") {
      const bytes = crypto.getRandomValues(new Uint8Array(18));
      return reply(200, {
        password: Array.from(bytes, (b) =>
          b.toString(16).padStart(2, "0"),
        ).join(""),
      });
    }
    if (action !== "createManagedUser")
      return reply(400, { error: "Unknown account action." });
    const fullName = String(input?.fullName || "").trim();
    const email = String(input?.email || "")
      .trim()
      .toLowerCase();
    const password = String(input?.password || "");
    const role = String(input?.role || "").toUpperCase();
    const phone = String(input?.phone || "").trim();
    if (
      !fullName ||
      fullName.length > 120 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      email.length > 254 ||
      password.length < 8 ||
      password.length > 128 ||
      !["PASSENGER", "TICKETING", "BOARDING"].includes(role)
    ) {
      return reply(400, {
        error:
          "Enter a valid name, email, password of at least 8 characters, and account role.",
      });
    }
    const { data, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { fullName },
      app_metadata: { role },
    });
    if (createError || !data.user)
      return reply(400, {
        error: createError?.message || "Could not create account.",
      });
    if (phone) {
      const { error: profileError } = await admin
        .from("app_user")
        .update({ phone: phone.slice(0, 40) })
        .eq("uid", data.user.id);
      if (profileError) {
        await admin.auth.admin.deleteUser(data.user.id);
        await admin.from("app_user").delete().eq("uid", data.user.id);
        return reply(500, {
          error: "Could not save account details. Please try again.",
        });
      }
    }
    return reply(200, { uid: data.user.id, email, fullName, role });
  } catch {
    return reply(400, { error: "Invalid account request." });
  }
});
