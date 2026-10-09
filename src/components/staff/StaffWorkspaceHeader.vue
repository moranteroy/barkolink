<template>
  <header class="staff-workspace-header">
    <button v-if="navigation" class="menu-button" aria-label="Toggle navigation" :aria-expanded="menuOpen" @click="$emit('toggleMenu')"><IonIcon :icon="menuOpen ? closeOutline : menuOutline" aria-hidden="true" /></button>
    <RouterLink :to="`/staff/${role}`" class="workspace-heading" :aria-label="`Back to ${role} dashboard`"><span class="workspace-icon"><IonIcon :icon="role === 'boarding' ? boatOutline : ticketOutline" aria-hidden="true" /></span><strong>{{ role === 'boarding' ? 'Boarding desk' : 'Ticketing desk' }}</strong></RouterLink>
    <div class="header-actions">
    <span class="assigned-port" :title="assignedPortLabel">{{ assignedPortLabel }}</span>
    <RouterLink :to="`/staff/${role}/notifications`" class="notification-link" :aria-current="router.currentRoute.value.path === `/staff/${role}/notifications` ? 'page' : undefined" :aria-label="notificationUnreadCount ? `Notifications, ${notificationUnreadCount} unread` : 'Notifications'" title="Notifications"><IonIcon :icon="notificationsOutline" aria-hidden="true" /><span v-if="notificationUnreadCount" class="unread-badge" aria-hidden="true">{{ notificationUnreadCount > 99 ? '99+' : notificationUnreadCount }}</span></RouterLink>
    <DropdownMenu :open="accountOpen" @update:open="accountOpen = $event">
      <DropdownMenuTrigger as-child><button class="account-link" aria-label="My staff account" :title="name"><IonIcon :icon="personCircleOutline" aria-hidden="true" /><span class="account-copy"><strong>{{ name }}</strong><small>{{ roleLabel }}</small></span><IonIcon class="account-chevron" :icon="chevronDownOutline" aria-hidden="true" /></button></DropdownMenuTrigger>
      <DropdownMenuContent align="end" class="staff-account-menu" :collision-padding="12">
        <DropdownMenuLabel class="account-menu-identity"><IonIcon :icon="personCircleOutline" aria-hidden="true" /><span><strong>{{ name }}</strong><small>{{ auth?.currentUser?.email || roleLabel }}</small></span></DropdownMenuLabel>
        <DropdownMenuSeparator class="account-menu-divider" />
        <DropdownMenuItem as-child><RouterLink :to="`/staff/${role}/settings/account`" class="account-menu-item"><IonIcon :icon="settingsOutline" aria-hidden="true" /> Settings</RouterLink></DropdownMenuItem>
        <DropdownMenuSeparator class="account-menu-divider" />
        <DropdownMenuItem :disabled="signingOut" class="account-menu-item account-menu-logout" @select.prevent="logout"><IonIcon :icon="logOutOutline" aria-hidden="true" />{{ signingOut ? 'Signing out...' : 'Log out' }}</DropdownMenuItem>
        <p v-if="logoutError" class="account-menu-error" role="alert">{{ logoutError }}</p>
      </DropdownMenuContent>
    </DropdownMenu>
    </div>
  </header>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { IonIcon } from '@ionic/vue';
