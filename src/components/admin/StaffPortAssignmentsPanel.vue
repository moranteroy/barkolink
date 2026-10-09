<template>
  <section class="staff-port-assignments">
    <div class="access-note"><span class="access-symbol"><IonIcon :icon="idCardOutline" aria-hidden="true" /></span><div><strong>One staff account. One departure port.</strong><p>Choose a port, then save to activate terminal access.</p></div><span class="passenger-access"><IonIcon :icon="globeOutline" aria-hidden="true" /> Passengers: all ports</span></div>
    <p v-if="error" class="assignment-error" role="alert">{{ error }}</p>
    <p v-if="notice" class="assignment-notice" role="status">{{ notice }}</p>
    <div class="assignment-directory">
      <div class="directory-heading"><div class="directory-title"><IonIcon :icon="idCardOutline" aria-hidden="true" /><h2>Staff assignments</h2></div><span class="staff-count">{{ total }} {{ total === 1 ? 'staff account' : 'staff accounts' }}</span></div>
      <form class="assignment-filters" @submit.prevent="page = 0; load()">
        <label for="assignment-search">Search staff<div class="search-control"><IonIcon :icon="searchOutline" aria-hidden="true" /><input id="assignment-search" v-model.trim="search" type="search" placeholder="Name or email address" /></div></label>
        <label>Staff role<select v-model="role" aria-label="Staff role" :disabled="loading || !!busy" @change="page = 0; load()"><option value="ALL">All staff</option><option value="TICKETING">Ticketing staff</option><option value="BOARDING">Boarding staff</option></select></label>
        <Button type="submit" variant="outline" :disabled="loading || !!busy">Search</Button>
      </form>
      <RecordsGrid title="Staff port assignments" :columns="['Staff member', 'Role', 'Assigned port']" :rows="gridRows" :loading="loading" :column-min-widths="[230, 140, 230]" :column-flex="[1.2, .7, 1.2]" :action-width="110" :max-grid-height="420" density="compact">
        <template #cell="{ row, index, value }">
          <div v-if="index === 0" class="staff-identity"><span class="staff-avatar" aria-hidden="true">{{ initials(row.source.fullName) }}</span><div><strong>{{ row.source.fullName }}</strong><small>{{ row.source.email }}</small></div></div>
          <Badge v-else-if="index === 1" variant="default" class="staff-role" :class="row.source.role.toLowerCase()"><IonIcon :icon="row.source.role === 'TICKETING' ? ticketOutline : boatOutline" aria-hidden="true" />{{ value }}</Badge>
          <div v-else class="port-field"><div class="port-control"><IonIcon :icon="navigateOutline" aria-hidden="true" /><select v-model="drafts[row.key]" :disabled="loading || !!busy" :aria-label="`Assigned port for ${row.source.fullName}`"><option value="" disabled>Select a port</option><option v-if="row.source.assignedPort && !row.source.assignedPort.isActive" :value="row.source.assignedPort.id" disabled>{{ row.source.assignedPort.name }} (inactive)</option><option v-for="port in ports.filter(p => p.isActive)" :key="port.id" :value="port.id">{{ port.name }}</option></select></div><small class="assignment-state" :class="assignmentState(row.source).tone"><i aria-hidden="true" />{{ assignmentState(row.source).label }}</small></div>
        </template>
        <template #actions="{ row }"><Button size="sm" class="save-assignment" :disabled="loading || !!busy || !drafts[row.key] || drafts[row.key] === row.source.assignedPortId" @click="save(row.source)"><IonIcon :icon="saveOutline" aria-hidden="true" />{{ busy === row.key ? 'Saving…' : 'Save' }}</Button></template>
      </RecordsGrid>
    </div>
    <WorkspacePagination v-if="total > pageSize" :page="page" :page-size="pageSize" :total="total" :disabled="loading || !!busy" @change="page = $event; load()" />
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { IonIcon } from '@ionic/vue';
import { idCardOutline, globeOutline, searchOutline, navigateOutline, ticketOutline, boatOutline, saveOutline } from 'ionicons/icons';
import RecordsGrid from '../shared/RecordsGrid.vue';
import WorkspacePagination from '../shared/WorkspacePagination.vue';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { staffDatabase } from '../../services/session';
import { executeDatabase } from '../../services/database/client';
import { databaseRequestError } from '../../data/databaseErrors';
type Port = { id: string; name: string; isActive: boolean };
type Staff = { uid: string; fullName: string; email: string; role: string; assignedPortId: string | null; assignedPort: Port | null };
type Directory = { staff: Staff[]; ports: Port[]; totalCount: number };
const staff = ref<Staff[]>([]), ports = ref<Port[]>([]), total = ref(0), page = ref(0);
const search = ref(''), role = ref('ALL'), error = ref(''), notice = ref(''), busy = ref(''), loading = ref(false);
const drafts = reactive<Record<string, string>>({});
const pageSize = 30;
const initials = (name: string) => name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
function assignmentState(user: Staff) {
  user = staff.value.find(current => current.uid === user.uid) || user;
  if (drafts[user.uid] && drafts[user.uid] !== user.assignedPortId) return { label: 'Unsaved change', tone: 'pending' };
  if (!user.assignedPortId) return { label: 'Unassigned', tone: 'unassigned' };
  if (!user.assignedPort?.isActive) return { label: 'Port inactive', tone: 'unassigned' };
  return { label: 'Assigned', tone: 'assigned' };
}
const gridRows = computed(() => staff.value.map(user => ({ key: user.uid, source: user, cells: [user.fullName, user.role === 'TICKETING' ? 'Ticketing staff' : 'Boarding staff', user.assignedPort?.name || 'Unassigned'] })));
async function load() {
  if (!staffDatabase || loading.value || busy.value) return;
  loading.value = true; error.value = '';
  try {
    const result = await executeDatabase<Directory>(staffDatabase, 'AdminStaffPortAssignments', { search: search.value, role: role.value, page: page.value, pageSize });
    staff.value = result.data.staff; ports.value = result.data.ports; total.value = result.data.totalCount;
    for (const user of staff.value) drafts[user.uid] = user.assignedPortId || '';
  } catch (cause) { error.value = databaseRequestError(cause, 'Could not load staff port assignments.'); }
  finally { loading.value = false; }
}
async function save(user: Staff) {
  if (!staffDatabase || busy.value || loading.value || !drafts[user.uid]) return;
  busy.value = user.uid; error.value = ''; notice.value = '';
  try {
    const portId = drafts[user.uid];
    await executeDatabase(staffDatabase, 'AdminAssignStaffPort', { uid: user.uid, portId });
    user = staff.value.find(current => current.uid === user.uid) || user;
    user.assignedPortId = portId; user.assignedPort = ports.value.find(p => p.id === portId) || null;
    notice.value = `${user.fullName} is assigned to ${user.assignedPort?.name}.`;
  } catch (cause) { error.value = databaseRequestError(cause, 'Could not save the staff port assignment.'); }
  finally { busy.value = ''; }
}
onMounted(load);
</script>

