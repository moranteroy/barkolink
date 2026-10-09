<template>
  <ion-page>
    <ion-content :fullscreen="true">
      <main class="auth-page">
        <section class="auth-art">
          <RouterLink class="brand-link" to="/"><BrandMark /></RouterLink>
          <div class="art-copy">
            <span class="auth-brand-tag">YOUR FERRY TRAVEL COMPANION</span>
            <h2>Travel smarter.<br /><em>Sail easier.</em></h2>
            <p>
              Book your crossing, manage your tickets, and stay updated from
              departure to arrival.
            </p>
          </div>
          <div class="auth-benefits">
            <span><ion-icon :icon="searchOutline" /> Simple trip search</span
            ><span
              ><ion-icon :icon="ticketOutline" /> Tickets in one place</span
            >
          </div>
          <FerryIllustration class="auth-ferry" />
        </section>

        <section class="auth-form">
          <div class="form-inner">
            <RouterLink class="mobile-back" to="/" aria-label="Back to home"
              ><ion-icon :icon="homeOutline" aria-hidden="true" /> Back to
              home</RouterLink
            >
            <div class="auth-mobile-brand"><BrandMark /></div>
            <div class="auth-mode-tabs" aria-label="Account access">
              <RouterLink
                :to="authLocation('/login')"
                :class="{ selected: !isRegister }"
                :aria-current="!isRegister ? 'page' : undefined"
                >Sign in</RouterLink
              ><RouterLink
                :to="authLocation('/register')"
                :class="{ selected: isRegister }"
                :aria-current="isRegister ? 'page' : undefined"
                >Create account</RouterLink
              >
            </div>
            <div class="form-heading">
              <h1>{{ isRegister ? "Create your account" : "Welcome back" }}</h1>
              <p>
                {{
                  isRegister
                    ? "Create your account to book trips and access your tickets."
                    : "Sign in to manage your trips and tickets."
                }}
              </p>
            </div>
            <form @submit.prevent="submit">
              <label v-if="isRegister" for="full-name"
                >Full name<input
                  id="full-name"
                  v-model.trim="fullName"
                  autocomplete="name"
                  name="name"
                  placeholder="Juan Dela Cruz"
                  required
              /></label>
              <label for="email"
                >Email address<input
                  id="email"
                  v-model.trim="email"
                  autocomplete="email"
                  name="email"
                  type="email"
                  placeholder="juan@example.com"
                  required
              /></label>
              <label for="password"
                >Password
                <div class="password-field">
                  <input
                    id="password"
                    v-model="password"
                    :autocomplete="
                      isRegister ? 'new-password' : 'current-password'
                    "
                    name="password"
                    :type="showPassword ? 'text' : 'password'"
                    :placeholder="
                      isRegister
                        ? 'At least 8 characters'
                        : 'Enter your password'
                    "
                    :minlength="isRegister ? 8 : 6"
                    required
                  /><button
                    class="visibility-button"
                    type="button"
                    :aria-label="
                      showPassword ? 'Hide password' : 'Show password'
                    "
                    @click="showPassword = !showPassword"
                  >
                    <ion-icon
                      :icon="showPassword ? eyeOffOutline : eyeOutline"
                    />
                  </button></div
              ></label>
              <label v-if="isRegister" for="confirm-password"
                >Confirm password<input
                  id="confirm-password"
                  v-model="confirmPassword"
                  autocomplete="new-password"
                  name="confirm-password"
                  type="password"
                  placeholder="Re-enter your password"
                  minlength="8"
                  required
              /></label>
              <p v-if="errorMessage" class="form-message" role="alert">
                {{ errorMessage }}
              </p>
              <div v-if="!isRegister" class="form-options">
                <button
                  class="text-button"
                  type="button"
                  title="Send a password reset code to your email"
                  :disabled="resetting || submitting"
                  @click="resetPassword"
                >
                  {{ resetting ? "Sending reset code..." : "Forgot your password?" }}
                </button>
              </div>
              <p v-if="recoveryMessage" class="recovery-note" role="status">
                {{ recoveryMessage }}
              </p>
              <label v-if="isRegister" class="check terms" for="terms"
                ><input
                  id="terms"
                  v-model="acceptedTerms"
                  type="checkbox"
                  required
                /><span
                  >I have read the
                  <RouterLink :to="privacyLocation">Privacy notice</RouterLink>.</span
                ></label
              >
              <ion-button
                type="submit"
                expand="block"
                class="submit-button"
                :disabled="submitting || resetting"
                >{{
                  submitting
                    ? isRegister
                      ? "Creating account..."
                      : "Signing in..."
                    : isRegister
                      ? "Create account"
                      : "Sign in"
                }}
                <ion-icon slot="end" :icon="isRegister ? personAddOutline : logInOutline" aria-hidden="true"
              /></ion-button>
            </form>
            <p class="switch-copy">
              {{
                isRegister
                  ? "Already have an account?"
                  : "Don't have an account?"
              }}
              <RouterLink :to="authLocation(isRegister ? '/login' : '/register')">{{
                isRegister ? "Sign in" : "Create account"
              }}</RouterLink>
            </p>
            <div class="prototype-box">
              <span class="prototype-icon"
                ><ion-icon :icon="shieldCheckmarkOutline"
              /></span>
              <div>
                <strong>One account. Every crossing.</strong>
                <p>
                  Keep your reservations, tickets, and travel updates together.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import { IonButton, IonContent, IonIcon, IonPage } from "@ionic/vue";
