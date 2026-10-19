<template>
  <section class="tracking-panel">
    <header class="tracking-header"><div><p class="eyebrow">VESSEL TRACKING</p><h2>Automatic vessel locations</h2><p>Locations follow each vessel's departure and arrival schedule.</p></div><span class="automatic-badge">Automatic</span></header>
    <p v-if="error" role="alert" class="error">{{ error }}</p>
    <div class="tracking-toolbar"><label class="search"><span class="sr-only">Find vessel</span><input v-model.trim="search" type="search" placeholder="Find vessel or operator" /></label><div class="tracking-sync" role="status"><span :class="{ 'sync-delayed': !!error }">{{ error ? 'Updates delayed' : 'Updates every 30s' }}</span><small v-if="updatedAt">Updated {{ format(updatedAt) }}</small></div><Button variant="outline" size="sm" :disabled="loading || saving" @click="load()">{{ loading ? 'Refreshing...' : 'Refresh' }}</Button></div>
    <p v-if="loading && !updatedAt" role="status">Loading vessel locations...</p>
    <div class="location-columns" aria-hidden="true"><span>Vessel / operator</span><span>Estimated location</span><span>Tracking status</span></div>
    <div class="location-list"><article v-for="vessel in paginated" :key="vessel.id"><div class="vessel-identity"><strong>{{ vessel.name }}</strong><small>{{ vessel.operator }}</small></div><div class="position"><strong>{{ location(vessel.position) }}</strong><small v-if="vessel.position.state==='UNDERWAY' && vessel.position.arrivalAt">Arrival {{ format(vessel.position.arrivalAt) }}</small><small v-else-if="vessel.position.tripCode">{{ vessel.position.tripCode }}</small><small v-if="['UNKNOWN','DELAYED','CONFLICT'].includes(vessel.position.state)" class="position-note">{{ positionHint(vessel.position) }}</small></div><div class="tracking-state"><Badge :variant="vessel.position.state === 'CONFIRMED' ? 'success' : ['UNKNOWN','CONFLICT','DELAYED'].includes(vessel.position.state) ? 'warning' : 'default'">{{ label(vessel.position) }}</Badge><small v-if="vessel.position.confirmedAt">Port updated {{ format(vessel.position.confirmedAt) }}</small></div></article></div>
    <p v-if="!loading && !visible.length" class="empty-locations">{{ search ? 'No vessels match your search.' : 'No active vessels to track.' }}</p>
    <div v-if="visible.length > pageSize" class="tracking-pagination"><small>{{ (page - 1) * pageSize + 1 }}-{{ Math.min(page * pageSize, visible.length) }} of {{ visible.length }} vessels</small><div><Button variant="outline" size="sm" :disabled="page===1" @click="page--">Previous</Button><Button variant="outline" size="sm" :disabled="page===pageCount" @click="page++">Next</Button></div></div>
    <p class="tracking-note">Expected locations follow scheduled voyages automatically. No confirmation is needed for routine tracking. Estimates use Philippine time and are not live GPS.</p>
    <details class="manual-correction"><summary>Correct a location (optional)</summary><p>Use only for an unscheduled transfer or a reported location that differs from the timetable. For a delayed voyage, update its trip schedule.</p><div class="correction-controls"><label for="correction-vessel">Vessel<select id="correction-vessel" v-model="correctionVesselId"><option value="">Choose vessel</option><option v-for="vessel in data.vessels" :key="vessel.id" :value="vessel.id">{{ vessel.name }}</option></select></label><Button variant="outline" size="sm" :disabled="!correctionVesselId || saving" @click="openCorrection">Correct location</Button></div></details>
    <IonModal class="position-modal" :is-open="!!selected" :can-dismiss="canDismiss" @didDismiss="selected = null"><div class="position-dialog"><header><div><p class="eyebrow">LOCATION CORRECTION</p><h2>{{ selected?.name }}</h2></div><button type="button" class="close" aria-label="Close port confirmation" :disabled="saving" @click="close"><AppIcon :icon="closeOutline" /></button></header><form @submit.prevent="save"><div class="editor"><p v-if="formError" class="error" role="alert">{{ formError }}</p><label>Actual port<select v-model="form.portId" required><option value="" disabled>Select port</option><option v-for="port in data.ports" :key="port.id" :value="port.id">{{ port.name }}</option></select></label><label>Observed at (Philippine time)<input v-model="form.observedAt" type="datetime-local" :max="localNow()" required /></label><label>Correction note<textarea v-model.trim="form.note" rows="3" required minlength="3" maxlength="500" placeholder="Explain the correction and who reported the location." /></label><p>This optional correction overrides the schedule estimate from the recorded time.</p></div><footer><Button variant="outline" :disabled="saving" @click="close">Cancel</Button><Button type="submit" :disabled="saving">{{ saving ? 'Saving...' : 'Save correction' }}</Button></footer></form></div></IonModal>
  </section>
