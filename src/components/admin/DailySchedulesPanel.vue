<template>
  <section class="daily-schedules">
    <header class="panel-heading"><div><p class="eyebrow">RECURRING DEPARTURES</p><h2>Daily schedules</h2><p>Choose a departure, then confirm the trip details before saving.</p></div><Button :disabled="disabled || loading || !!busy" @click="edit()"><AppIcon :icon="addOutline" aria-hidden="true" />Add schedule</Button></header>
    <p v-if="error" class="message error" role="alert">{{ error }}</p><div v-if="notice" class="message schedule-feedback" role="status"><span>{{ notice }}</span><Button v-if="lastPaused?.routeActive && !lastPaused.isActive" variant="outline" size="sm" :disabled="!!busy || disabled" :aria-label="`Resume recently paused schedule ${lastPaused.operator} ${lastPaused.routeCode}`" @click="toggle(lastPaused)"><AppIcon :icon="playOutline" aria-hidden="true" />Resume schedule</Button></div>
    <div class="filters"><label>Operator<select v-model="operator" aria-label="Operator"><option value="">All operators</option><option v-for="name in operators" :key="name">{{ name }}</option></select></label><label>Schedule status<select v-model="status" aria-label="Schedule status"><option value="ALL">All statuses</option><option value="ACTIVE">Active</option><option value="PAUSED">Paused</option></select></label><label>Trip date<input v-model="date" aria-label="Trip date" type="date" :min="today"></label></div>
    <p v-if="loading" class="message" role="status">Loading daily schedules...</p><Button v-if="error && !loading" variant="outline" @click="load">Retry schedules</Button>
    <div v-else class="schedule-cards">
      <template v-for="(item, index) in filtered" :key="item.id"><div v-if="!item.routeActive && (index === 0 || filtered[index - 1]?.routeActive)" class="inactive-divider"><h3>Inactive routes &amp; ports</h3><p>These schedules are unavailable until their route and both ports are active.</p></div><article :class="{ unavailable: !available(item), 'route-unavailable': !item.routeActive }">
        <div class="card-heading"><strong>{{ item.operator }}</strong><Badge :variant="available(item) ? 'success' : 'destructive'">{{ !item.routeActive ? 'Inactive route' : item.isActive ? 'Active' : 'Paused' }}</Badge></div>
        <h3>{{ item.origin }} <span aria-hidden="true">&rarr;</span> {{ item.destination }}</h3>
        <small>Daily &middot; Philippine time<span v-if="item.durationMinutes != null"> &middot; {{ durationHours(item.durationMinutes) }}</span></small>
        <details class="departure-preview"><summary>{{ timesFor(item).length }} departure{{ timesFor(item).length === 1 ? '' : 's' }} remaining</summary><div class="time-chips"><span v-for="time in timesFor(item)" :key="time">{{ displayTime(time) }}</span></div></details>
        <p v-if="item.routeActive && !timesFor(item).length" class="availability-note">Today's departures have ended. Choose tomorrow to prepare the next trip.</p>
        <p v-if="!item.routeActive" class="availability-note">Unavailable for new trips: route or port inactive.</p>
        <div class="prepare-controls"><label>Departure<select v-model="selectedTimes[item.id]" :disabled="!available(item) || !!busy || disabled" :aria-label="`Departure for ${item.operator} ${item.routeCode}`"><option v-if="!timesFor(item).length" value="">No departures remaining</option><option v-for="time in timesFor(item)" :key="time" :value="time">{{ displayTime(time) }}</option></select></label><Button :disabled="!available(item) || !date || date < today || !selectedTimes[item.id] || !!busy || disabled" @click="prepare(item)">Prepare trip</Button></div>
        <footer><Button variant="outline" size="sm" :disabled="!!busy || disabled" :aria-label="`Edit schedule ${item.operator} ${item.routeCode}`" @click="edit(item)"><AppIcon :icon="createOutline" aria-hidden="true" />Edit</Button><Button variant="outline" size="sm" :disabled="!!busy || disabled || (!item.isActive && !item.routeActive)" :title="!item.isActive && !item.routeActive ? 'Activate the route and both ports before resuming this schedule.' : undefined" :aria-label="`${item.isActive ? 'Pause' : 'Resume'} schedule ${item.operator} ${item.routeCode}`" @click="toggle(item)"><AppIcon :icon="item.isActive ? pauseOutline : playOutline" aria-hidden="true" />{{ busy === item.id ? 'Saving...' : item.isActive ? 'Pause' : 'Resume' }}</Button></footer>
      </article></template>
    </div>
    <p v-if="!loading && !error && !filtered.length" class="message">No daily schedules match. Add a schedule or change the filters.</p>
    <p class="panel-note">Paused schedules stop new trip preparation. Existing trips keep their saved details.</p>
    <IonModal class="schedule-modal" :is-open="editing" :can-dismiss="canDismiss" @didDismiss="editing = false">
      <div class="schedule-dialog"><header><div><p class="eyebrow">DAILY SCHEDULE</p><h2>{{ form.id ? 'Edit schedule' : 'Add schedule' }}</h2></div><button type="button" class="dialog-close" aria-label="Close schedule editor" :disabled="!!busy" @click="close"><AppIcon :icon="closeOutline" aria-hidden="true" /></button></header>
        <form @submit.prevent="save"><div class="form-scroll"><p v-if="formError" class="message error" role="alert">{{ formError }}</p><fieldset :disabled="!!busy"><section class="editor-section"><h3>Operator &amp; route</h3><label>Shipping operator<select v-model="form.operator" required @change="form.routeId = ''"><option value="" disabled>Select operator</option><option v-for="name in operators" :key="name">{{ name }}</option></select></label><label>Route<select v-model="form.routeId" required><option value="" disabled>Select route</option><option v-for="route in routeOptions" :key="route.id" :value="route.id">{{ route.origin }} &rarr; {{ route.destination }}{{ route.isActive ? '' : ' (inactive)' }}</option></select></label></section><section class="editor-section"><h3>Trip duration &amp; availability</h3><label>Estimated duration (hours:minutes)<input v-model.trim="form.hours" type="text" placeholder="1:30" maxlength="6"><small>Use 1:30 for 1 hour and 30 minutes, or leave blank to set arrival per trip.</small></label><label class="toggle"><input v-model="form.isActive" type="checkbox" :disabled="!chosenRoute?.isActive">Active daily schedule</label><small v-if="form.routeId && !chosenRoute?.isActive">Activate the route and both ports before resuming this schedule.</small></section>
        <section class="departure-fields editor-section"><h3>Daily departure times</h3><p class="editor-hint">Use Philippine time. Each departure time must be unique.</p><div class="time-grid"><div v-for="(_, index) in form.times" :key="index" class="time-row"><input v-model="form.times[index]" type="time" required :aria-label="`Departure time ${index + 1}`"><button type="button" class="dialog-close" :disabled="form.times.length === 1" :aria-label="`Remove departure time ${index + 1}`" @click="form.times.splice(index, 1)"><AppIcon :icon="closeOutline" aria-hidden="true" /></button></div></div><Button type="button" variant="outline" :disabled="form.times.length >= 48" @click="form.times.push('')"><AppIcon :icon="addOutline" aria-hidden="true" />Add departure time</Button></section>
        </fieldset></div><footer class="modal-footer"><Button type="button" variant="outline" :disabled="!!busy" @click="close">Cancel</Button><Button type="submit" :disabled="!!busy">{{ busy === 'form' ? 'Saving...' : 'Save schedule' }}</Button></footer></form>
      </div>
    </IonModal>
  </section>
