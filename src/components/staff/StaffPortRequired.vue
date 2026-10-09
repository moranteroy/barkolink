<template>
  <section ref="noticeElement" class="port-required" aria-labelledby="port-required-title">
    <span class="port-required-icon"><IonIcon :icon="idCardOutline" aria-hidden="true" /></span>
    <h2 id="port-required-title">Port assignment needed</h2>
    <p>Ask your administrator to assign your departure port before you start terminal operations.</p>
    <p class="port-required-help">Once assigned, check again to open your workspace.</p>
    <Button variant="outline" :disabled="checking" @click="check"><IonIcon :icon="refreshOutline" aria-hidden="true" />{{ checking ? 'Checking…' : 'Check assignment' }}</Button>
    <p v-if="error" role="alert">{{ error }}</p>
  </section>
  <IonToast
    class="port-assignment-toast"
    :is-open="toastOpen"
    header="Port assignment needed"
    message="Ask your administrator to assign a departure port."
    :icon="informationCircleOutline"
    :duration="5000"
    position="top"
    :position-anchor="toastAnchor"
    :buttons="[{ icon: closeOutline, role: 'cancel', htmlAttributes: { 'aria-label': 'Dismiss port notice' } }]"
    @didDismiss="toastOpen = false"
  />
</template>
<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import { IonIcon, IonToast } from '@ionic/vue';
import { closeOutline, idCardOutline, informationCircleOutline, refreshOutline } from 'ionicons/icons';
import { Button } from '@/components/ui/button';
import { staffDatabase } from '../../services/session';
import { checkStaffPortAccess, claimStaffPortNotice, staffPortAccess } from '../../services/staffPortAccess';
import { databaseRequestError } from '../../data/databaseErrors';
const toastOpen = ref(false), checking = ref(false), error = ref('');
const noticeElement = ref<HTMLElement>();
const toastAnchor = ref<HTMLElement>();
async function showToast() {
  await nextTick();
  toastAnchor.value = noticeElement.value?.closest('.ion-page')?.querySelector<HTMLElement>('.staff-workspace-header') || undefined;
  toastOpen.value = true;
}
watch(() => staffPortAccess.notice, () => { if (claimStaffPortNotice()) void showToast(); }, { immediate: true });
async function check() {
  if (!staffDatabase || checking.value) return;
  checking.value = true; error.value = '';
  try { if (!(await checkStaffPortAccess(staffDatabase, true))) await showToast(); }
  catch (cause) { error.value = databaseRequestError(cause, 'Could not check your assignment. Please try again.'); }
  finally { checking.value = false; }
}
</script>
<style scoped>
.port-required { display: grid; justify-items: center; gap: 12px; padding: 40px 24px; border: 1px solid var(--line); border-radius: 16px; background: var(--surface); text-align: center; color: var(--ink); }
.port-required-icon { display: grid; place-items: center; width: 56px; height: 56px; background: var(--light-blue); color: var(--ocean); border-radius: 16px; font-size: 28px; }
h2 { margin: 4px 0 0; font-size: 22px; } p { max-width: 460px; margin: 0; font-size: 14px; line-height: 1.6; color: var(--muted); }.port-required-help { font-size: 12px; } button { margin-top: 8px; }
@media(max-width:600px) { .port-required { padding: 28px 18px; } h2 { font-size: 20px; } }
:global(ion-toast.port-assignment-toast) { --background: var(--surface); --color: var(--ink); --button-color: var(--muted); --width: calc(100% - 32px); --max-width: 420px; --border-radius: 14px; --border-width: 1px; --border-style: solid; --border-color: var(--line); --box-shadow: 0 8px 28px #061a3530; }
:global(ion-toast.port-assignment-toast::part(wrapper)) { box-sizing: border-box; margin-inline-start: auto; margin-inline-end: 24px; }
:global(ion-toast.port-assignment-toast::part(container)) { align-items: center; }
:global(ion-toast.port-assignment-toast::part(icon)) { color: var(--ocean); font-size: 24px; margin-inline: 16px 0; }
:global(ion-toast.port-assignment-toast::part(content)) { padding: 14px 12px; }
:global(ion-toast.port-assignment-toast::part(header)) { color: var(--ink); font-size: 13px; font-weight: 650; line-height: 1.4; margin-bottom: 4px; }
:global(ion-toast.port-assignment-toast::part(message)) { color: var(--muted); font-size: 12px; line-height: 1.5; }
:global(ion-toast.port-assignment-toast::part(button)) { color: var(--muted); min-width: 44px; min-height: 44px; margin: 0 6px 0 0; padding: 0; }
@media(max-width:600px) { :global(ion-toast.port-assignment-toast::part(wrapper)) { margin-inline: auto; } }
</style>