<style scoped>
.staff-port-assignments { display: grid; gap: 16px; }
.access-note { display: flex; align-items: center; gap: 12px; padding: 14px 16px; border: 1px solid var(--line); border-radius: 12px; background: var(--surface); color: var(--ink); }
.access-symbol { display: grid; place-items: center; width: 38px; height: 38px; flex: none; border-radius: 10px; background: var(--light-blue); color: var(--ocean); font-size: 22px; }
.access-note strong { font-size: 13px; font-weight: 650; }.access-note p { margin: 4px 0 0; color: var(--muted); font-size: 12px; line-height: 1.5; }
.passenger-access { display: inline-flex; align-items: center; gap: 6px; flex: none; margin-left: auto; padding: 7px 10px; border-radius: 8px; background: var(--surface-soft); color: var(--muted); font-size: 11px; }
.passenger-access ion-icon { color: var(--ocean); font-size: 16px; }
.assignment-directory { border: 1px solid var(--line); border-radius: 14px; background: var(--surface); overflow: hidden; }
.directory-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 16px; border-bottom: 1px solid var(--line); }
.directory-title { display: flex; align-items: center; gap: 9px; }.directory-title ion-icon { color: var(--ocean); font-size: 21px; } h2 { margin: 0; font-size: 16px; }
.staff-count { border: 1px solid var(--line); padding: 5px 9px; border-radius: 20px; color: var(--muted); font-size: 11px; white-space: nowrap; }
.assignment-filters { display: grid; grid-template-columns: minmax(0, 1fr) 180px auto; gap: 12px; align-items: end; padding: 14px 16px; border-bottom: 1px solid var(--line); background: var(--surface-soft); }
.assignment-filters label { display: grid; gap: 7px; color: var(--muted); font-size: 11px; font-weight: 600; }
input, select { box-sizing: border-box; width: 100%; min-width: 0; min-height: 38px; padding: 8px 10px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface); color: var(--ink); font: inherit; font-size: 12px; }
.search-control, .port-control { position: relative; min-width: 0; }.search-control > ion-icon, .port-control > ion-icon { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); pointer-events: none; color: var(--muted); font-size: 16px; }.search-control input, .port-control select { padding-left: 34px; }
.assignment-filters > button { min-height: 38px; }
:deep(.staff-identity) { display: flex; align-items: center; gap: 10px; min-width: 0; padding-block: 7px; }:deep(.staff-identity > div) { display: grid; gap: 4px; min-width: 0; }:deep(.staff-identity strong) { font-weight: 650; font-size: 12px; overflow-wrap: anywhere; }
:deep(.staff-avatar) { display: grid; place-items: center; flex: none; width: 34px; height: 34px; border-radius: 10px; color: var(--ocean); background: var(--light-blue); font-size: 11px; font-weight: 700; }
:deep(.staff-role) { display: inline-flex; align-items: center; gap: 5px; font-size: 10px; padding: 5px 8px; white-space: nowrap; }:deep(.staff-role ion-icon) { font-size: 13px; }:deep(.staff-role.boarding) { background: var(--surface-soft); color: var(--ink); border: 1px solid var(--line); }
:deep(.port-field) { display: grid; gap: 5px; padding-block: 6px; min-width: 0; }:deep(.port-control) { position: relative; min-width: 0; }:deep(.port-control > ion-icon) { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); pointer-events: none; color: var(--ocean); font-size: 16px; }:deep(.port-control select) { box-sizing: border-box; width: 100%; min-width: 0; min-height: 38px; padding: 8px 28px 8px 34px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface); color: var(--ink); font: inherit; font-size: 12px; }
small { color: var(--muted); font-size: 10px; line-height: 1.5; overflow-wrap: anywhere; }
.assignment-directory :deep(.port-field .port-control select) { padding-left: 34px; }
:deep(.staff-identity small), :deep(.assignment-state) { color: var(--muted); font-size: 10px; line-height: 1.5; overflow-wrap: anywhere; }
:deep(.assignment-state) { display: inline-flex; align-items: center; gap: 5px; }:deep(.assignment-state i) { width: 5px; height: 5px; border-radius: 50%; background: currentColor; }:deep(.assignment-state.unassigned) { color: var(--muted); }:deep(.assignment-state.pending) { color: var(--ocean); }:deep(.assignment-state.assigned) { color: var(--success, #45a38a); }
:deep(.save-assignment) { gap: 5px; min-height: 34px; padding-inline: 10px; font-size: 11px; }:deep(.save-assignment ion-icon) { font-size: 14px; }
.assignment-error { color: var(--danger); }.assignment-notice { margin: 0; color: var(--ink); background: var(--light-blue); padding: 12px 16px; border-radius: 8px; font-size: 12px; }
:deep(.grid-tools) { padding: 8px 16px; gap: 10px; border-bottom: 1px solid var(--line); }:deep(.grid-tools button) { min-height: 32px; font-size: 11px; padding: 6px 9px; }:deep(.grid-summary > span) { font-size: 10px; }:deep(.desktop-grid) { padding: 8px; }:deep(.grid-cell-content) { font-size: 12px; }
@media(max-width:700px) { .access-note { flex-wrap: wrap; }.passenger-access { margin-left: 50px; }.assignment-filters { grid-template-columns: minmax(0, 1fr) 150px; }.assignment-filters > button { grid-column: 1 / -1; justify-self: end; } }
@media(max-width:600px) { .assignment-filters { grid-template-columns: 1fr; gap: 12px; }.assignment-filters > button { width: 100%; }.directory-heading { padding: 14px 12px; } h2 { font-size: 14px; }.access-note { padding: 12px; }.access-note > div { flex: 1; min-width: 0; } input, select, :deep(.port-control select) { min-height: 44px; font-size: 16px; }:deep(.save-assignment) { min-height: 40px; }:deep(.mobile-field > div) { min-width: 0; }:deep(.mobile-field .port-field) { width: 100%; }:deep(.grid-summary > span) { display: none; } }
</style>

<style scoped>
@media(max-width:600px) {
  .access-note { display: grid; grid-template-columns: 38px minmax(0, 1fr); align-items: start; gap: 10px; }
  .access-note > div { grid-column: 2; }
  .passenger-access { grid-column: 2; margin-left: 0; justify-self: start; }
  :deep(.mobile-field:has(.port-field)) { display: grid; gap: 6px; }
  :deep(.mobile-field:has(.port-field) > div) { width: 100%; text-align: left; }
}
</style>
