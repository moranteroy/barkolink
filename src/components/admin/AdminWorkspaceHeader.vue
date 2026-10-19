<template>
<header class="topbar glass-toolbar">
            <button
              class="menu-button"
              :aria-expanded="menuOpen"
              aria-controls="admin-sidebar"
              aria-label="Open menu"
              @click="$emit('openMenu')"
            >
              <AppIcon :icon="menuOutline" />
            </button>
            <div class="admin-breadcrumbs">
              <strong>Admin workspace</strong>
            </div>
            <form
              class="admin-global-search"
              @submit.prevent="
                router.push({
                  path: '/admin/bookings',
                  query: { search: globalSearch },
                })
              "
            >
              <AppIcon :icon="searchOutline" /><input
                v-model.trim="globalSearch"
                type="search"
                placeholder="Search bookings..."
                aria-label="Search all bookings"
              />
            </form>
            <div class="admin-header-actions">
            <router-link
              to="/admin/inbox"
              :aria-current="section === 'inbox' ? 'page' : undefined"
              class="admin-bell"
              :aria-label="notificationUnreadCount ? `Notifications, ${notificationUnreadCount} unread` : 'Notifications'"
              title="Notifications"
              ><AppIcon :icon="notificationsOutline" aria-hidden="true" />
              <span v-if="notificationUnreadCount" class="admin-unread-badge" aria-hidden="true">{{ notificationUnreadCount > 99 ? '99+' : notificationUnreadCount }}</span>
            </router-link>
            <AdminAccountMenu />
            </div>
          </header>
</template>
<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import AppIcon from '@/components/ui/icon/AppIcon.vue';
import { menuOutline, searchOutline, notificationsOutline } from 'ionicons/icons';
import AdminAccountMenu from './AdminAccountMenu.vue';
import { notificationUnreadCount } from '../../composables/notificationUnread';
withDefaults(defineProps<{ menuOpen?: boolean; section?: string }>(), { menuOpen: false, section: '' });
defineEmits<{ openMenu: [] }>();
const router = useRouter();
const globalSearch = ref('');
</script>
<style scoped>
.topbar { display: flex; align-items: center; gap: 15px; min-height: 72px; height: 72px; padding: 0 32px; border-bottom: 1px solid var(--line); background: var(--surface); color: var(--ink); }
.admin-breadcrumbs { min-width: 0; color: var(--ink); }
.admin-breadcrumbs strong { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; }
.admin-header-actions { display: flex; align-items: center; gap: 10px; margin-left: 6px; flex: none; }
.admin-bell { position: relative; display: grid; place-items: center; width: 44px; height: 44px; border: 1px solid var(--line); border-radius: 12px; background: var(--surface-soft); color: var(--ink); text-decoration: none; }
.admin-bell[aria-current="page"] { color: var(--ocean); border-color: var(--ocean); }
.admin-unread-badge { position: absolute; top: -5px; right: -5px; display: grid; place-items: center; min-width: 20px; height: 20px; padding: 0 5px; border: 2px solid var(--surface); border-radius: 20px; background: #c73646; color: white; font-size: 12px; font-weight: 700; }
.menu-button { display: none; }
a:focus-visible, button:focus-visible { outline: 2px solid var(--ocean); outline-offset: 3px; }
@media (max-width: 1000px) { .admin-header-actions { margin-left: auto; } }
@media (max-width: 950px) { .menu-button { display: grid; place-items: center; flex: none; width: 36px; height: 36px; border: 1px solid var(--line); border-radius: 8px; background: transparent; color: var(--ink); font-size: 20px; } }
@media (max-width: 600px) { .topbar { padding: 0 16px; gap: 10px; } }
</style>
