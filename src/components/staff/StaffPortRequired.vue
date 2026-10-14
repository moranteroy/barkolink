<template>
  <section class="port-required" aria-labelledby="port-required-title">
    <span class="port-required-icon"><AppIcon :icon="idCardOutline" aria-hidden="true" /></span>
    <h2 id="port-required-title">Port assignment needed</h2>
    <p>Ask your administrator to assign your departure port before you start terminal operations.</p>
    <p class="port-required-help">Once assigned, check again to open your workspace.</p>
    <Button variant="outline" :disabled="checking" @click="check"><AppIcon :icon="refreshOutline" aria-hidden="true" />{{ checking ? 'Checking…' : 'Check assignment' }}</Button>
    <p v-if="error" role="alert">{{ error }}</p>
  </section>
</template>
<script setup lang="ts">
import { notifyError, notify } from '@/composables/toast';
import { ref, watch } from 'vue';
import AppIcon from "@/components/ui/icon/AppIcon.vue";
import { idCardOutline, refreshOutline } from 'ionicons/icons';
import { Button } from '@/components/ui/button';
import { staffDatabase } from '../../services/session';
import { checkStaffPortAccess, claimStaffPortNotice, staffPortAccess } from '../../services/staffPortAccess';
import { databaseRequestError } from '../../data/databaseErrors';
const checking = ref(false), error = ref('');
function showToast() {
  notify('Port assignment needed. Ask your administrator to assign a departure port.');
}
watch(() => staffPortAccess.notice, () => { if (claimStaffPortNotice()) void showToast(); }, { immediate: true });
async function check() {
  if (!staffDatabase || checking.value) return;
  checking.value = true; error.value = '';
  try { if (!(await checkStaffPortAccess(staffDatabase, true))) await showToast(); }
  catch (cause) { error.value = notifyError(databaseRequestError(cause, 'Could not check your assignment. Please try again.')); }
  finally { checking.value = false; }
}
</script>
<style scoped>
.port-required { display: grid; justify-items: center; gap: 12px; padding: 40px 24px; border: 1px solid var(--line); border-radius: 16px; background: var(--surface); text-align: center; color: var(--ink); }
.port-required-icon { display: grid; place-items: center; width: 56px; height: 56px; background: var(--light-blue); color: var(--ocean); border-radius: 16px; font-size: 28px; }
h2 { margin: 4px 0 0; font-size: 22px; } p { max-width: 460px; margin: 0; font-size: 14px; line-height: 1.6; color: var(--muted); }.port-required-help { font-size: var(--text-label); } button { margin-top: 8px; }
@media(max-width:600px) { .port-required { padding: 28px 18px; } h2 { font-size: 20px; } }
</style>
