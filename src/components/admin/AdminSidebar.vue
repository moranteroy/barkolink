<template>
<aside id="admin-sidebar" class="sidebar" :class="{ open: menuOpen }">
          <BrandMark />
          <nav aria-label="Admin navigation">
            <div class="nav-group port-display-shortcut">
              <router-link to="/port-display" target="_blank" rel="noopener" @click="$emit('navigate')">
                <Monitor class="app-icon" :size="20" aria-hidden="true" />Port Display (TV)
              </router-link>
            </div>
            <div
              v-for="group in navigation"
              :key="group.label"
              class="nav-group"
            >
              <button
                class="nav-group-toggle"
                :id="`admin-nav-toggle-${group.items[0].key}`"
                type="button"
                :aria-expanded="expandedNavigation === group.label"
                :aria-controls="`admin-nav-${group.items[0].key}`"
                @click="expandedNavigation = expandedNavigation === group.label ? '' : group.label"
              >
                <span class="nav-group-label">
                  <AppIcon :icon="group.icon" aria-hidden="true" />
                  {{ group.label.charAt(0) + group.label.slice(1).toLowerCase() }}
                </span>
                <AppIcon class="nav-group-chevron" :icon="chevronDownOutline" aria-hidden="true" />
              </button>
              <div
                v-show="expandedNavigation === group.label"
                :id="`admin-nav-${group.items[0].key}`"
                class="nav-group-items"
                role="region"
                :aria-labelledby="`admin-nav-toggle-${group.items[0].key}`"
              >
              <router-link
                v-for="item in group.items"
                :key="item.key"
                :to="item.key === 'dashboard' ? '/admin' : `/admin/${item.key}`"
                :class="{ active: navigationSection === item.key }"
                :aria-current="navigationSection === item.key ? 'page' : undefined"
                @click="$emit('navigate')"
                ><AppIcon :icon="item.icon" aria-hidden="true" />{{
                  item.label
                }}</router-link
              >
              </div>
            </div>
          </nav>
        </aside>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Monitor } from '@lucide/vue';
import AppIcon from '@/components/ui/icon/AppIcon.vue';
import BrandMark from '../shared/BrandMark.vue';
import { chevronDownOutline } from 'ionicons/icons';
import { adminNavigation as navigation } from '../../data/adminNavigation';
const props = withDefaults(defineProps<{ menuOpen?: boolean; section?: string }>(), { menuOpen: false, section: 'dashboard' });
defineEmits<{ navigate: [] }>();
const expandedNavigation = ref('');
const navigationSection = computed(() => props.section === 'analytics' ? 'reports' : props.section);
watch(navigationSection, section => {
  expandedNavigation.value = navigation.find(group => group.items.some(item => item.key === section))?.label || 'OVERVIEW';
}, { immediate: true });
</script>
<style scoped>
.sidebar {
  position: sticky;
  top: 0;
  width: 238px;
  min-width: 238px;
  height: 100vh;
  padding: 24px 14px;
  display: flex;
  flex-direction: column;
  background: #0b2134;
  border-right: 1px solid #28445b;
}
.sidebar :deep(.brand-copy strong),
.sidebar :deep(.brand-copy b) {
  color: white;
}
.sidebar nav {
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: #41617a transparent;
  flex: 1;
  margin-top: 20px;
  min-height: 0;
  padding-bottom: 12px;
}
.nav-group {
  display: grid;
  gap: 2px;
  margin: 0 0 3px;
}
.nav-group-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  min-height: 36px;
  padding: 8px 10px;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: #85abc2;
  text-align: left;
  font-size: 12.5px;
  font-weight: 500;
  line-height: 1.4;
  letter-spacing: normal;
  cursor: pointer;
}
.nav-group-toggle:hover,
.nav-group-toggle[aria-expanded="true"] { background: #ffffff08; color: #d4e6f4; }
.nav-group-label { display: flex; align-items: center; gap: 8px; min-width: 0; }
.nav-group .nav-group-label .app-icon { width: 16px; height: 16px; font-size: 16px; flex: none; color: #79a9ce; }
.nav-group .nav-group-chevron { width: 12px; height: 12px; font-size: 12px; flex: none; transition: transform 160ms ease; }
.nav-group-toggle[aria-expanded="true"] .nav-group-chevron { transform: rotate(180deg); }
.nav-group-items { display: grid; gap: 3px; padding: 0 0 4px 8px; margin-left: 12px; border-left: 1px solid #28445b; }
.nav-group a {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 36px;
  padding: 8px 10px;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: #b8cfe0;
  font-size: 13px;
  font-weight: 400;
  line-height: 1.4;
  text-decoration: none;
  text-align: left;
  cursor: pointer;
}
.nav-group a:hover,
.nav-group a.active {
  background: #174266;
  color: #fff;
}
.port-display-shortcut { margin-bottom: 10px; }
.port-display-shortcut a { min-height: 38px; background: #174266; color: #fff; border: 1px solid #356789; font-size: 12.5px; font-weight: 500; }
.nav-group .app-icon {
  width: 16px;
  height: 16px;
  font-size: 16px;
}
.sidebar :deep(.staff-signout) { flex: none; margin-top: 12px; }
.sidebar :deep(.brand-copy small) { color: #8eb8cc; }
.nav-group-toggle:focus-visible, .nav-group a:focus-visible { outline: 2px solid #50a9eb; outline-offset: 3px; }
@media (max-width: 950px) {
  .sidebar { position: fixed; z-index: 20; left: 0; transform: translateX(-100%); transition: transform .2s; }
  .sidebar.open { transform: none; }
  .nav-group-toggle, .nav-group a { min-height: 44px; }
}
@media (prefers-reduced-motion: reduce) { .sidebar { transition: none; } }
</style>
