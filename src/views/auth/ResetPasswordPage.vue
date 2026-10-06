<template>
  <ion-page
    ><ion-content
      ><main class="reset-form glass-panel">
        <h1>Set a new password</h1>
        <p>Open the reset link from your email before completing this form.</p>
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
          <ion-button type="submit" :disabled="busy">Save password</ion-button>
        </form>
        <RouterLink to="/login">Back to sign in</RouterLink>
      </main></ion-content
    ></ion-page
  >
</template>
<script setup lang="ts">
import { ref } from "vue";
import { RouterLink } from "vue-router";
import { IonPage, IonContent, IonButton } from "@ionic/vue";
import { requireSupabase } from "../../services/supabase";
const password = ref(""),
  confirm = ref(""),
  message = ref(""),
  busy = ref(false);
const failed = ref(false), showPassword = ref(false);
async function save() {
  if (busy.value) return;
  failed.value = false;
  if (password.value !== confirm.value) {
    message.value = "Passwords do not match.";
    failed.value = true;
    return;
  }
  busy.value = true;
  try {
    const client = requireSupabase();
    const { data } = await client.auth.getSession();
    if (!data.session)
      throw new Error(
        "This reset link has expired. Request another link from the sign-in page.",
      );
    const { error } = await client.auth.updateUser({
      password: password.value,
    });
    if (error) throw error;
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
</style>
