<template>
  <section class="tracking-panel">
    <header><div><p class="eyebrow">VESSEL TRACKING</p><h2>Vessel locations</h2><p>Confirm the vessel's port. Bookings follow its port and planned voyages.</p></div><Button variant="outline" :disabled="loading || saving" @click="load">Refresh locations</Button></header>
    <p v-if="error" role="alert" class="error">{{ error }}</p><p v-if="notice" role="status">{{ notice }}</p>
    <p v-if="loading" role="status">Loading vessel locations...</p>
    <label class="search">Find vessel<input v-model.trim="search" type="search" placeholder="Vessel or operator" /></label>
    <div class="location-list"><article v-for="vessel in visible" :key="vessel.id"><div><strong>{{ vessel.name }}</strong><small>{{ vessel.operator }}</small></div><div class="position"><Badge :variant="vessel.position.state === 'CONFIRMED' ? 'success' : ['UNKNOWN','CONFLICT','DELAYED'].includes(vessel.position.state) ? 'warning' : 'default'">{{ label(vessel.position) }}</Badge><strong>{{ location(vessel.position) }}</strong><small v-if="vessel.position.confirmedAt">Last confirmed: {{ vessel.position.confirmedPortName }} &middot; {{ format(vessel.position.confirmedAt) }}</small><small v-else-if="vessel.position.reason">{{ vessel.position.reason }}</small><small v-if="vessel.position.tripCode">Trip {{ vessel.position.tripCode }}</small></div><Button variant="outline" size="sm" :disabled="saving" :aria-label="`Confirm port for ${vessel.name}`" @click="open(vessel)">Confirm port</Button></article></div>
    <p class="tracking-note">Expected locations follow scheduled voyages. Confirm actual arrival with the terminal; a Completed status alone does not verify the vessel's physical location.</p>
    <IonModal class="position-modal" :is-open="!!selected" :can-dismiss="canDismiss" @didDismiss="selected = null"><div class="position-dialog"><header><div><p class="eyebrow">PORT CONFIRMATION</p><h2>{{ selected?.name }}</h2></div><button type="button" class="close" aria-label="Close port confirmation" :disabled="saving" @click="close"><AppIcon :icon="closeOutline" /></button></header><form @submit.prevent="save"><div class="editor"><p v-if="formError" class="error" role="alert">{{ formError }}</p><label>Confirmed port<select v-model="form.portId" required><option value="" disabled>Select port</option><option v-for="port in data.ports" :key="port.id" :value="port.id">{{ port.name }}</option></select></label><label>Observed at (Philippine time)<input v-model="form.observedAt" type="datetime-local" :max="localNow()" required /></label><label>Port confirmation<textarea v-model.trim="form.note" rows="3" required minlength="3" maxlength="500" placeholder="Who confirmed the vessel's presence and when?" /></label><p>Record the vessel's actual port, including a transfer or arrival. This updates availability for new bookings.</p></div><footer><Button variant="outline" :disabled="saving" @click="close">Cancel</Button><Button type="submit" :disabled="saving">{{ saving ? 'Saving...' : 'Confirm location' }}</Button></footer></form></div></IonModal>
  </section>