</template>
<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, reactive, ref, watch } from 'vue';
import { IonModal } from '@ionic/vue';
import AppIcon from '@/components/ui/icon/AppIcon.vue';
import { addOutline, closeOutline, createOutline, pauseOutline, playOutline } from 'ionicons/icons';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { staffDatabase } from '../../services/session';
import { dailySchedules, saveDailySchedule, setDailyScheduleActive, type DailySchedule, type DailySchedulesData, type ScheduleRoute } from '../../services/database/dailySchedules';
import { confirmAction } from '../../composables/confirmation';
import { useUnsavedChanges } from '../../composables/unsavedChanges';
import { databaseRequestError } from '../../data/databaseErrors';
import { activeFirst } from '../../data/statusOrder';
import { durationHours, durationInput, parseDurationMinutes } from '../../data/duration';
import { manilaDate, remainingDepartures } from '../../data/dailyDepartures';
import type { PublishedDeparture } from './PublishedFerryReferences.vue';
const props = defineProps<{ disabled?: boolean }>();
const emit = defineEmits<{ plan: [departure: PublishedDeparture] }>();
const schedules = ref<DailySchedule[]>([]), routes = ref<ScheduleRoute[]>([]);
const loading = ref(false), busy = ref(''), error = ref(''), notice = ref(''), formError = ref(''), editing = ref(false);
const lastPausedId = ref('');
const lastPaused = computed(() => schedules.value.find(item => item.id === lastPausedId.value));
const operator = ref(''), status = ref('ALL');
const now = ref(Date.now());
const today = computed(() => manilaDate(now.value));
const date = ref(today.value), selectedTimes = reactive<Record<string,string>>({});
const timesFor = (item: DailySchedule) => remainingDepartures(item.departureTimes, date.value, now.value);
let clockTimer: ReturnType<typeof setInterval>;
watch(today, (next, previous) => { if (date.value === previous) date.value = next; });
watch([date, now, schedules], () => { for (const item of schedules.value) { const times = timesFor(item); if (!times.includes(selectedTimes[item.id] || '')) selectedTimes[item.id] = times[0] || ''; } });
const operators = computed(() => [...new Set(routes.value.flatMap(r => r.operators))].sort());
const available = (item: DailySchedule) => item.isActive && item.routeActive;
const changedScheduleIds = ref<string[]>([]);
watch([operator, status], () => { changedScheduleIds.value = []; });
const filtered = computed(() => activeFirst(schedules.value.filter(s => (!operator.value || s.operator === operator.value) && (status.value === 'ALL' || changedScheduleIds.value.includes(s.id) || available(s) === (status.value === 'ACTIVE'))), s => !s.routeActive));
const form = reactive({id:'',operator:'',routeId:'',hours:'',times:['08:00'],isActive:true});
const routeOptions = computed(() => activeFirst(routes.value.filter(r => r.operators.includes(form.operator)), r => !r.isActive));
const chosenRoute = computed(() => routes.value.find(r => r.id === form.routeId));
watch(chosenRoute, route => { if (!route?.isActive) form.isActive = false; else if (!form.id) form.isActive = true; });
let baseline = '';
const dirty = () => editing.value && JSON.stringify(form) !== baseline;
useUnsavedChanges(dirty);defineExpose({hasUnsavedChanges:dirty,hasOpenEditor:()=>editing.value,isBusy:()=>!!busy.value,durationForRoute:(routeId:string,operator:string)=>schedules.value.find(item=>item.routeId===routeId && item.operator===operator)?.durationMinutes,refresh:async()=>{if(busy.value)return;editing.value=false;await load();}});
async function canDismiss(){return !busy.value && (!dirty() || await confirmAction({title:'Discard schedule changes?',message:'Your daily schedule changes have not been saved.',confirmText:'Discard changes'}));}
async function close(){if(await canDismiss())editing.value=false;}
function apply(data: DailySchedulesData){
  // Keep card positions stable during edits and background refreshes.
  const positions = new Map(schedules.value.map((item, index) => [item.id, index]));
  schedules.value = positions.size
    ? [...data.schedules].sort((a, b) => (positions.get(a.id) ?? positions.size) - (positions.get(b.id) ?? positions.size))
    : activeFirst(data.schedules, item => !item.routeActive);routes.value=data.routes;for(const s of data.schedules)if(!s.departureTimes.includes(selectedTimes[s.id] || ''))selectedTimes[s.id]=s.departureTimes[0]!;}