import {
  homeOutline,
  personAddOutline,
  logInOutline,
  shieldCheckmarkOutline,
  eyeOffOutline,
  eyeOutline,
  searchOutline,
  ticketOutline,
} from "ionicons/icons";
import {
  registerAccount,
  sendPasswordResetEmail,
  resendEmailCode,
  signInWithPassword,
  updateAccountProfile,
} from "../../services/auth";
import BrandMark from "../../components/shared/BrandMark.vue";
import FerryIllustration from "../../components/shared/FerryIllustration.vue";
import { createMyProfile, myProfile } from "../../services/database/passenger";
import { database, requireAuth } from "../../services/session";
import { resolveAccountRole, roleDestination } from "../../data/sessionRole";
import { databaseRequestError } from "../../data/databaseErrors";

const route = useRoute();
const router = useRouter();
const isRegister = computed(() => route.path === "/register");
function authLocation(path: '/login' | '/register') {
  return { path, query: typeof route.query.redirect === 'string' ? { redirect: route.query.redirect } : {} };
}
const privacyLocation = computed(() => ({
  path: '/privacy',
  query: { ...authLocation('/register').query, from: 'register' },
}));
const fullName = ref("");
const email = ref("");
const password = ref("");
const confirmPassword = ref("");
const acceptedTerms = ref(false);
const submitting = ref(false);
const resetting = ref(false);
const showPassword = ref(false);
const errorMessage = ref(String(route.query.sessionError || ""));
const recoveryMessage = ref("");
if (route.query.verified === '1') recoveryMessage.value = 'Email verified. Sign in to continue.';

watch(
  () => route.fullPath,
  (next, previous) => {
    // Ionic keeps the registration form in memory during the privacy detour.
    // Preserve its fields until the user returns to acknowledge the notice.
    const nextPath = next.split('?')[0];
    const previousPath = previous.split('?')[0];
    if ((previousPath === '/register' && nextPath === '/privacy') ||
        (previousPath === '/privacy' && nextPath === '/register')) {
      showPassword.value = false;
      return;
    }
    errorMessage.value = String(route.query.sessionError || "");
    recoveryMessage.value = nextPath === '/login' && route.query.verified === '1' ? 'Email verified. Sign in to continue.' : '';
    password.value = "";
    confirmPassword.value = "";
    showPassword.value = false;
  },
);

async function resetPassword() {
  if (resetting.value || submitting.value) return;
  errorMessage.value = "";
  recoveryMessage.value = "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) {
    errorMessage.value = "Enter a valid email address first.";
    return;
  }
  resetting.value = true;
  try {
    sessionStorage.removeItem('barkolink-password-recovery');
    await sendPasswordResetEmail(requireAuth(), email.value.trim());
    sessionStorage.setItem('barkolink-pending-email', JSON.stringify({ email: email.value.trim(), purpose: 'recovery' }));
    await router.replace({ path: '/verify-email', query: { purpose: 'recovery' } });
  } catch (error) {
    errorMessage.value =
      (error as { message?: string }).message ||
      "Could not send password reset email.";
  } finally {
    resetting.value = false;
  }
}

