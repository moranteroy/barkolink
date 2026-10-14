<template>
  <div class="toast-host" aria-label="Notifications">
    <Transition name="toast">
      <div v-if="current" :key="current.id" class="app-toast" :class="current.tone"
        :role="current.tone === 'error' ? 'alert' : 'status'" aria-atomic="true"
        @mouseenter="pause" @mouseleave="resume" @focusin="pause" @focusout="resume">
        <AppIcon :icon="current.tone === 'error' ? alertCircleOutline : current.tone === 'success' ? checkmarkCircleOutline : informationCircleOutline" aria-hidden="true" />
        <div><strong>{{ current.tone === 'error' ? 'Something went wrong' : current.tone === 'success' ? 'Success' : 'Notice' }}</strong><p>{{ current.message }}</p></div>
        <button type="button" aria-label="Dismiss notification" @click="dismissToast(current.id)"><AppIcon :icon="closeOutline" aria-hidden="true" /></button>
      </div>
    </Transition>
  </div>
</template>
<script setup lang="ts">
import { computed, onUnmounted, watch } from 'vue';
import { alertCircleOutline, checkmarkCircleOutline, informationCircleOutline, closeOutline } from 'ionicons/icons';
import AppIcon from '../ui/icon/AppIcon.vue';
import { toastMessages, dismissToast } from '../../composables/toast';
const current = computed(() => toastMessages.value[0]);
let timer: ReturnType<typeof setTimeout> | undefined;
let remaining = 0, startedAt = 0;
function pause() {
  if (!timer) return;
  clearTimeout(timer); timer = undefined;
  remaining = Math.max(0, remaining - (Date.now() - startedAt));
}
function resume() {
  if (timer || !current.value) return;
  const id = current.value.id;
  startedAt = Date.now();
  timer = setTimeout(() => { timer = undefined; dismissToast(id); }, remaining);
}
watch(() => current.value?.id, () => {
  if (timer) clearTimeout(timer);
  timer = undefined;
  remaining = current.value?.duration ?? 0;
  resume();
}, { immediate: true });
onUnmounted(() => { if (timer) clearTimeout(timer); });
</script>
<style scoped>
.toast-host { position: fixed; z-index: 100000; top: calc(env(safe-area-inset-top, 0px) + 16px); left: 50%; transform: translateX(-50%); width: min(520px, calc(100% - 32px)); pointer-events: none; }
.app-toast { pointer-events: auto; display: flex; align-items: flex-start; gap: 12px; padding: 14px; border: 1px solid var(--line); border-left: 4px solid var(--ocean); border-radius: 14px; background: var(--surface); color: var(--ink); box-shadow: 0 8px 32px #0003; }
.app-toast > .app-icon { flex-shrink: 0; width: 24px; height: 24px; color: var(--ocean); }
.app-toast.success { border-left-color: #249779; }
.app-toast.success > .app-icon { color: #249779; }
.app-toast.error { border-left-color: var(--danger); }
.app-toast.error > .app-icon { color: var(--danger); }
.app-toast div { flex: 1; min-width: 0; }
.app-toast strong { font-size: 14px; }
.app-toast p { margin: 4px 0 0; font-size: 14px; line-height: 1.5; overflow-wrap: anywhere; max-height: 30vh; overflow-y: auto; }
.app-toast button { display: grid; place-items: center; flex-shrink: 0; width: 44px; height: 44px; margin: -8px -8px 0 0; border: 0; border-radius: 8px; color: var(--ink); background: transparent; cursor: pointer; }
.app-toast button:focus-visible { outline: 2px solid var(--ocean); outline-offset: 2px; }
.toast-enter-active, .toast-leave-active { transition: opacity .18s, translate .18s; }
.toast-enter-from, .toast-leave-to { opacity: 0; translate: 0 -8px; }
@media (prefers-reduced-motion: reduce) { .toast-enter-active, .toast-leave-active { transition: none; } }
</style>
