<template>
  <section class="two-factor-settings" aria-labelledby="two-factor-heading" :aria-busy="busy">
    <header><div><h2 id="two-factor-heading">Two-factor authentication</h2><p>Add an authenticator code to your sign-in.</p></div><button v-if="settings" class="mfa-switch" type="button" role="switch" aria-label="Two-factor authentication" :aria-checked="settings.enabled" :disabled="busy || loading || disabling || enabling || (settings.enabled && settings.policyRequired)" @click="toggleAccount"><span class="switch-track" aria-hidden="true"><span class="switch-thumb"></span></span><span class="switch-value" aria-hidden="true">{{ settings.enabled ? 'On' : 'Off' }}</span></button></header>
    <p v-if="loading" role="status">Loading security settings...</p>
    <p v-if="error" class="mfa-error" role="alert">{{ error }}</p>
    <button v-if="!settings && !loading" type="button" @click="load">Retry security settings</button>
    <template v-if="settings">
      <p v-if="settings.policyRequired" class="mfa-policy-note">Your administrator requires 2FA for staff. You cannot turn it off.</p>
      <p v-else>{{ settings.enabled ? 'Your account asks for an authenticator code when you sign in.' : settings.authenticatorLinked ? 'Your authenticator is still linked. Enter its code to turn 2FA back on.' : '2FA is optional for your account. Turn it on to connect an authenticator app.' }}</p>
      <form v-if="disabling || enabling" class="mfa-disable-form" @submit.prevent="confirmToggle">
        <label for="disable-mfa-code">Current authenticator code<input id="disable-mfa-code" v-model="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" placeholder="000000" required :disabled="busy" /></label>
        <p>Enter a fresh code to turn {{ enabling ? 'on' : 'off' }} 2FA. Your authenticator stays linked.</p>
        <div class="mfa-actions"><button type="submit" :disabled="busy || !/^\d{6}$/.test(code)">{{ busy ? 'Verifying...' : enabling ? 'Verify and turn on' : 'Verify and turn off' }}</button><button type="button" :disabled="busy" @click="cancel">Cancel</button></div>
      </form>
      <div v-if="settings.role==='ADMIN'" class="staff-mfa-policy">
        <div class="policy-row"><div><h3>Staff security policy</h3><p class="policy-label">Require 2FA for staff</p></div><button class="mfa-switch" type="button" role="switch" aria-label="Require 2FA for staff" :aria-checked="settings.staffRequired" :disabled="busy || loading || disabling || enabling" @click="savePolicy"><span class="switch-track" aria-hidden="true"><span class="switch-thumb"></span></span><span class="switch-value" aria-hidden="true">{{ settings.staffRequired ? 'On' : 'Off' }}</span></button></div>
        <p>Require ticketing and boarding staff to use 2FA. Staff with 2FA enabled still verify their code even when this policy is off.</p>
      </div>
    </template>
  </section>
</template>
<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { disableAccountMfa, enableAccountMfa, loadMfaSettings, setStaffMfaRequired, type MfaSettings } from '../../services/mfaSecurity';
import { notifySuccess } from '../../composables/toast';
import { useUnsavedChanges } from '../../composables/unsavedChanges';
const route=useRoute(),router=useRouter();
const settings=ref<MfaSettings|null>(null),loading=ref(false),busy=ref(false),error=ref('');
const disabling=ref(false),code=ref(''),enabling=ref(false);
defineExpose({refresh:load});
useUnsavedChanges(()=>!!code.value);
async function load(){loading.value=true;error.value='';try{settings.value=await loadMfaSettings();}catch{error.value='Could not load security settings. Try again.';}finally{loading.value=false;}}
function toggleAccount(){if(!settings.value || busy.value || loading.value || disabling.value || enabling.value)return;if(settings.value.enabled){if(!settings.value.policyRequired)disabling.value=true;}else if(settings.value.authenticatorLinked){enabling.value=true;}else enable();}
function enable(){void router.push({path:'/verify-staff',query:{returnTo:route.path}});}
function cancel(){disabling.value=false;enabling.value=false;code.value='';error.value='';}
async function confirmToggle(){if(busy.value || !/^\d{6}$/.test(code.value))return;busy.value=true;error.value='';const turnOn=enabling.value;try{settings.value=await (turnOn ? enableAccountMfa(code.value) : disableAccountMfa(code.value));cancel();notifySuccess(`Two-factor authentication turned ${turnOn ? 'on' : 'off'}.`);}catch(e){code.value='';error.value=e instanceof Error ? e.message : 'Could not change 2FA. Try again.';}finally{busy.value=false;}}

async function savePolicy(){if(busy.value || !settings.value)return;busy.value=true;error.value='';try{settings.value=await setStaffMfaRequired(!settings.value.staffRequired);notifySuccess('Staff security policy saved.');}catch{error.value='Could not save the staff security policy. Try again.';}finally{busy.value=false;}}
onMounted(load);
</script>
<style scoped>
.two-factor-settings { margin-bottom:20px; padding:20px; border:1px solid var(--line); border-radius:12px; background:var(--surface); color:var(--ink); }
header { display:flex; justify-content:space-between; align-items:center; gap:16px; }h2 { margin:0; font-size:18px; }h3 { margin:0; font-size:15px; }p { margin:8px 0 12px; color:var(--muted); font-size:13px; line-height:1.6; }
button { padding:9px 14px; border:1px solid var(--line); border-radius:8px; background:var(--surface-soft); color:var(--ink); font:inherit; font-size:13px; cursor:pointer; }button:disabled { opacity:.5; cursor:default; }button:focus-visible,input:focus-visible { outline:2px solid var(--primary); outline-offset:3px; }
.mfa-disable-form { margin-top:14px; }.mfa-disable-form label { display:grid; gap:8px; max-width:280px; font-size:13px; }.mfa-disable-form input { padding:10px 12px; width:100%; min-width:0; border:1px solid var(--line); border-radius:8px; background:var(--surface-soft); color:var(--ink); font:inherit; font-size:18px; letter-spacing:.2em; }.mfa-actions { display:flex; gap:8px; flex-wrap:wrap; }.staff-mfa-policy { border-top:1px solid var(--line); margin-top:20px; padding-top:18px; }.mfa-error { color:var(--danger); }.mfa-policy-note { padding:10px 12px; border-radius:8px; background:var(--surface-soft); }
.policy-row { display:flex; align-items:center; justify-content:space-between; gap:16px; }.policy-label { margin:6px 0 0; }.mfa-switch { display:inline-flex; align-items:center; gap:9px; flex:none; min-height:44px; padding:6px 0 6px 6px; border:0; background:transparent; }.switch-track { position:relative; display:block; width:44px; height:26px; border:1px solid var(--muted); border-radius:20px; background:var(--surface-soft); transition:background .15s,border-color .15s; }.switch-thumb { position:absolute; top:3px; left:3px; width:18px; height:18px; border-radius:50%; background:var(--muted); transition:transform .15s,background .15s; }.mfa-switch[aria-checked="true"] .switch-track { background:var(--action,#1565c0); border-color:var(--action,#1565c0); }.mfa-switch[aria-checked="true"] .switch-thumb { transform:translateX(18px); background:#fff; }.switch-value { min-width:23px; font-size:12px; font-weight:600; }.mfa-switch:disabled { cursor:not-allowed; }@media(prefers-reduced-motion:reduce){.switch-track,.switch-thumb{transition:none;}}
@media(max-width:600px){.two-factor-settings{padding:16px;}.mfa-disable-form input{font-size:18px;}}
</style>
