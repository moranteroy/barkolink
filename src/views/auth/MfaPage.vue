<template>
  <ion-page>
    <ion-content>
      <main class="mfa-page">
        <section
          class="mfa-panel"
          :class="{ 'is-enrolling': qr }"
          aria-labelledby="mfa-title"
          :aria-busy="busy"
        >
          <header class="mfa-header">
            <BrandMark />
            <span class="security-badge"
              ><svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                aria-hidden="true"
              >
                <path d="M12 3 4 6v6c0 4 4 7 8 9 4-2 8-5 8-9V6l-8-3Z" />
                <path d="m8.5 12 2.5 2.5 4.5-5" />
              </svg>
              Secure sign-in</span
            >
          </header>
          <div class="mfa-heading">
            <p class="eyebrow">Two-step verification</p>
            <h1 id="mfa-title">
              {{ qr ? `Set up ${accessLabel} verification` : `Verify ${accessLabel} access` }}
            </h1>
            <p>
              {{
                qr
                  ? 'Connect an authenticator app to secure your account.'
                  : `Enter the six-digit code from your authenticator app to continue to your ${workspaceLabel}.`
              }}
            </p>
          </div>
          <p v-if="busy && !factorId" class="loading-message" role="status">
            Preparing secure verification…
          </p>
          <div class="mfa-body">
            <section v-if="qr" class="setup-section" aria-labelledby="setup-title">
              <h2 id="setup-title">
                <span class="step-number">1</span> Connect your authenticator
              </h2>
              <p>Scan with your authenticator app.</p>
              <div class="qr-frame">
                <img
                  :src="qr"
                  alt="Authenticator setup QR code"
                  :width="qrSize"
                  :height="qrSize"
                  :style="{ width: `${qrSize}px` }"
                />
              </div>
              <details>
                <summary>Can’t scan? Enter setup key manually</summary>
                <p>
                  In your authenticator, choose Enter setup key. Use BarkoLink as the account name
                  and Time-based as the key type.
                </p>
                <code>{{ secret }}</code>
              </details>
            </section>
            <div class="verification-section">
              <form @submit.prevent="verify">
                <h2 v-if="qr"><span class="step-number">2</span> Confirm your setup</h2>
                <label for="authenticator-code">Authenticator code</label>
                <input
                  id="authenticator-code"
                  :value="code"
                  @input="updateCode"
                  type="text"
                  inputmode="numeric"
                  autocomplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxlength="6"
                  placeholder="000000"
                  aria-describedby="code-hint"
                  :aria-invalid="error ? true : undefined"
                  :disabled="busy || !factorId"
                  required
                />
                <p id="code-hint" class="field-hint">
                  Use the current six-digit code shown in your app.
                </p>
                <p v-if="error" class="error-message" role="alert">{{ error }}</p>
                <button
                  class="verify-button"
                  type="submit"
                  :disabled="busy || !factorId || !validCode"
                >
                  {{ busy ? 'Please wait…' : 'Verify and continue' }}
                </button>
              </form>
              <p class="recovery-note">
                Keep access to your authenticator. If you lose it, contact your system administrator
                for identity verification and recovery.
              </p>
              <button
                v-if="returningToSettings"
                class="signout-button"
                type="button"
                :disabled="busy"
                @click="cancelSetup"
              >
                Back to security settings
              </button>
              <button class="signout-button" type="button" :disabled="busy" @click="logout">
                Sign out
              </button>
            </div>
          </div>
        </section>
      </main>
    </ion-content>
  </ion-page>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { IonPage, IonContent, onIonViewWillEnter, onIonViewDidLeave } from '@ionic/vue';
import { activateAccountMfaAfterVerification } from '../../services/mfaSecurity';
import { authenticatorQr } from '../../services/authenticatorQr';
import { requireSupabase } from '../../services/supabase';
import { resolveAccountRole, roleDestination } from '../../data/sessionRole';
import type { AccountRole } from '../../data/sessionRole';
import BrandMark from '../../components/shared/BrandMark.vue';
const router = useRouter(),
  route = useRoute();
const settingsDestination = computed(() =>
  accountRole.value === 'ADMIN'
    ? '/admin/settings/password'
    : accountRole.value === 'BOARDING'
      ? '/staff/boarding/settings/security'
      : '/staff/ticketing/settings/security',
);
const returningToSettings = computed(() => route.query.returnTo === settingsDestination.value);
const code = ref(''),
  factorId = ref(''),
  qr = ref(''),
  secret = ref(''),
  error = ref(''),
  busy = ref(false);
