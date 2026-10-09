<template>
  <ion-page
    ><ion-content
      ><main class="reset-form glass-panel">
        <h1>Set a new password</h1>
        <p>{{ recoveryReady ? 'Your email is verified. Choose your new password.' : 'Verify the code from your email before setting a new password.' }}</p>
        <form @submit.prevent="save">
          <label
            >New password<input
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              minlength="8"
              autocomplete="new-password"
              required
          /></label>
          <label
            >Confirm password<input
              v-model="confirm"
              :type="showPassword ? 'text' : 'password'"
              minlength="8"
              autocomplete="new-password"
              required
          /></label>
          <label><input v-model="showPassword" type="checkbox" />Show passwords</label>
          <p v-if="message" :role="failed ? 'alert' : 'status'">{{ message }}</p>
          <ion-button type="submit" :disabled="busy || !recoveryReady">Save password</ion-button>
        </form>
        <RouterLink to="/login" class="sign-in-return"><IonIcon :icon="logInOutline" aria-hidden="true" /> Back to sign in</RouterLink>
      </main></ion-content
    ></ion-page
  >
</template>
<script setup lang="ts">
import { ref } from "vue";
import { RouterLink } from "vue-router";
import { IonPage, IonContent, IonButton, IonIcon, onIonViewWillEnter } from "@ionic/vue";
import { logInOutline } from "ionicons/icons";
import { requireSupabase } from "../../services/supabase";
const password = ref(""),
  confirm = ref(""),
  message = ref(""),
  busy = ref(false);
const failed = ref(false), showPassword = ref(false);
const recoveryReady = ref(false);
async function checkRecovery() {
  const marker = JSON.parse(sessionStorage.getItem('barkolink-password-recovery') || '{}');
  const { data, error } = await requireSupabase().auth.getUser();
  if (error || !data.user || marker.uid !== data.user.id || !Number.isFinite(marker.verifiedAt) || Date.now() - marker.verifiedAt > 15 * 60 * 1000) {
    throw new Error('Verify a new reset code from the sign-in page to continue.');
  }
}
onIonViewWillEnter(async () => {
  recoveryReady.value = false;
  try { await checkRecovery(); recoveryReady.value = true; }
  catch (error) { failed.value = true; message.value = (error as Error).message; }
});
async function save() {
  if (busy.value || !recoveryReady.value) return;
  failed.value = false;
  if (password.value.length < 8) { message.value = 'Use at least 8 characters.'; failed.value = true; return; }
  if (password.value !== confirm.value) {
    message.value = "Passwords do not match.";
    failed.value = true;
    return;
  }
  busy.value = true;
  try {
    const client = requireSupabase();
    await checkRecovery();
    const { data } = await client.auth.getSession();
    if (!data.session)
      throw new Error(
        "Your reset session has expired. Request another code from the sign-in page.",
      );
    const { error } = await client.auth.updateUser({
      password: password.value,
    });
    if (error) throw error;
    sessionStorage.removeItem('barkolink-password-recovery');
    sessionStorage.removeItem('barkolink-pending-email');
    recoveryReady.value = false;
    await client.auth.signOut();
    password.value = "";
    confirm.value = "";
    message.value = "Password saved. Sign in with your new password.";
  } catch (error) {
    failed.value = true;
    message.value =
      error instanceof Error ? error.message : "Could not save password.";
  } finally {
    busy.value = false;
  }
}
</script>
<style scoped>
@media (max-width: 520px) {
  .reset-form {
    margin: 28px 18px !important;
    padding: 24px !important;
  }
}
h1 {
  letter-spacing: -0.04em;
}
p {
  font-size: 14px;
  line-height: 1.7;
  color: var(--muted);
}
a {
  display: inline-block;
  margin-top: 24px;
  color: var(--ocean);
}
.reset-form {
  max-width: 460px;
  margin: 60px auto;
  padding: 32px;
  border-radius: 24px;
  color: var(--ink);
}
form,
label {
  display: grid;
  gap: 14px;
}
label {
  gap: 6px;
  margin-top: 16px;
}
input {
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface);
  color: var(--ink);
}
.sign-in-return { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; }
.sign-in-return ion-icon { font-size: 19px; flex: none; }
</style>