async function load(){if(!staffDatabase)return;loading.value=true;error.value='';try{apply((await dailySchedules(staffDatabase)).data);}catch(e){error.value=databaseRequestError(e,'Could not load daily schedules.');}finally{loading.value=false;}}
function edit(item?: DailySchedule){Object.assign(form,{id:item?.id || '',operator:item?.operator || operator.value,routeId:item?.routeId || '',hours:durationInput(item?.durationMinutes),times:item ? [...item.departureTimes] : ['08:00'],isActive:!!item?.isActive && !!item?.routeActive});baseline=JSON.stringify(form);formError.value='';editing.value=true;}
async function save(){if(!staffDatabase || busy.value)return;formError.value='';const times=[...form.times].sort();const duration=String(form.hours).trim() ? parseDurationMinutes(form.hours) : null;if(!form.operator || !form.routeId || times.some(t=>!/^([01]\d|2[0-3]):[0-5]\d$/.test(t)) || new Set(times).size!==times.length || (String(form.hours).trim() && duration===null)){formError.value='Choose an operator and route, then enter unique departure times and a duration in hours:minutes (for example, 1:30).';return;}busy.value='form';try{apply((await saveDailySchedule(staffDatabase,{id:form.id || undefined,operator:form.operator,routeId:form.routeId,departureTimes:times,durationMinutes:duration,isActive:form.isActive})).data);baseline=JSON.stringify(form);editing.value=false;notice.value='Daily schedule saved.';}catch(e){formError.value=databaseRequestError(e,'Could not save daily schedule.');}finally{busy.value='';}}
async function toggle(item:DailySchedule){
  if(!staffDatabase || busy.value || props.disabled)return;
  const nextActive = !item.isActive;
  busy.value=item.id;error.value='';notice.value='';
  try{
    const result = await setDailyScheduleActive(staffDatabase,item.id,nextActive);
    if (!changedScheduleIds.value.includes(item.id)) changedScheduleIds.value.push(item.id);
    apply(result.data);
    lastPausedId.value=nextActive ? '' : item.id;
    notice.value=nextActive ? 'Daily schedule resumed.' : 'Daily schedule paused.';
  }catch(e){error.value=databaseRequestError(e,'Could not change schedule status.');}
  finally{busy.value='';}
}
function prepare(item:DailySchedule){const time=selectedTimes[item.id];if(!available(item)||!date.value||date.value<today.value||!time||!remainingDepartures(item.departureTimes,date.value,Date.now()).includes(time)||props.disabled||busy.value)return;emit('plan',{operator:item.operator,routeCode:item.routeCode,routeId:item.routeId,departureAt:`${date.value}T${time}`,durationMinutes:item.durationMinutes});}
function displayTime(time:string){const [h,m]=time.split(':').map(Number);return `${h!%12||12}:${String(m).padStart(2,'0')} ${h!<12?'AM':'PM'}`;}
onMounted(() => { void load(); clockTimer = setInterval(() => { now.value = Date.now(); }, 1000); });
onBeforeUnmount(() => clearInterval(clockTimer));
</script>
<style scoped>
.daily-schedules { border: 1px solid var(--line); border-radius: 14px; background: var(--surface); color: var(--ink); margin: 16px 0; padding: 18px; min-width: 0; }
.panel-heading, .card-heading { display: flex; justify-content: space-between; align-items: center; gap: 12px; }.panel-heading { align-items: flex-start; }.panel-heading > button { flex: none; }
.eyebrow { font-size: 10px; font-weight: 700; letter-spacing: .08em; color: var(--muted); margin: 0 0 6px; }h2 { font-size: 17px; margin: 0; }p,small { font-size: 12px; line-height: 1.6; } .panel-heading p:not(.eyebrow), small,.panel-note { color: var(--muted); }
.filters { display: flex; flex-wrap: wrap; gap: 12px; margin: 16px 0; }label { display: grid; gap: 7px; font-size: 12px; min-width: 0; }select,input:not([type="checkbox"]) { width: 100%; min-width: 0; box-sizing: border-box; background: var(--surface-soft); color: var(--ink); border: 1px solid var(--line); border-radius: 8px; padding: 10px; min-height: 42px; font: inherit; }
.schedule-cards { display: grid; grid-template-columns: repeat(auto-fit,minmax(min(100%,300px),1fr)); gap: 12px; }article { border: 1px solid var(--line); border-radius: 12px; padding: 16px; min-width: 0; }.card-heading strong { font-size: 12px; }h3 { font-size: 13px; line-height: 1.5; margin: 12px 0; }.times { min-height: 38px; margin: 0 0 8px; }.availability-note { color: var(--muted); }
.prepare-controls { display: flex; gap: 10px; align-items: end; margin-top: 16px; }.prepare-controls label { flex: 1; }article footer { display: flex; gap: 8px; margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--line); }.message { margin: 12px 0; }.error { color: var(--danger); }.panel-note { margin-bottom: 0; }
.schedule-modal { --width: min(600px,calc(100vw - 32px)); --height: auto; --max-height: calc(100dvh - 40px); --border-radius: 16px; --background: var(--surface); }.schedule-dialog { display: flex; flex-direction: column; max-height: calc(100dvh - 40px); background: var(--surface); color: var(--ink); font-family: var(--ion-font-family); }.schedule-dialog header { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 20px; border-bottom: 1px solid var(--line); flex: none; }.dialog-close { display: grid; place-items: center; width: 44px; height: 44px; flex: none; border: 1px solid var(--line); border-radius: 10px; background: var(--surface-soft); color: var(--muted); cursor: pointer; }.dialog-close .app-icon { font-size: 22px; }.schedule-dialog form { display: flex; flex-direction: column; min-height: 0; }.form-scroll { padding: 20px; overflow-y: auto; min-height: 0; }fieldset { display: grid; gap: 16px; border: 0; margin: 0; padding: 0; min-width: 0; }.time-row { display: flex; gap: 8px; margin-bottom: 8px; }.departure-fields h3 { margin-top: 0; }.toggle { display: flex; align-items: center; }.toggle input { accent-color: var(--ocean); }.modal-footer { display: flex; justify-content: end; gap: 10px; padding: 16px 20px; border-top: 1px solid var(--line); flex: none; }button:disabled { opacity: .6; }button:focus-visible,input:focus-visible,select:focus-visible { outline: 2px solid var(--ocean); outline-offset: 2px; }
@media(max-width:600px) { .daily-schedules { padding: 16px; }.panel-heading { flex-wrap: wrap; }.inactive-divider { grid-column:1/-1; border-top:1px solid var(--line); padding-top:16px; margin-top:4px; }
.inactive-divider h3 { margin:0; font-size:13px; }
.inactive-divider p { margin:4px 0 0; color:var(--muted); }
.schedule-feedback { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px; padding:12px; border:1px solid var(--line); border-radius:10px; background:var(--surface-soft); }
.filters { display: grid; grid-template-columns: 1fr 1fr; }.filters label:last-child { grid-column: 1 / -1; }select,input:not([type="checkbox"]) { font-size: 16px; }.modal-footer button { flex: 1; } }