</template>
<script setup lang="ts">
import { notifyError, notifySuccess } from '@/composables/toast';
import { computed, onMounted, onBeforeUnmount, reactive, ref, watch } from 'vue';
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
const updatedAt=ref(''), correctionVesselId=ref(''), page=ref(1);
const pageSize=5;
let disposed=false, requestVersion=0, refreshTimer: ReturnType<typeof setInterval> | undefined;
const data=ref<VesselPositions>({vessels:[],ports:[]});
const loading=ref(false),saving=ref(false),error=ref(''),formError=ref(''),search=ref('');
const selected=ref<VesselPositions['vessels'][number]|null>(null);
const form=reactive({portId:'',observedAt:'',note:''});let baseline='';
const dirty=()=>!!selected.value && JSON.stringify(form)!==baseline;
useUnsavedChanges(dirty);
defineExpose({hasUnsavedChanges:dirty,hasOpenEditor:()=>!!selected.value,isBusy:()=>saving.value,refresh:load});
const visible=computed(()=>data.value.vessels.filter(v=>`${v.name} ${v.operator}`.toLowerCase().includes(search.value.toLowerCase())));
const label=(p:VesselPosition)=>({UNKNOWN:'No trip data',CONFIRMED:'Port recorded',EXPECTED:'Expected at port',UNDERWAY:'Expected underway',DELAYED:'Delayed voyage',CONFLICT:'Itinerary needs review'}[p.state]);
const portName=(id?:string)=>data.value.ports.find(p=>p.id===id)?.name || 'another port';
const location=(p:VesselPosition)=>p.portName || (p.state==='UNDERWAY' ? `${portName(p.originPortId)} \u2192 ${portName(p.destinationPortId)}` : p.state==='DELAYED' ? 'Voyage delayed' : p.state==='CONFLICT' ? 'Review itinerary' : 'No scheduled location');
const pageCount=computed(()=>Math.max(1,Math.ceil(visible.value.length/pageSize)));
const paginated=computed(()=>visible.value.slice((page.value-1)*pageSize,page.value*pageSize));
watch(search,()=>{page.value=1;});
watch(pageCount,count=>{page.value=Math.min(page.value,count);});
const positionHint=(p:VesselPosition)=>p.state==='UNKNOWN' ? 'Add an actual trip to start automatic tracking.' : p.state==='DELAYED' ? 'Update the trip when the revised times are known.' : 'Check the connection between scheduled voyages.';
function openCorrection(){const vessel=data.value.vessels.find(v=>v.id===correctionVesselId.value);if(vessel)open(vessel);}
const format=(value:string)=>new Intl.DateTimeFormat('en-PH',{timeZone:'Asia/Manila',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(value));
const localNow=()=>new Date(Date.now()+8*3600000).toISOString().slice(0,16);
async function load(background=false){
  if(!staffDatabase || loading.value || saving.value || (background && (selected.value || document.visibilityState==='hidden')))return;
  const version=++requestVersion;
  loading.value=true;
  try {
    const result=await vesselPositions(staffDatabase);
    if(disposed || version!==requestVersion)return;
    data.value=result.data;updatedAt.value=new Date().toISOString();error.value='';
  } catch(e) {
    if(disposed || version!==requestVersion)return;
    const message=databaseRequestError(e,'Could not load vessel locations.');
    error.value=background ? message : notifyError(message);
  } finally { if(!disposed && version===requestVersion)loading.value=false; }
}
function resume(){if(document.visibilityState==='visible')void load(true);}

function open(vessel:VesselPositions['vessels'][number]){selected.value=vessel;Object.assign(form,{portId:vessel.position.portId || '',observedAt:localNow(),note:''});baseline=JSON.stringify(form);formError.value='';}
async function canDismiss(){return !saving.value && (!dirty() || await confirmAction({title:'Discard location correction?',message:'The location correction has not been saved.',confirmText:'Discard changes'}));}
async function close(){if(await canDismiss())selected.value=null;}
async function save(){if(!staffDatabase || !selected.value || saving.value)return;requestVersion++;loading.value=false;saving.value=true;formError.value='';try{data.value=(await confirmVesselPort(staffDatabase,{vesselId:selected.value.id,portId:form.portId,observedAt:new Date(`${form.observedAt}:00+08:00`).toISOString(),note:form.note})).data;updatedAt.value=new Date().toISOString();error.value='';baseline=JSON.stringify(form);selected.value=null;notifySuccess('Location correction saved. Automatic tracking continues from this port.');}catch(e){formError.value=notifyError(databaseRequestError(e,'Could not save the location correction.'));}finally{saving.value=false;}}
onMounted(()=>{void load();refreshTimer=setInterval(()=>void load(true),30000);document.addEventListener('visibilitychange',resume);});
onBeforeUnmount(()=>{disposed=true;requestVersion++;clearInterval(refreshTimer);document.removeEventListener('visibilitychange',resume);});
</script>
<style scoped>
.tracking-panel { margin:16px 0; padding:18px; border:1px solid var(--line); border-radius:14px; background:var(--surface); color:var(--ink); }
header { display:flex; justify-content:space-between; align-items:center; gap:16px; }h2 { margin:0; font-size:18px; }p,small,label { font-size: var(--text-label); line-height:1.6; }p,small { color:var(--muted); }.eyebrow { font-size: var(--text-caption); letter-spacing:.08em; margin:0 0 6px; font-weight:700; }.search { max-width:360px; margin:16px 0; }
label { display:grid; gap:6px; }input,select,textarea { width:100%; box-sizing:border-box; min-width:0; padding:10px 12px; border:1px solid var(--line); border-radius:8px; background:var(--surface-soft); color:var(--ink); font:inherit; min-height:42px; }textarea { resize:vertical; }
.tracking-header { align-items:flex-start; }.tracking-header p { margin:5px 0 0; }.automatic-badge { flex:none; padding:5px 10px; border:1px solid var(--line); border-radius:20px; background:var(--surface-soft); color:var(--primary); font-size:12px; font-weight:600; }
.tracking-toolbar { display:flex; align-items:center; gap:12px; margin:16px 0 12px; }.tracking-toolbar .search { flex:1; max-width:360px; margin:0; }.tracking-sync { display:grid; gap:2px; margin-left:auto; text-align:right; font-size:12px; color:var(--muted); }.tracking-sync small { font-size:11px; }.sync-delayed,.position-note { color:var(--warning, #b7791f); }
.location-columns,.location-list article { display:grid; grid-template-columns:minmax(160px,1fr) minmax(190px,1.2fr) minmax(160px,.8fr); gap:16px; align-items:center; }.location-columns { padding:9px 12px; background:var(--surface-soft); border-radius:7px; color:var(--muted); font-size:11px; font-weight:600; }
.location-list article { padding:12px; border-bottom:1px solid var(--line); min-height:70px; box-sizing:border-box; }.location-list article>div { display:grid; gap:4px; min-width:0; }.location-list strong { font-size:13px; line-height:1.4; overflow-wrap:anywhere; }.location-list small { font-size:11px; line-height:1.4; }.tracking-state :deep([data-slot="badge"]) { justify-self:start; font-size:11px; }.tracking-pagination { display:flex; align-items:center; justify-content:space-between; gap:12px; padding-top:12px; }.tracking-pagination>div { display:flex; gap:8px; }.tracking-note { padding-top:12px; margin:12px 0 0; border-top:1px solid var(--line); font-size:12px; }.error { color:var(--danger); }.empty-locations { text-align:center; padding:20px; }
.manual-correction { margin-top:12px; border-top:1px solid var(--line); padding-top:12px; }.manual-correction summary { width:fit-content; cursor:pointer; color:var(--muted); font-size:12px; }.manual-correction p { margin:10px 0; font-size:12px; }.correction-controls { display:flex; align-items:end; gap:12px; }.correction-controls label { flex:1; max-width:360px; }
.position-modal { --width:min(560px,calc(100vw - 32px)); --height:auto; --max-height:calc(100dvh - 32px); --background:var(--surface); --border-radius:16px; }.position-dialog { display:flex; flex-direction:column; max-height:calc(100dvh - 32px); background:var(--surface); color:var(--ink); font-family:var(--ion-font-family); }.position-dialog header { padding:18px; border-bottom:1px solid var(--line); flex:none; }.close { width:44px; height:44px; display:grid; place-items:center; border:1px solid var(--line); border-radius:10px; background:var(--surface-soft); color:var(--muted); }.close .app-icon { font-size:22px; }form { display:flex; flex-direction:column; min-height:0; }.editor { display:grid; gap:16px; padding:18px; overflow:auto; }footer { display:flex; justify-content:end; gap:10px; padding:16px 18px; border-top:1px solid var(--line); flex:none; }
@media(max-width:740px) { .tracking-panel { padding:14px; }.tracking-header { gap:10px; }.tracking-toolbar { flex-wrap:wrap; gap:8px; }.tracking-toolbar .search { flex-basis:100%; max-width:none; }.tracking-sync { margin-left:0; text-align:left; flex:1; }.location-columns { display:none; }.location-list article { grid-template-columns:minmax(0,1fr) auto; gap:8px 12px; padding:12px 0; }.position { grid-row:2; grid-column:1/-1; }.tracking-state { grid-column:2; grid-row:1; }.tracking-pagination { flex-wrap:wrap; }.correction-controls { align-items:stretch; flex-direction:column; }input,select,textarea { font-size:16px; } }
</style>
