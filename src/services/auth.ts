import { shallowRef } from "vue";
import type { User } from "@supabase/supabase-js";
import { requireSupabase, supabase } from "./supabase";

export type AccountUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
  getRoleSession: (refresh?: boolean) => Promise<{ claims: { role?: string } }>;
};
const current = shallowRef<AccountUser | null>(null);
function accountUser(user: User): AccountUser {
  return {
    uid: user.id,
    email: user.email || null,
    displayName: user.user_metadata?.fullName || null,
    async getRoleSession() {
      const { data, error } = await requireSupabase().auth.getUser();
      if (error || !data.user)
        throw error || new Error("Your session has expired. Sign in again.");
      current.value = accountUser(data.user);
      return { claims: { role: data.user.app_metadata?.role || "PASSENGER" } };
    },
  };
}
const initialized = supabase
  ? supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        current.value = null;
        return;
      }
      current.value = data.session ? accountUser(data.session.user) : null;
    })
  : Promise.resolve();
supabase?.auth.onAuthStateChange((_event, session) => {
  current.value = session ? accountUser(session.user) : null;
});
export const auth = supabase
  ? {
      get currentUser() {
        return current.value;
      },
      async ready() {
        await initialized;
      },
    }
  : null;
export function syncAccountProfileName(uid: string, displayName: string) {
  if (current.value?.uid === uid)
    current.value = { ...current.value, displayName };
}
export function requireAuth() {
  if (!auth)
    throw new Error(
      "Supabase is not configured. Add the project URL and publishable key to .env.local.",
    );
  return auth;
}

export async function registerAccount(
  _auth: NonNullable<typeof auth>,
  email: string,
  password: string,
  fullName: string,
) {
  const { data, error } = await requireSupabase().auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: { fullName },
      emailRedirectTo: `${location.origin}/login`,
    },
  });
  if (error) throw error;
  if (!data.user) throw new Error("Could not register the account.");
  current.value = data.session ? accountUser(data.user) : null;
  return { user: accountUser(data.user), session: data.session };
}
export async function signInWithPassword(
  _auth: NonNullable<typeof auth>,
  email: string,
  password: string,
) {
  const { data, error } = await requireSupabase().auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) throw error;
  current.value = accountUser(data.user);
  return { user: current.value };
}
export async function signOut(_auth: NonNullable<typeof auth>) {
  const { error } = await requireSupabase().auth.signOut();
  if (error) throw error;
  current.value = null;
}
export async function sendPasswordResetEmail(
  _auth: NonNullable<typeof auth>,
  email: string,
) {
  const { error } = await requireSupabase().auth.resetPasswordForEmail(email, {
    redirectTo: `${location.origin}/reset-password`,
  });
  if (error) throw error;
}
export async function updateAccountProfile(
  _user: AccountUser,
  profile: { displayName: string },
) {
  const { data, error } = await requireSupabase().auth.updateUser({
    data: { fullName: profile.displayName },
  });
  if (error) throw error;
  current.value = accountUser(data.user);
}
export const PasswordAuthProvider = {
  credential: (email: string, password: string) => ({ email, password }),
};
export async function reauthenticateWithCredential(
  user: AccountUser,
  credential: { email: string; password: string },
) {
  const isolated = (await import("@supabase/supabase-js")).createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
      import.meta.env.VITE_SUPABASE_ANON_KEY ||
      "",
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storageKey: "barkolink-password-check",
      },
    },
  );
  try {
    const { data, error } = await isolated.auth.signInWithPassword(credential);
    if (error || data.user?.id !== user.uid)
      throw error || new Error("Current password is incorrect.");
  } finally {
    await isolated.auth.signOut();
  }
}
export async function updatePassword(_user: AccountUser, password: string) {
  const { error } = await requireSupabase().auth.updateUser({ password });
  if (error) throw error;
}
