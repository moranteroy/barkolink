<template>
  <ion-page>
    <ion-content :fullscreen="true">
      <main class="auth-page">
        <section class="auth-art">
          <RouterLink class="brand-link" to="/"><BrandMark /></RouterLink>
          <div class="art-copy">
            <span class="auth-brand-tag">YOUR FERRY TRAVEL COMPANION</span>
            <h1>Travel smarter.<br /><em>Sail easier.</em></h1>
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
                  title="Send a password reset link to your email"
                  :disabled="resetting || submitting"
                  @click="resetPassword"
                >
                  {{ resetting ? "Sending reset link..." : "Forgot your password?" }}
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
    recoveryMessage.value = "";
    password.value = "";
    confirmPassword.value = "";
    showPassword.value = false;
  },
);

async function resetPassword() {
  if (resetting.value || submitting.value) return;
  errorMessage.value = "";
  recoveryMessage.value = "";
  if (!email.value.trim()) {
    errorMessage.value = "Enter your email address first.";
    return;
  }
  resetting.value = true;
  try {
    await sendPasswordResetEmail(requireAuth(), email.value.trim());
    recoveryMessage.value =
      "Password reset instructions were sent to your email.";
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
        recoveryMessage.value =
          "Account created. Check your email to confirm your account, then sign in.";
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
    await router.replace(String(route.query.redirect || defaultDestination));
  } catch (error) {
    const code = (error as { code?: string }).code;
    const message = (error as { message?: string }).message;
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
.auth-page {
  display: grid;
  grid-template-columns: 1fr 1fr;
  min-height: 100vh;
  color: var(--ink);
  background: var(--page-background);
}
.auth-art {
  position: relative;
  overflow: hidden;
  padding: 42px clamp(28px, 5vw, 82px);
  background: linear-gradient(150deg, #0b2543, #124d69 65%, #147b86);
  color: white;
  display: flex;
  flex-direction: column;
}
.brand-link {
  display: inline-flex;
  text-decoration: none;
  align-self: flex-start;
}
.auth-art :deep(.brand-copy strong),
.auth-art :deep(.brand-copy b) {
  color: #fff;
}
.auth-art :deep(.brand-copy small) {
  color: #c5dfe9;
}
.art-copy {
  position: relative;
  z-index: 1;
  margin-top: clamp(50px, 10vh, 110px);
  max-width: 440px;
}
.kicker {
  margin: 0;
  color: var(--ocean);
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.15em;
}
.art-copy .kicker {
  color: #a2e3e4;
}
.art-copy h1 {
  margin: 20px 0;
  font-size: clamp(42px, 4.5vw, 64px);
  line-height: 1.06;
  letter-spacing: -0.055em;
}
.art-copy em {
  color: #a4e5e5;
  font-style: normal;
}
.art-copy > p:last-child {
  max-width: 350px;
  color: #d0e4ee;
  font-size: 15px;
  line-height: 1.75;
}
.auth-benefits {
  display: flex;
  flex-wrap: wrap;
  gap: 15px;
  margin-top: 20px;
  color: #e2f1f6;
  font-size: 12px;
}
.auth-benefits span {
  display: flex;
  align-items: center;
  gap: 7px;
}
.auth-benefits ion-icon {
  color: #a4e5e5;
  font-size: 18px;
}
.auth-ferry {
  width: min(100%, 510px);
  margin: auto auto 0;
  min-height: 160px;
  max-height: 300px;
  opacity: 0.93;
}
.auth-form {
  display: grid;
  place-items: center;
  padding: 40px clamp(20px, 4vw, 64px);
}
.form-inner {
  width: min(100%, 460px);
  padding: 34px;
  border-radius: 26px;
}
.mobile-back {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 28px;
  color: var(--muted);
  font-size: 12px;
  text-decoration: none;
}
.mobile-back ion-icon {
  font-size: 18px;
}
.form-heading {
  margin-bottom: 26px;
}
.form-heading h1 {
  margin: 12px 0 9px;
  font-size: 34px;
  letter-spacing: -0.045em;
  line-height: 1.1;
}
.form-heading > p:last-child {
  margin: 0;
  color: var(--muted);
  font-size: 14px;
  line-height: 1.6;
}
form {
  display: grid;
  gap: 18px;
}
form > label:not(.check) {
  display: grid;
  gap: 9px;
  font-size: 12px;
  font-weight: 800;
}
input:not([type="checkbox"]) {
  width: 100%;
  height: 50px;
  padding: 0 14px;
  border: 1px solid var(--line);
  border-radius: 12px;
  outline: none;
  background: var(--surface);
  color: var(--ink);
  font: inherit;
  font-size: 14px;
}
input::placeholder {
  color: var(--muted);
}
input:focus {
  border-color: var(--ocean);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--ocean) 14%, transparent);
}
.password-field {
  position: relative;
}
.password-field input {
  padding-right: 48px;
}
.visibility-button {
  position: absolute;
  top: 0;
  right: 3px;
  display: grid;
  place-items: center;
  width: 44px;
  height: 50px;
  border: 0;
  background: transparent;
  color: var(--muted);
  font-size: 20px;
  cursor: pointer;
}
.form-options {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  margin-top: -8px;
  margin-bottom: -4px;
}
.check {
  display: flex !important;
  align-items: flex-start;
  gap: 10px;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.6;
}
.check input {
  flex: none;
  width: 17px;
  height: 17px;
  margin: 2px 0 0;
  accent-color: var(--action);
}
.check a {
  color: var(--ocean);
  font-weight: 700;
}
.text-button {
  min-height: 32px;
  padding: 6px 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--ocean);
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
.text-button:hover:not(:disabled) {
  text-decoration: underline;
  text-underline-offset: 3px;
}
.text-button:focus-visible {
  outline: 2px solid var(--ocean);
  outline-offset: 4px;
}
.text-button:disabled {
  opacity: 0.6;
  cursor: default;
}
.submit-button {
  --background: var(--action);
  --color: #fff;
  --box-shadow: none;
  --border-radius: 12px;
  height: 50px;
  margin: 2px 0;
  text-transform: none;
  font-weight: 800;
}
.form-message {
  margin: 0;
  color: #c43c47;
  font-size: 12px;
  line-height: 1.6;
}
.recovery-note {
  margin: 0;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--surface);
  color: var(--ink);
  font-size: 12px;
  line-height: 1.6;
}
.switch-copy {
  margin: 24px 0;
  text-align: center;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.6;
}
.switch-copy a {
  color: var(--ocean);
  font-weight: 800;
  text-decoration: none;
}
.prototype-box {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  border-top: 1px solid var(--line);
}
.prototype-icon {
  display: grid;
  place-items: center;
  flex: none;
  width: 36px;
  height: 36px;
  border-radius: 12px;
  background: var(--light-blue);
  color: var(--ocean);
  font-size: 19px;
}
.prototype-box strong {
  font-size: 12px;
}
.prototype-box p {
  margin: 5px 0 0;
  color: var(--muted);
  font-size: 11px;
  line-height: 1.6;
}
@media (max-width: 800px) {
  .auth-page {
    grid-template-columns: 1fr;
  }
  .auth-art {
    padding: 24px 28px;
  }
  .art-copy {
    margin-top: 24px;
    max-width: 100%;
  }
  .art-copy h1 {
    font-size: 33px;
    margin: 12px 0;
  }
  .art-copy h1 br {
    display: none;
  }
  .art-copy > p:last-child {
    max-width: 480px;
    font-size: 13px;
  }
  .auth-benefits,
  .auth-ferry {
    display: none;
  }
  .auth-form {
    padding: 24px 18px 40px;
  }
  .form-inner {
    padding: 28px 24px;
  }
  .mobile-back {
    margin-bottom: 22px;
  }
  .form-heading h1 {
    font-size: 30px;
  }
}
@media (max-width: 380px) {
  .form-inner {
    padding: 24px 18px;
  }
  .form-heading h1 {
    font-size: 27px;
  }
}

