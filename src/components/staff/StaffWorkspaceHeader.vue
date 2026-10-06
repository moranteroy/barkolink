<template>
  <header class="staff-workspace-header">
    <button v-if="navigation" class="menu-button" aria-label="Toggle navigation" :aria-expanded="menuOpen" @click="$emit('toggleMenu')"><IonIcon :icon="menuOpen ? closeOutline : menuOutline" aria-hidden="true" /></button>
    <RouterLink :to="`/staff/${role}`" class="workspace-heading" :aria-label="`Back to ${role} dashboard`"><span class="workspace-icon"><IonIcon :icon="role === 'boarding' ? boatOutline : ticketOutline" aria-hidden="true" /></span><span><small>{{ role === 'boarding' ? 'Boarding desk' : 'Ticketing desk' }}</small><strong>{{ title }}</strong></span></RouterLink>
    <div class="header-actions">
    <RouterLink :to="`/staff/${role}/notifications`" class="notification-link" :aria-label="notificationUnreadCount ? `Notifications, ${notificationUnreadCount} unread` : 'Notifications'" title="Notifications"><IonIcon :icon="notificationsOutline" aria-hidden="true" /><span v-if="notificationUnreadCount" class="unread-badge" aria-hidden="true">{{ notificationUnreadCount > 99 ? '99+' : notificationUnreadCount }}</span></RouterLink>
    <RouterLink :to="`/staff/${role}/settings/account`" class="account-link" aria-label="My staff account" :title="name"><IonIcon :icon="personCircleOutline" aria-hidden="true" /><span>{{ name }}</span></RouterLink>
    </div>
  </header>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import { IonIcon } from '@ionic/vue';
import { notificationsOutline, boatOutline, ticketOutline, personCircleOutline, menuOutline, closeOutline } from 'ionicons/icons';
import { notificationUnreadCount } from '../../composables/notificationUnread';
import { auth } from '../../services/session';
withDefaults(defineProps<{ role?: string; title: string; navigation?: boolean; menuOpen?: boolean }>(), { role: 'ticketing', navigation: false, menuOpen: false });
defineEmits<{ toggleMenu: [] }>();
const name = computed(() => auth?.currentUser?.displayName || auth?.currentUser?.email?.split('@')[0] || 'My account');
</script>
<style scoped>
.staff-workspace-header { display: flex; align-items: center; gap: 12px; min-width: 0; min-height: 72px; padding: 12px 28px; border-bottom: 1px solid var(--line); background: var(--surface); color: var(--ink); }
.workspace-heading { display: inline-flex; align-items: center; gap: 10px; min-width: 0; color: var(--ink); text-decoration: none; }
.workspace-heading > span:last-child { min-width: 0; }
.workspace-icon { display: grid; place-items: center; width: 36px; height: 36px; flex: none; border-radius: 10px; background: var(--light-blue); color: var(--ocean); font-size: 20px; }
.workspace-heading small { display: block; color: var(--muted); font-size: 10px; line-height: 1.5; }
.workspace-heading strong { display: block; font-size: 14px; font-weight: 650; line-height: 1.5; }
.account-link { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; max-width: 240px; padding: 8px 12px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface-soft); color: var(--ink); text-decoration: none; font-size: 12px; }
.account-link ion-icon { flex: none; color: var(--ocean); font-size: 23px; }
.account-link span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.menu-button { display: none; align-items: center; justify-content: center; width: 40px; height: 44px; flex: none; border: 1px solid var(--line); border-radius: 9px; background: var(--surface-soft); color: var(--ink); font-size: 21px; }
a:focus-visible, button:focus-visible { outline: 2px solid var(--ocean); outline-offset: 3px; }
@media (max-width: 800px) { .menu-button { display: inline-flex; } .staff-workspace-header { padding: 12px 16px; } }
@media (max-width: 480px) { .staff-workspace-header { gap: 8px; } .account-link { width: 40px; padding: 8px; justify-content: center; } .account-link span { display: none; } .workspace-icon { display: none; } .workspace-heading strong { font-size: 13px; } }
.header-actions { display: flex; align-items: center; gap: 10px; margin-left: auto; flex: none; }
.notification-link { position: relative; display: grid; place-items: center; width: 42px; height: 44px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface-soft); color: var(--ocean); font-size: 21px; text-decoration: none; }
.unread-badge { position: absolute; top: -5px; right: -5px; min-width: 18px; height: 18px; padding: 0 4px; display: grid; place-items: center; border-radius: 20px; background: #d3374d; color: white; font-size: 10px; font-weight: 700; border: 2px solid var(--surface); }
@media (max-width: 480px) { .header-actions { gap: 7px; } }
</style>
