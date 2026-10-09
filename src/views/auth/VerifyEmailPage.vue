<template>
  <IonPage><IonContent><main class="verification-page">
    <RouterLink to="/" class="brand"><BrandMark /></RouterLink>
    <section class="verification-card">
      <RouterLink :to="purpose === 'signup' ? '/register' : '/login'" class="back">Back to {{ purpose === 'signup' ? 'create account' : 'sign in' }}</RouterLink>
      <span class="mail-icon"><IonIcon :icon="mailOutline" aria-hidden="true" /></span>
      <h1>{{ purpose === 'signup' ? 'Verify your email' : 'Check your email' }}</h1>
      <p v-if="email">{{ purpose === 'signup' ? 'Enter the code sent to' : 'If an account exists, a reset code was sent to' }} <strong>{{ email }}</strong>.</p>
      <p v-else role="alert">Start from registration or forgot password to request a code.</p>
      <form v-if="email" @submit.prevent="verify">
        <label for="email-code">Email verification code</label>
        <input id="email-code" v-model.trim="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6,10}" minlength="6" maxlength="10" placeholder="Enter your code" required :disabled="busy || verified" />
        <p v-if="error" role="alert" class="error">{{ error }}</p>
        <p v-if="notice" role="status">{{ notice }}</p>
        <IonButton expand="block" type="submit" :disabled="busy">{{ busy ? 'Please wait…' : verified ? 'Continue' : 'Verify code' }}</IonButton>
      </form>
      <div v-if="email && !verified" class="resend"><span>Didn't receive a code? Check Spam.</span><button type="button" :disabled="busy || remaining > 0" @click="resend">{{ remaining > 0 ? `Resend in ${remaining}s` : 'Resend code' }}</button></div>
    </section>
  </main></IonContent></IonPage>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import { IonPage, IonContent, IonButton, IonIcon, onIonViewWillEnter } from '@ionic/vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { mailOutline } from 'ionicons/icons';
import BrandMark from '../../components/shared/BrandMark.vue';
import { verifyEmailCode, resendEmailCode, signOut, requireAuth } from '../../services/auth';
import { database } from '../../services/session';
import { myProfile, createMyProfile } from '../../services/database/passenger';
const route = useRoute(), router = useRouter();
const purpose = computed(() => route.query.purpose === 'recovery' ? 'recovery' : 'signup');
function pendingEmail() {
  try { const pending = JSON.parse(sessionStorage.getItem('barkolink-pending-email') || '{}'); return pending.purpose === purpose.value && typeof pending.email === 'string' ? pending.email : ''; }
  catch { return ''; }
}
const email = ref(pendingEmail());
const code = ref(''), busy = ref(false), error = ref(''), notice = ref(''), verified = ref(false), remaining = ref(60);
const timer = window.setInterval(() => { if (remaining.value > 0) remaining.value--; }, 1000);
onBeforeUnmount(() => window.clearInterval(timer));
onIonViewWillEnter(() => { email.value = pendingEmail(); code.value = ''; error.value = ''; notice.value = ''; verified.value = false; remaining.value = 60; });
async function verify() {
  if (busy.value || !email.value) return;
  if (!verified.value && !/^\d{6,10}$/.test(code.value)) { error.value = 'Enter the numeric code from your email.'; return; }
  busy.value = true; error.value = ''; notice.value = '';
  try {
    if (!verified.value) { await verifyEmailCode(email.value, code.value, purpose.value); verified.value = true; code.value = ''; }
    if (purpose.value === 'recovery') { await router.replace('/reset-password'); return; }
    const user = requireAuth().currentUser;
    if (!database || !user) throw new Error('Your email was verified. Sign in to finish account setup.');
    const profile = await myProfile(database, { fetchPolicy: 'SERVER_ONLY' });
    if (!profile.data.user) await createMyProfile(database, { email: user.email || email.value, fullName: user.displayName || email.value.split('@')[0] });
    await signOut(requireAuth());
    sessionStorage.removeItem('barkolink-pending-email');
    await router.replace({ path: '/login', query: { ...(typeof route.query.redirect === 'string' ? { redirect: route.query.redirect } : {}), verified: '1' } });
  } catch (failure) {
    error.value = verified.value ? (failure as Error).message : 'The code is invalid or expired. Check your email or request a new code.';
  } finally { busy.value = false; }
}
async function resend() {
  if (busy.value || remaining.value > 0) return;
  busy.value = true; error.value = ''; notice.value = '';
  try { await resendEmailCode(email.value, purpose.value); remaining.value = 60; code.value = ''; notice.value = 'A new code was requested. Check your inbox and Spam folder.'; }
  catch { error.value = 'Could not resend the code. Wait a moment and try again.'; }
  finally { busy.value = false; }
}
</script>
<style scoped>
.verification-page { max-width: 480px; margin: 40px auto; padding: 20px; color: var(--ink); }
.brand { display: inline-flex; margin-bottom: 24px; text-decoration: none; }
.verification-card { padding: 28px; border: 1px solid var(--line); border-radius: 20px; background: var(--surface); }
.back { display: inline-flex; min-height: 44px; color: var(--muted); font-size: 13px; text-decoration: none; }
.mail-icon { display: grid; place-items: center; width: 48px; height: 48px; margin-top: 12px; border-radius: 14px; background: var(--light-blue); color: var(--ocean); font-size: 24px; }
h1 { margin: 20px 0 10px; font-size: 28px; } p { color: var(--muted); font-size: 14px; line-height: 1.7; overflow-wrap: anywhere; }
form { display: grid; gap: 12px; margin-top: 24px; } label { font-size: 13px; font-weight: 650; }
input { width: 100%; min-width: 0; height: 52px; padding: 12px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface-soft); color: var(--ink); font-size: 18px; }
ion-button { margin: 0; height: 48px; --border-radius: 10px; text-transform: none; } .error { color: var(--danger, #c43c47); }
.resend { display: grid; gap: 8px; margin-top: 24px; text-align: center; color: var(--muted); font-size: 12px; }
button { min-height: 44px; border: 0; border-radius: 8px; background: var(--light-blue); color: var(--ocean); font: inherit; font-size: 13px; cursor: pointer; } button:disabled { opacity: .6; cursor: default; }
@media (max-width: 480px) { .verification-page { margin-top: 12px; } .verification-card { padding: 22px 18px; } }
</style>
