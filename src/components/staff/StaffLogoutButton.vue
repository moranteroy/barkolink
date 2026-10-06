<template>
  <div class="staff-signout">
    <button type="button" :disabled="busy || disabled" @click="logout"><IonIcon :icon="logOutOutline" aria-hidden="true" /><span>{{ busy ? 'Signing out?' : 'Log out' }}</span></button>
    <p v-if="error" role="alert">{{ error }}</p>
  </div>
</template>
<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { IonIcon } from '@ionic/vue';
import { logOutOutline } from 'ionicons/icons';
import { auth } from '../../services/session';
import { signOut } from '../../services/auth';
import { clearSessionViews } from '../../composables/sessionViews';
import { syncNotificationOwner } from '../../composables/notificationUnread';
withDefaults(defineProps<{ disabled?: boolean }>(), { disabled: false });
const router = useRouter();
const busy = ref(false);
const error = ref('');
async function logout() {
  if (busy.value) return;
  busy.value = true;
  error.value = '';
  try {
    if (auth) await signOut(auth);
    syncNotificationOwner();
    await router.replace('/login');
    clearSessionViews();
  } catch {
    error.value = 'Could not sign out. Please try again.';
  } finally { busy.value = false; }
}
</script>
<style scoped>
.staff-signout { margin-top: 20px; padding-top: 16px; border-top: 1px solid #ffffff20; }
.staff-signout button { display: flex; align-items: center; justify-content: center; gap: 9px; width: 100%; min-height: 44px; padding: 10px 14px; border: 1px solid #e579795c; border-radius: 10px; background: #dc55550d; color: #ffb0b0; font-size: 12px; font-weight: 600; }
.staff-signout button:hover { background: #dc55551f; }
.staff-signout button:focus-visible { outline: 2px solid #ffb0b0; outline-offset: 3px; }
.staff-signout button:disabled { opacity: .65; cursor: wait; }
.staff-signout ion-icon { font-size: 18px; }
.staff-signout p { font-size: 11px; line-height: 1.6; color: #ffb0b0; }
</style>