.auth-page {
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  background: var(--surface, #fff);
}
.auth-art {
  padding: 48px clamp(32px, 5vw, 80px);
  background: linear-gradient(155deg, #0d2748 0%, #1262a0 60%, #249ace 100%);
  min-height: 100vh;
}
.auth-art::after {
  content: "";
  position: absolute;
  width: 650px;
  height: 650px;
  bottom: -420px;
  left: -100px;
  border: 1px solid #ffffff24;
  border-radius: 50%;
  box-shadow:
    0 0 0 80px #ffffff08,
    0 0 0 160px #ffffff05;
  pointer-events: none;
}
.auth-brand-tag {
  display: inline-block;
  padding: 8px 12px;
  border: 1px solid #ffffff38;
  border-radius: 30px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: #daefff;
}
.art-copy {
  margin-top: auto;
  padding-top: 80px;
}
.art-copy h1 {
  font-size: clamp(40px, 4vw, 60px);
  letter-spacing: -0.045em;
  line-height: 1.15;
  margin: 22px 0;
}
.art-copy em {
  color: #a7deff;
}
.art-copy > p:last-child {
  max-width: 360px;
  font-size: 15px;
}
.auth-benefits {
  position: relative;
  z-index: 1;
  gap: 22px;
  margin: 30px 0 0;
}
.auth-ferry {
  max-height: 230px;
  margin: 24px auto 0;
}
.auth-form {
  padding: 40px 30px;
  background: var(--surface, #fff);
}
.form-inner {
  padding: 0;
  width: min(100%, 400px);
  border: 0;
  background: none;
  box-shadow: none;
  border-radius: 0;
}
.mobile-back {
  margin-bottom: 24px;
}
.auth-mobile-brand {
  display: none;
}
.auth-mode-tabs {
  display: flex;
  padding: 4px;
  gap: 4px;
  background: var(--page-background);
  border: 1px solid var(--line);
  border-radius: 11px;
  margin-bottom: 30px;
}
.auth-mode-tabs a {
  flex: 1;
  text-align: center;
  padding: 10px;
  border-radius: 8px;
  color: var(--muted);
  font-size: 13px;
  font-weight: 700;
  text-decoration: none;
}
.auth-mode-tabs a.selected {
  color: #1676c9;
  background: var(--surface);
  box-shadow: 0 1px 4px #122a4412;
}
.form-heading {
  margin-bottom: 25px;
}
.form-heading h1 {
  margin: 0 0 10px;
  font-size: 28px;
  letter-spacing: -0.035em;
}
.form-heading > p:last-child {
  font-size: 13px;
}
.form-inner form {
  gap: 16px;
}
.form-inner input:not([type="checkbox"]) {
  border-radius: 9px;
  height: 47px;
  font-size: 13px;
  background: var(--surface);
}
.visibility-button {
  height: 47px;
}
.submit-button {
  --background: #157bce;
  --border-radius: 9px;
  height: 47px;
  letter-spacing: 0;
  font-size: 13px;
}
.prototype-box {
  padding: 18px 0 0;
  gap: 10px;
}
.prototype-icon {
  background: #eaf5ff;
  color: #157bce;
  border-radius: 9px;
}
.switch-copy {
  font-size: 13px;
  margin: 23px 0;
}
@media (max-width: 800px) {
  .auth-page {
    display: block;
    min-height: 100vh;
  }
  .auth-art {
    display: none;
  }
  .auth-form {
    min-height: 100vh;
    padding: 26px 22px 40px;
    align-items: center;
  }
  .form-inner {
    width: min(100%, 420px);
  }
  .auth-mobile-brand {
    display: block;
    margin: 0 0 24px;
  }
  .auth-mode-tabs {
    margin-bottom: 27px;
  }
  .mobile-back {
    margin-bottom: 24px;
  }
  .form-heading h1 {
    font-size: 27px;
  }
}
</style>