import { notificationsOutline, boatOutline, ticketOutline, personCircleOutline, chevronDownOutline, settingsOutline, logOutOutline, menuOutline, closeOutline } from 'ionicons/icons';
import { notificationUnreadCount } from '../../composables/notificationUnread';
import { auth, staffDatabase } from '../../services/session';
import { checkStaffPortAccess, resetStaffPortAccess, staffPortAccess } from '../../services/staffPortAccess';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import { DropdownMenuSeparator } from 'reka-ui';
import { signOut } from '../../services/auth';
import { clearSessionViews } from '../../composables/sessionViews';
import { syncNotificationOwner } from '../../composables/notificationUnread';
const props = withDefaults(defineProps<{ role?: string; navigation?: boolean; menuOpen?: boolean }>(), { role: 'ticketing', navigation: false, menuOpen: false });
defineEmits<{ toggleMenu: [] }>();
const accountOpen = ref(false), signingOut = ref(false), logoutError = ref('');
const router = useRouter();
const roleLabel = computed(() => props.role === 'boarding' ? 'Boarding staff' : 'Ticketing staff');
const assignedPortLabel = computed(() => staffPortAccess.uid === auth?.currentUser?.uid ? staffPortAccess.portName || (staffPortAccess.status === 'blocked' ? 'Awaiting port assignment' : '') : '');
watch(() => auth?.currentUser?.uid, async uid => {
  resetStaffPortAccess(uid || '');
  if (!uid || !staffDatabase) return;
  try {
    await checkStaffPortAccess(staffDatabase);
  } catch { /* Workspace requests display authorization errors. */ }
}, { immediate: true });
async function logout() {
  if (signingOut.value) return;
  signingOut.value = true; logoutError.value = '';
  try {
    if (auth) await signOut(auth);
    syncNotificationOwner();
    accountOpen.value = false;
    await router.replace('/login');
    clearSessionViews();
  } catch { logoutError.value = 'Could not sign out. Please try again.'; }
  finally { signingOut.value = false; }
}
const name = computed(() => auth?.currentUser?.displayName || auth?.currentUser?.email?.split('@')[0] || 'My account');
</script>
<style scoped>
.staff-workspace-header { display: flex; align-items: center; gap: 12px; min-width: 0; min-height: 72px; padding: 12px 28px; border-bottom: 1px solid var(--line); background: var(--surface); color: var(--ink); }
.workspace-heading { display: inline-flex; align-items: center; gap: 10px; min-width: 0; color: var(--ink); text-decoration: none; }
.workspace-icon { display: grid; place-items: center; width: 36px; height: 36px; flex: none; border-radius: 10px; background: var(--light-blue); color: var(--ocean); font-size: 20px; }
.workspace-heading strong { display: block; font-size: 14px; font-weight: 650; line-height: 1.5; }
.account-link { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; max-width: 240px; padding: 8px 12px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface-soft); color: var(--ink); text-decoration: none; font-size: 12px; }
.account-link ion-icon { flex: none; color: var(--ocean); font-size: 23px; }
.account-link span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.menu-button { display: none; align-items: center; justify-content: center; width: 40px; height: 44px; flex: none; border: 1px solid var(--line); border-radius: 9px; background: var(--surface-soft); color: var(--ink); font-size: 21px; }
a:focus-visible, button:focus-visible { outline: 2px solid var(--ocean); outline-offset: 3px; }
@media (max-width: 800px) { .menu-button { display: inline-flex; } .staff-workspace-header { padding: 12px 16px; } }
@media (max-width: 480px) { .staff-workspace-header { gap: 8px; } .account-link { width: 40px; padding: 8px; justify-content: center; } .account-link span { display: none; } .workspace-icon { display: none; } .workspace-heading strong { font-size: 13px; } }
.header-actions { display: flex; align-items: center; gap: 10px; margin-left: auto; flex: none; }
.assigned-port { max-width: 180px; overflow: hidden; text-overflow: ellipsis; font-size: 11px; color: var(--muted); }
@media(max-width:600px) { .assigned-port { max-width: 105px; font-size: 10px; } }
.notification-link { position: relative; display: grid; place-items: center; width: 44px; height: 44px; border: 1px solid var(--line); border-radius: 12px; background: var(--surface-soft); color: var(--ink); font-size: 21px; text-decoration: none; }
.notification-link[aria-current="page"] { color:var(--ocean); border-color:var(--ocean); }
.unread-badge { position: absolute; top: -5px; right: -5px; min-width: 20px; height: 20px; padding: 0 5px; display: grid; place-items: center; border-radius: 20px; background: #c73646; color: white; font-size: 10px; font-weight: 700; border: 2px solid var(--surface); }
@media (max-width: 480px) { .header-actions { gap: 7px; } }
</style>

<style scoped>
.account-link { cursor: pointer; font: inherit; font-size: 12px; background: transparent; border-color: transparent; padding: 5px 8px; }
.account-link:hover, .account-link[data-state="open"] { background: var(--surface-soft); border-color: var(--line); }
.account-link > ion-icon:first-child { font-size: 31px; }
.account-copy { display: grid; gap: 3px; text-align: left; min-width: 0; }
.account-copy strong { font-size: 12px; overflow: hidden; text-overflow: ellipsis; }
.account-copy small { font-size: 10px; color: var(--muted); }
.account-link .account-chevron { font-size: 14px; color: var(--muted); }
:global(.staff-account-menu) { width: 260px; max-width: calc(100vw - 24px); padding: 6px; background: var(--surface); color: var(--ink); border: 1px solid var(--line); border-radius: 12px; z-index: 20000; box-shadow: 0 12px 32px #061a3530; }
.account-menu-identity { display: flex; gap: 9px; align-items: center; padding: 10px; }
.account-menu-identity > ion-icon { font-size: 30px; flex: none; color: var(--ocean); }
.account-menu-identity span { min-width: 0; display: grid; gap: 4px; }
.account-menu-identity strong { font-size: 12px; overflow-wrap: anywhere; }
.account-menu-identity small { font-size: 11px; color: var(--muted); overflow-wrap: anywhere; }
.account-menu-divider { height: 1px; background: var(--line); margin: 4px 0; }
.account-menu-item { display: flex; align-items: center; gap: 10px; min-height: 44px; padding: 9px 10px; border-radius: 8px; font-size: 12px; text-decoration: none; color: var(--ink); outline: none; cursor: pointer; }
.account-menu-item ion-icon { font-size: 18px; flex: none; }.account-menu-item[data-highlighted] { background: var(--light-blue); }.account-menu-logout { color: var(--danger); }.account-menu-item[data-disabled] { opacity: .5; cursor: wait; }
.account-menu-error { color: var(--danger); font-size: 11px; padding: 0 10px; }
@media(max-width:480px) { .account-link .account-copy, .account-link .account-chevron { display: none; }.account-link { width: 40px; padding: 4px; } }
</style>