const qrSize = ref(280);
const accountRole = ref<AccountRole | null>(null);
const accessLabel = computed(
  () =>
    ({
      ADMIN: 'admin',
      BOARDING: 'boarding staff',
      TICKETING: 'ticketing staff',
      PASSENGER: 'account',
    })[accountRole.value ?? 'PASSENGER'],
);
const workspaceLabel = computed(() =>
  accountRole.value === 'ADMIN' ? 'admin dashboard' : `${accessLabel.value} workspace`,
);
const validCode = computed(() => /^\d{6}$/.test(code.value));
function updateCode(event: Event) {
  const input = event.target as HTMLInputElement;
  code.value = input.value.replace(/\D/g, '').slice(0, 6);
  input.value = code.value;
}
function clearSetup() {
  code.value = '';
  qr.value = '';
  secret.value = '';
  factorId.value = '';
  accountRole.value = null;
}
onIonViewDidLeave(clearSetup);
onIonViewWillEnter(async () => {
  clearSetup();
  busy.value = true;
  error.value = '';
  try {
    const client = requireSupabase();
    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError || !userData.user) throw userError || new Error('Session expired');
    accountRole.value = resolveAccountRole(userData.user.app_metadata?.role);
    if (accountRole.value === 'PASSENGER') {
      await router.replace(roleDestination(accountRole.value));
      return;
    }
    const { data, error: failure } = await client.auth.mfa.listFactors();
    if (failure) throw failure;
    const verified = data.totp.find((f) => f.status === 'verified');
    if (verified) {
      factorId.value = verified.id;
      return;
    }
    // Remove only unfinished enrollments; verified recovery factors stay intact.
    for (const factor of data.all.filter(
      (f) => f.factor_type === 'totp' && f.status === 'unverified',
    )) {
      const { error: cleanupError } = await client.auth.mfa.unenroll({ factorId: factor.id });
      if (cleanupError) throw cleanupError;
    }
    const { data: enrollment, error: enrollError } = await client.auth.mfa.enroll({
      factorType: 'totp',
      issuer: 'BarkoLink',
    });
    if (enrollError) throw enrollError;
    factorId.value = enrollment.id;
    const image = await authenticatorQr(enrollment.totp.uri);
    qr.value = image.src;
    qrSize.value = image.size;
    secret.value = enrollment.totp.secret;
  } catch {
    error.value =
      'Could not load authenticator verification. Sign out and try again, or contact your administrator.';
  } finally {
    busy.value = false;
  }
});
async function verify() {
  if (busy.value || !factorId.value || !validCode.value) return;
  busy.value = true;
  error.value = '';
  try {
    const client = requireSupabase();
    const { error: failure } = await client.auth.mfa.challengeAndVerify({
      factorId: factorId.value,
      code: code.value,
    });
    if (failure) throw failure;
    if (qr.value || returningToSettings.value) await activateAccountMfaAfterVerification();
    code.value = '';
    qr.value = '';
    secret.value = '';
    const { data, error: userError } = await client.auth.getUser();
    if (userError || !data.user) throw userError;
    await router.replace(
      returningToSettings.value
        ? settingsDestination.value
        : roleDestination(resolveAccountRole(data.user.app_metadata?.role)),
    );
  } catch {
    code.value = '';
    error.value = 'Could not verify the code. Check your authenticator and try again.';
  } finally {
    busy.value = false;
  }
}
async function cancelSetup() {
  busy.value = true;
  try {
    if (qr.value && factorId.value) {
      const { error: failure } = await requireSupabase().auth.mfa.unenroll({
        factorId: factorId.value,
      });
      if (failure) throw failure;
    }
    await router.replace(settingsDestination.value);
  } catch {
    error.value = 'Could not cancel authenticator setup. Try again.';
  } finally {
    busy.value = false;
  }
}
async function logout() {
  const { error: failure } = await requireSupabase().auth.signOut({ scope: 'local' });
  if (failure) {
    error.value = 'Could not sign out. Please try again.';
    return;
  }
  await router.replace('/login');
}
</script>
<style scoped>
.mfa-page {
  min-height: 100%;
  display: grid;
  place-items: center;
  padding: 24px;
  color: var(--ink);
}
.mfa-panel {
  width: 100%;
  max-width: 480px;
  padding: 28px;
  border: 1px solid var(--line);
  border-radius: 20px;
  background: var(--surface);
  box-shadow: var(--card-shadow);
}
.mfa-panel.is-enrolling {
  max-width: 840px;
}
.mfa-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
}
.security-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--muted);
  font-size: 11px;
  font-weight: 600;
}
.security-badge svg {
  width: 16px;
  height: 16px;
}
.mfa-heading {
  margin: 26px 0 22px;
}
.eyebrow {
  margin: 0 0 8px;
  color: var(--ocean);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
h1 {
  margin: 0 0 10px;
  font-size: clamp(22px, 3vw, 27px);
  font-weight: 700;
  letter-spacing: -0.035em;
  line-height: 1.2;
}
p {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
}
.mfa-heading > p:last-child,
.setup-section > p,
.field-hint,
.recovery-note,
.loading-message {
  color: var(--muted);
}
.is-enrolling .mfa-body {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 28px;
}
.setup-section {
  min-width: 0;
  padding-right: 28px;
  border-right: 1px solid var(--line);
}
h2 {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 600;
}
.step-number {
  display: inline-grid;
  place-items: center;
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--light-blue);
  color: var(--ocean);
  font-size: 12px;
}
.qr-frame {
  width: fit-content;
  max-width: 100%;
  padding: 8px;
  margin: 16px auto;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: white;
}
.qr-frame img {
  display: block;
  max-width: 100%;
  height: auto;
}
details {
  font-size: 12px;
  line-height: 1.6;
}
summary {
  color: var(--ocean);
  cursor: pointer;
}
code {
  display: block;
  padding: 12px;
  margin-top: 8px;
  border-radius: 8px;
  background: var(--surface-soft);
  overflow-wrap: anywhere;
  user-select: all;
}
.verification-section {
  min-width: 0;
}
form {
  display: grid;
  gap: 10px;
}
form h2 {
  margin-bottom: 0;
}
label {
  font-size: 13px;
  font-weight: 600;
}
input {
  width: 100%;
  min-width: 0;
  height: 52px;
  padding: 10px 16px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface-soft);
  color: var(--ink);
  font: inherit;
  font-size: 22px;
  font-variant-numeric: tabular-nums;
  text-align: center;
  letter-spacing: 0.4em;
}
input::placeholder {
  color: var(--muted);
  opacity: 0.55;
}
input:focus-visible,
button:focus-visible,
summary:focus-visible {
  outline: 3px solid var(--ocean);
  outline-offset: 3px;
}
.field-hint {
  font-size: 12px;
}
button {
  min-height: 44px;
  border-radius: 10px;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
}
button:disabled {
  opacity: 0.5;
  cursor: default;
}
.verify-button {
  width: 100%;
  margin-top: 8px;
  border: 1px solid transparent;
  background: var(--action, #1565c0);
  color: white;
}
.verify-button:hover:not(:disabled) {
  opacity: 0.9;
}
.recovery-note {
  margin: 12px 0;
  padding: 12px;
  border-radius: 10px;
  background: var(--surface-soft);
  font-size: 12px;
}
.signout-button {
  width: 100%;
  border: 1px solid var(--line);
  background: transparent;
  color: var(--ink);
}
.signout-button:hover:not(:disabled) {
  background: var(--surface-soft);
}
.error-message {
  padding: 12px;
  border: 1px solid #e59b9b;
  border-radius: 8px;
  color: var(--ink);
  background: var(--surface-soft);
}
.loading-message {
  margin-bottom: 16px;
}
@media (min-width: 641px) and (max-height: 700px) {
  .mfa-page {
    padding: 16px;
  }
  .mfa-panel {
    padding: 20px;
  }
  .mfa-heading {
    margin: 12px 0;
  }
  .qr-frame {
    margin-block: 10px;
  }
}
@media (max-width: 640px) {
  .mfa-page {
    padding: 16px;
  }
  .mfa-panel {
    padding: 22px;
    border-radius: 16px;
  }
  .is-enrolling .mfa-body {
    grid-template-columns: 1fr;
    gap: 22px;
  }
  .setup-section {
    padding: 0 0 22px;
    border-right: 0;
    border-bottom: 1px solid var(--line);
  }
}
</style>
