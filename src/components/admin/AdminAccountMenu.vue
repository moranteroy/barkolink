<template>
  <DropdownMenu :open="open" @update:open="open = $event">
    <DropdownMenuTrigger as-child>
      <button type="button" class="admin-account-trigger" aria-label="Administrator account menu" :title="name">
        <IonIcon :icon="personCircleOutline" aria-hidden="true" />
        <span class="account-copy"><strong>{{ name }}</strong><small>Administrator</small></span>
        <IonIcon class="account-chevron" :icon="chevronDownOutline" aria-hidden="true" />
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="admin-account-menu" :collision-padding="12">
      <DropdownMenuLabel class="account-identity"><IonIcon :icon="personCircleOutline" aria-hidden="true" /><span><strong>{{ name }}</strong><small>{{ auth?.currentUser?.email || 'Administrator' }}</small></span></DropdownMenuLabel>
      <DropdownMenuSeparator class="account-divider" />
      <DropdownMenuItem as-child><RouterLink to="/admin/settings/profile" class="account-item"><IonIcon :icon="settingsOutline" aria-hidden="true" /> Settings</RouterLink></DropdownMenuItem>
      <DropdownMenuSeparator class="account-divider" />
      <DropdownMenuItem :disabled="signingOut" class="account-item account-logout" @select.prevent="logout"><IonIcon :icon="logOutOutline" aria-hidden="true" />{{ signingOut ? 'Signing out…' : 'Log out' }}</DropdownMenuItem>
      <p v-if="error" class="account-error" role="alert">{{ error }}</p>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { IonIcon } from '@ionic/vue';
import { personCircleOutline, chevronDownOutline, settingsOutline, logOutOutline } from 'ionicons/icons';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import { DropdownMenuSeparator } from 'reka-ui';
import { auth } from '../../services/session';
import { signOut } from '../../services/auth';
import { clearSessionViews } from '../../composables/sessionViews';
import { syncNotificationOwner } from '../../composables/notificationUnread';
const router = useRouter();
const open = ref(false), signingOut = ref(false), error = ref('');
const name = computed(() => auth?.currentUser?.displayName?.trim() || auth?.currentUser?.email?.split('@')[0] || 'Admin User');
async function logout() {
  if (signingOut.value) return;
  signingOut.value = true; error.value = '';
  try {
    if (auth) await signOut(auth);
    syncNotificationOwner();
    open.value = false;
    await router.replace('/login');
    clearSessionViews();
  } catch { error.value = 'Could not sign out. Please try again.'; }
  finally { signingOut.value = false; }
}
</script>
<style scoped>
.admin-account-trigger { display: inline-flex; align-items: center; gap: 8px; max-width: 240px; min-height: 44px; padding: 5px 8px; border: 1px solid transparent; border-radius: 10px; background: transparent; color: var(--ink); font-family: inherit; cursor: pointer; }
.admin-account-trigger:hover, .admin-account-trigger[data-state="open"] { background: var(--surface-soft); border-color: var(--line); }
.admin-account-trigger > ion-icon:first-child { font-size: 31px; color: var(--ocean); flex: none; }
.account-copy { display: grid; gap: 3px; min-width: 0; text-align: left; }
.account-copy strong { font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.account-copy small { font-size: 10px; color: var(--muted); }
.account-chevron { font-size: 14px; color: var(--muted); flex: none; }
.admin-account-trigger:focus-visible { outline: 2px solid var(--ocean); outline-offset: 3px; }
:global(.admin-account-menu) { width: 260px; max-width: calc(100vw - 24px); padding: 6px; border: 1px solid var(--line); border-radius: 12px; background: var(--surface); color: var(--ink); z-index: 20000; box-shadow: 0 12px 32px #061a3530; }
.account-identity { display: flex; align-items: center; gap: 9px; padding: 10px; }
.account-identity > ion-icon { font-size: 30px; color: var(--ocean); flex: none; }
.account-identity span { display: grid; gap: 4px; min-width: 0; }
.account-identity strong { font-size: 12px; overflow-wrap: anywhere; }
.account-identity small { font-size: 11px; color: var(--muted); overflow-wrap: anywhere; }
.account-divider { height: 1px; margin: 4px 0; background: var(--line); }
.account-item { display: flex; align-items: center; gap: 10px; min-height: 44px; padding: 9px 10px; border-radius: 8px; outline: none; color: var(--ink); font-size: 12px; text-decoration: none; cursor: pointer; }
.account-item ion-icon { font-size: 18px; flex: none; }
.account-item[data-highlighted] { background: var(--light-blue); }
.account-item[data-disabled] { opacity: .5; cursor: wait; }
.account-logout { color: var(--danger, #e56873); }
.account-error { margin: 8px 10px; font-size: 11px; line-height: 1.6; color: var(--danger, #e56873); }
@media (max-width: 480px) { .account-copy, .account-chevron { display: none; }.admin-account-trigger { width: 40px; padding: 4px; justify-content: center; } }
</style>