</template>
<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { IonModal } from '@ionic/vue';
import AppIcon from '../ui/icon/AppIcon.vue';
import { closeOutline } from 'ionicons/icons';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { staffDatabase } from '../../services/session';
import { confirmVesselPort, vesselPositions, type VesselPosition, type VesselPositions } from '../../services/database/vesselTracking';
import { databaseRequestError } from '../../data/databaseErrors';
import { confirmAction } from '../../composables/confirmation';
import { useUnsavedChanges } from '../../composables/unsavedChanges';
const data=ref<VesselPositions>({vessels:[],ports:[]});
const loading=ref(false),saving=ref(false),error=ref(''),notice=ref(''),formError=ref(''),search=ref('');
const selected=ref<VesselPositions['vessels'][number]|null>(null);
const form=reactive({portId:'',observedAt:'',note:''});let baseline='';
const dirty=()=>!!selected.value && JSON.stringify(form)!==baseline;
useUnsavedChanges(dirty);
defineExpose({hasUnsavedChanges:dirty,hasOpenEditor:()=>!!selected.value,isBusy:()=>saving.value,refresh:load});
const visible=computed(()=>data.value.vessels.filter(v=>`${v.name} ${v.operator}`.toLowerCase().includes(search.value.toLowerCase())));
const label=(p:VesselPosition)=>({UNKNOWN:'Not confirmed',CONFIRMED:'Confirmed',EXPECTED:'Expected from schedule',UNDERWAY:'Expected underway',DELAYED:'Delayed voyage',CONFLICT:'Itinerary needs review'}[p.state]);
const portName=(id?:string)=>data.value.ports.find(p=>p.id===id)?.name || 'another port';
const location=(p:VesselPosition)=>p.portName || (p.state==='UNDERWAY' ? `${portName(p.originPortId)} ? ${portName(p.destinationPortId)}` : 'Confirm current port');
const format=(value:string)=>new Intl.DateTimeFormat('en-PH',{timeZone:'Asia/Manila',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(value));
const localNow=()=>new Date(Date.now()+8*3600000).toISOString().slice(0,16);
async function load(){if(!staffDatabase || saving.value)return;loading.value=true;error.value='';try{data.value=(await vesselPositions(staffDatabase)).data;}catch(e){error.value=databaseRequestError(e,'Could not load vessel locations.');}finally{loading.value=false;}}
function open(vessel:VesselPositions['vessels'][number]){selected.value=vessel;Object.assign(form,{portId:vessel.position.state==='CONFIRMED' ? vessel.position.portId || '' : '',observedAt:localNow(),note:''});baseline=JSON.stringify(form);formError.value='';}
async function canDismiss(){return !saving.value && (!dirty() || await confirmAction({title:'Discard port confirmation?',message:'The vessel location has not been saved.',confirmText:'Discard changes'}));}
async function close(){if(await canDismiss())selected.value=null;}
async function save(){if(!staffDatabase || !selected.value || saving.value)return;saving.value=true;formError.value='';try{data.value=(await confirmVesselPort(staffDatabase,{vesselId:selected.value.id,portId:form.portId,observedAt:new Date(`${form.observedAt}:00+08:00`).toISOString(),note:form.note})).data;baseline=JSON.stringify(form);selected.value=null;notice.value='Vessel location confirmed. New bookings now use this port and its planned voyages.';}catch(e){formError.value=databaseRequestError(e,'Could not confirm the vessel port.');}finally{saving.value=false;}}
onMounted(load);
</script>
<style scoped>
.tracking-panel { margin:16px 0; padding:18px; border:1px solid var(--line); border-radius:14px; background:var(--surface); color:var(--ink); }
header { display:flex; justify-content:space-between; align-items:center; gap:16px; }h2 { margin:0; font-size:18px; }p,small,label { font-size:12px; line-height:1.6; }p,small { color:var(--muted); }.eyebrow { font-size:10px; letter-spacing:.08em; margin:0 0 6px; font-weight:700; }.search { max-width:360px; margin:16px 0; }
label { display:grid; gap:6px; }input,select,textarea { width:100%; box-sizing:border-box; min-width:0; padding:10px 12px; border:1px solid var(--line); border-radius:8px; background:var(--surface-soft); color:var(--ink); font:inherit; min-height:42px; }textarea { resize:vertical; }
.location-list { display:grid; gap:0; max-height:480px; overflow:auto; }article { display:grid; grid-template-columns:minmax(170px,1fr) minmax(220px,1.4fr) auto; align-items:center; gap:16px; border-top:1px solid var(--line); padding:14px 0; }article>div { display:grid; gap:4px; min-width:0; }article strong { font-size:13px; }.position :deep([data-slot="badge"]) { justify-self:start; }.tracking-note { border-top:1px solid var(--line); padding-top:12px; margin-bottom:0; }.error { color:var(--danger); }
.position-modal { --width:min(560px,calc(100vw - 32px)); --height:auto; --max-height:calc(100dvh - 32px); --background:var(--surface); --border-radius:16px; }.position-dialog { display:flex; flex-direction:column; max-height:calc(100dvh - 32px); background:var(--surface); color:var(--ink); font-family:var(--ion-font-family); }.position-dialog header { padding:18px; border-bottom:1px solid var(--line); flex:none; }.close { width:44px; height:44px; display:grid; place-items:center; border:1px solid var(--line); border-radius:10px; background:var(--surface-soft); color:var(--muted); }.close .app-icon { font-size:22px; }form { display:flex; flex-direction:column; min-height:0; }.editor { display:grid; gap:16px; padding:18px; overflow:auto; }footer { display:flex; justify-content:end; gap:10px; padding:16px 18px; border-top:1px solid var(--line); flex:none; }
@media(max-width:740px) { header { flex-wrap:wrap; }article { grid-template-columns:1fr auto; gap:12px; }.position { grid-row:2; grid-column:1/-1; }input,select,textarea { font-size:16px; } }
</style>