async function submit() {
  if (submitting.value || resetting.value) return;
  errorMessage.value = "";
  if (isRegister.value && password.value !== confirmPassword.value) {
    errorMessage.value = "Passwords do not match. Please check and try again.";
    return;
  }
  if (isRegister.value && !acceptedTerms.value) {
    errorMessage.value = "Read and acknowledge the privacy notice to continue.";
    return;
  }
  submitting.value = true;
  let stage: "authentication" | "profile" | "navigation" = "authentication";
  let createdAuthAccount = false;
  try {
    const auth = requireAuth();
    if (!database) throw new Error("Supabase database is not configured.");
    let defaultDestination = "/home";
    if (isRegister.value) {
      const credential = await registerAccount(
        auth,
        email.value,
        password.value,
        fullName.value,
      );
      createdAuthAccount = true;
      if (!credential.session) {
        sessionStorage.setItem('barkolink-pending-email', JSON.stringify({ email: email.value.trim(), purpose: 'signup' }));
        password.value = ''; confirmPassword.value = '';
        await router.replace({ path: '/verify-email', query: { ...authLocation('/register').query, purpose: 'signup' } });
        return;
      }
      stage = "profile";
      await updateAccountProfile(credential.user, {
        displayName: fullName.value,
      });
      await createMyProfile(database, {
        email: credential.user.email || email.value,
        fullName: fullName.value,
      });
    } else {
      const credential = await signInWithPassword(
        auth,
        email.value,
        password.value,
      );
      const token = await credential.user.getRoleSession(true);
      const claimedRole = token.claims.role
        ? resolveAccountRole(token.claims.role)
        : null;
      if (claimedRole && claimedRole !== "PASSENGER") {
        defaultDestination = roleDestination(claimedRole);
      } else {
        stage = "profile";
        const profile = await myProfile(database, {
          fetchPolicy: "SERVER_ONLY",
        });
        if (!profile.data.user) {
          await createMyProfile(database, {
            email: credential.user.email || email.value,
            fullName: credential.user.displayName || email.value.split("@")[0],
          });
        } else {
          defaultDestination = roleDestination(
            resolveAccountRole(token.claims.role, profile.data.user.role),
          );
        }
      }
    }
    stage = "navigation";
    // A completed sign-in starts a new navigation stack. Ionic treats replace as
    // a root transition, so the passenger frame can resize before /home renders.
    const requestedDestination = String(route.query.redirect || defaultDestination);
    await router.replace(requestedDestination.split('?')[0] === '/verify-email' ? defaultDestination : requestedDestination);
  } catch (error) {
    const code = (error as { code?: string }).code;
    const message = (error as { message?: string }).message;
    if (code === 'email_not_confirmed' && !isRegister.value) {
      try {
        await resendEmailCode(email.value.trim(), 'signup');
        sessionStorage.setItem('barkolink-pending-email', JSON.stringify({ email: email.value.trim(), purpose: 'signup' }));
        await router.replace({ path: '/verify-email', query: { ...authLocation('/register').query, purpose: 'signup' } });
      } catch {
        errorMessage.value = 'Your email still needs verification, but a new code could not be sent. Wait a minute and try signing in again.';
      }
      return;
    }
    const errors: Record<string, string> = {
      "auth/email-already-in-use":
        "An account already uses this email. Sign in instead.",
      "auth/invalid-credential":
        "That email and password do not match an account.",
      "auth/invalid-email": "Enter a valid email address.",
      "auth/weak-password":
        "Choose a stronger password with at least 8 characters.",
      "auth/network-request-failed":
        "Could not reach Supabase. Check your internet connection and try again.",
      invalid_credentials: "That email and password do not match an account.",
      email_not_confirmed: "Confirm your email address before signing in.",
      user_already_exists:
        "An account already uses this email. Sign in instead.",
      weak_password: "Choose a stronger password with at least 8 characters.",
      over_email_send_rate_limit:
        "Too many email requests. Wait a moment and try again.",
    };
    errorMessage.value =
      (code && errors[code]) ||
      databaseRequestError(error, "") ||
      (message?.includes("Supabase is not configured")
        ? "Supabase is not configured yet. Add the project URL and publishable key to .env.local to enable sign in."
        : createdAuthAccount && stage === "profile"
          ? "Your account was created, but the passenger profile could not be saved. Sign in to finish setup."
          : stage === "profile"
            ? "Supabase sign-in succeeded, but your passenger profile could not be loaded. Please try again."
            : stage === "navigation"
              ? "Sign-in succeeded, but the destination page could not be opened. Please try again."
              : "We could not complete sign in. Please check your email and password.");
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped>
.auth-page { display: grid; grid-template-columns: minmax(0, .95fr) minmax(0, 1.05fr); min-height: 100vh; min-height: 100dvh; color: var(--ink); background: var(--surface-soft); line-height: 1.6; }
.auth-art { position: sticky; top: 0; display: flex; flex-direction: column; height: 100vh; height: 100dvh; min-height: 600px; overflow: hidden; padding: 36px clamp(28px, 4.5vw, 72px); background: radial-gradient(ellipse at bottom right, #229ab055, transparent 65%), linear-gradient(150deg, #0b2948, #0d6584); color: #fff; }
.auth-art::after { content: ''; position: absolute; width: 650px; height: 650px; bottom: -460px; left: -180px; border: 1px solid #ffffff24; border-radius: 50%; box-shadow: 0 0 0 80px #ffffff08, 0 0 0 160px #ffffff05; pointer-events: none; }
.brand-link { display: inline-flex; align-self: flex-start; text-decoration: none; }
.auth-art :deep(.brand-copy strong), .auth-art :deep(.brand-copy b) { color: #fff; }
.auth-art :deep(.brand-copy small) { color: #d0e6f2; }
.art-copy { position: relative; z-index: 1; margin-top: auto; padding-top: 36px; max-width: 440px; }
.auth-brand-tag { display: inline-block; padding: 7px 12px; border: 1px solid #ffffff38; border-radius: 30px; color: #daefff; font-size: 10px; font-weight: 700; letter-spacing: .08em; }
.art-copy h2 { margin: 22px 0 18px; font-size: clamp(40px, 4.2vw, 60px); font-weight: 800; letter-spacing: -.045em; line-height: 1.1; }
.art-copy em { color: #b7eef5; font-style: normal; }
.art-copy p { max-width: 370px; margin: 0; color: #deedf4; font-size: 16px; line-height: 1.8; }
.auth-benefits { position: relative; z-index: 1; display: flex; flex-wrap: wrap; gap: 16px; margin-top: 24px; color: #e2f1f6; font-size: 13px; }
.auth-benefits span { display: inline-flex; align-items: center; gap: 7px; }
.auth-benefits ion-icon { color: #b7eef5; font-size: 18px; }
.auth-ferry { position: relative; z-index: 1; width: min(100%, 390px); min-height: 120px; max-height: 200px; margin: 24px auto auto; }
.auth-form { min-width: 0; display: grid; place-items: center; padding: 28px clamp(24px, 4vw, 64px); }
.form-inner { width: min(100%, 460px); padding: 28px 32px; border: 1px solid var(--line); border-radius: 24px; background: var(--surface); box-shadow: 0 16px 48px #0a29480a; }
.mobile-back { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; margin: -8px 0 12px; color: var(--muted); font-size: 13px; text-decoration: none; }
.mobile-back:hover { color: var(--ocean); }
.mobile-back ion-icon { font-size: 18px; }
.auth-mobile-brand { display: none; }
.auth-mode-tabs { display: flex; gap: 4px; padding: 4px; margin-bottom: 24px; border: 1px solid var(--line); border-radius: 12px; background: var(--surface-soft); }
.auth-mode-tabs a { display: flex; align-items: center; justify-content: center; flex: 1; min-height: 44px; padding: 8px; border-radius: 8px; color: var(--muted); font-size: 13px; font-weight: 650; text-decoration: none; }
.auth-mode-tabs a.selected { color: var(--ocean); background: var(--light-blue); box-shadow: 0 1px 4px #122a4410; }
.form-heading { margin-bottom: 24px; }
.form-heading h1 { margin: 0 0 8px; font-size: clamp(26px, 2.6vw, 32px); font-weight: 750; letter-spacing: -.035em; line-height: 1.2; }
.form-heading p { margin: 0; color: var(--muted); font-size: 14px; line-height: 1.7; }
form { display: grid; gap: 16px; }
form > label:not(.check) { display: grid; gap: 7px; font-size: 13px; font-weight: 650; }
input:not([type='checkbox']) { width: 100%; min-width: 0; height: 50px; padding: 0 14px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface-soft); color: var(--ink); font: inherit; font-size: 16px; font-weight: 400; }
input::placeholder { color: var(--muted); opacity: .85; font-weight: 400; }
input:focus { outline: none; border-color: var(--ocean); box-shadow: 0 0 0 3px color-mix(in srgb, var(--ocean) 14%, transparent); }
.password-field { position: relative; }
.password-field input { padding-right: 50px; }
.visibility-button { position: absolute; top: 3px; right: 3px; display: grid; place-items: center; width: 44px; height: 44px; padding: 0; border: 0; border-radius: 8px; background: transparent; color: var(--muted); font-size: 20px; cursor: pointer; }
.visibility-button:hover { color: var(--ocean); background: var(--light-blue); }
.form-options { display: flex; justify-content: flex-end; margin-top: -8px; margin-bottom: -8px; }
.text-button { min-height: 44px; padding: 8px 0; border: 0; border-radius: 4px; background: transparent; color: var(--ocean); font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; }
.text-button:hover:not(:disabled) { text-decoration: underline; text-underline-offset: 3px; }
.text-button:disabled { opacity: .6; cursor: default; }
.check { display: flex; align-items: flex-start; gap: 10px; color: var(--muted); font-size: 13px; line-height: 1.7; }
.check input { flex: none; width: 20px; height: 20px; margin: 1px 0 0; accent-color: var(--action); }
.check a { color: var(--ocean); font-weight: 600; text-underline-offset: 3px; }
.submit-button { --background: var(--action); --color: #fff; --box-shadow: none; --border-radius: 10px; height: 50px; margin: 0; font-size: 14px; font-weight: 700; letter-spacing: 0; text-transform: none; }
.form-message { margin: 0; padding: 10px 12px; border: 1px solid #c43c4740; border-radius: 10px; background: #c43c470a; color: #ae2637; font-size: 13px; line-height: 1.6; }
.recovery-note { margin: 0; padding: 12px; border: 1px solid var(--line); border-radius: 10px; background: var(--light-blue); color: var(--ink); font-size: 13px; line-height: 1.6; }
.switch-copy { margin: 20px 0; text-align: center; color: var(--muted); font-size: 13px; line-height: 1.7; }
.switch-copy a { display: inline-block; padding-block: 4px; color: var(--ocean); font-weight: 700; text-decoration: none; }
.switch-copy a:hover { text-decoration: underline; text-underline-offset: 3px; }
.prototype-box { display: flex; align-items: center; gap: 12px; padding-top: 18px; border-top: 1px solid var(--line); }
.prototype-icon { display: grid; place-items: center; flex: none; width: 38px; height: 38px; border-radius: 10px; background: var(--light-blue); color: var(--ocean); font-size: 21px; }
.prototype-box strong { font-size: 13px; font-weight: 650; }
.prototype-box p { margin: 3px 0 0; color: var(--muted); font-size: 12px; line-height: 1.7; }
.auth-page :is(a, button):focus-visible { outline: 3px solid var(--ocean); outline-offset: 3px; }
.auth-art a:focus-visible { outline-color: #b7eef5; }
:global(:root[data-theme='dark']) .auth-page { --surface: #132439; --surface-soft: #0e1c2e; --line: #2b4056; --muted: #b2c3d3; --light-blue: #183752; }
:global(:root[data-theme='dark']) .form-message { color: #ffadb6; }
@media (max-width: 1050px) { .auth-art { padding-inline: 28px; } .auth-form { padding-inline: 24px; } .form-inner { padding: 24px; } }
@media (max-height: 740px) and (min-width: 801px) { .auth-art { min-height: 540px; padding-block: 24px; } .art-copy { padding-top: 24px; } .art-copy h2 { font-size: 44px; } .auth-ferry { max-height: 150px; margin-top: 16px; } .auth-benefits { margin-top: 16px; } }
@media (max-width: 800px) { .auth-page { grid-template-columns: 1fr; } .auth-art { display: none; } .auth-form { min-height: 100vh; min-height: 100dvh; padding: max(20px, env(safe-area-inset-top)) 20px max(24px, env(safe-area-inset-bottom)); } .form-inner { width: min(100%, 460px); padding: 24px; } .auth-mobile-brand { display: block; margin-bottom: 22px; } .mobile-back { margin-bottom: 16px; } }
@media (max-width: 480px) { .auth-form { align-items: start; padding-inline: 20px; background: var(--surface); } .form-inner { padding: 0; border: 0; border-radius: 0; box-shadow: none; } .auth-mode-tabs { margin-bottom: 22px; } .form-heading { margin-bottom: 22px; } }
</style>