.filters { display: grid; grid-template-columns: minmax(150px,1fr) minmax(140px,.7fr) minmax(160px,.7fr); }
.schedule-cards { grid-template-columns: repeat(2,minmax(0,1fr)); }
article { display:flex; flex-direction:column; padding:16px; background:var(--surface-soft); }
article h3 { font-size:14px; margin:10px 0 6px; }
article h3 span { color:var(--muted); margin:0 4px; }
.departure-preview { margin:10px 0 0; font-size:12px; }
.departure-preview summary { color:var(--ocean); cursor:pointer; width:fit-content; padding:4px 0; }
.time-chips { display:flex; flex-wrap:wrap; gap:6px; padding-top:8px; }
.time-chips span { border:1px solid var(--line); border-radius:6px; padding:5px 8px; font-variant-numeric:tabular-nums; }
.prepare-controls { margin-top:auto; padding-top:12px; }
article footer { margin-top:12px; padding-top:10px; }
.availability-note { margin:8px 0 0; font-size:11px; }
article.unavailable { background:var(--surface); }
.schedule-modal { --width:min(700px,calc(100vw - 32px)); }
.form-scroll fieldset { grid-template-columns:repeat(2,minmax(0,1fr)); align-items:start; }
.editor-section { display:grid; gap:12px; padding:16px; border:1px solid var(--line); border-radius:12px; background:var(--surface-soft); min-width:0; }
.editor-section h3 { margin:0; font-size:14px; }
.departure-fields { grid-column:1/-1; }
.editor-hint { margin:0; color:var(--muted); }
.time-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px 12px; }
.time-row { margin:0; min-width:0; }
.departure-fields > button { justify-self:start; }
.toggle { min-height:42px; gap:8px; }
@media(max-width:740px) { .schedule-cards { grid-template-columns:1fr; } }
@media(max-width:600px) { .filters { grid-template-columns:1fr 1fr; } .form-scroll fieldset { grid-template-columns:1fr; } .schedule-dialog header,.form-scroll { padding:16px; } .time-grid { grid-template-columns:1fr; } }

.inactive-divider { grid-column:1/-1; padding:16px 0 0; margin-top:8px; border-top:1px solid var(--line); }
.inactive-divider h3 { margin:0; font-size:14px; }
.inactive-divider p { margin:4px 0 0; color:var(--muted); }
article.route-unavailable { padding:14px 16px; }
article.route-unavailable .prepare-controls { display:none; }
article.route-unavailable .availability-note { display:none; }
article.route-unavailable .departure-preview { margin-top:6px; }
.schedule-feedback { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:10px; padding:12px; border:1px solid var(--line); border-radius:10px; }
</style>
