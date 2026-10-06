<template>
  <section class="audit-panel" aria-label="Audit records">
    <form class="audit-filters" @submit.prevent="applyFilters"><div class="filter-heading"><div><p class="eyebrow">ACTIVITY SEARCH</p><h2>Filter audit history</h2></div><span>Dates use Philippine time</span></div>
      <label class="audit-search"
        >Search activity<div class="search-field"><IonIcon :icon="searchOutline" aria-hidden="true" /><input
          v-model.trim="search"
          type="search"
          maxlength="120"
          placeholder="Person, action, or record" /></div></label
      ><label
        >Action<select v-model="action" aria-label="Action">
          <option value="">All actions</option>
          <option v-for="value in actions" :key="value" :value="value">
            {{ auditAction(value) }}
          </option>
        </select></label
      ><label
        >Record type<select v-model="entityType" aria-label="Record type">
          <option value="">All records</option>
          <option v-for="type in entityTypes" :key="type" :value="type">{{ humanize(type) }}</option>
        </select></label
      ><label>From date<input v-model="fromDate" type="date" /></label
      ><label>To date<input v-model="toDate" type="date" /></label
      ><div class="filter-actions"><Button type="submit" :disabled="loading">Apply filters</Button><Button variant="outline" type="button" :disabled="loading" @click="reset">Reset</Button></div>
    </form>
    <div v-if="error" class="audit-error" role="alert"><IonIcon :icon="alertCircleOutline" aria-hidden="true" /><p>{{ error }}</p><Button variant="outline" :disabled="loading" @click="load">Retry loading</Button></div><div class="audit-directory">
    <div class="audit-summary">
      <div>
        <p class="eyebrow">ACCOUNTABILITY</p>
        <h2>System activity</h2><p class="directory-note">{{ records.length }} records on this page. Open an entry to review its changes.</p>
      </div>
      <Badge>{{ total.toLocaleString() }} matching records</Badge>
    </div>
    <p v-if="loading" role="status" class="audit-empty">Loading activity…</p>
    <RecordsGrid
      v-else-if="records.length"
      title="Audit records table"
      :columns="['When', 'Who', 'Action', 'Record', 'Details']"
      :display-only-columns="[4]"
      :rows="gridRows"
    >
      <template #cell="{ row, index }">
        <time v-if="index === 0" :datetime="row.source.createdAt">{{
          date(row.source.createdAt)
        }}</time>
        <span v-else-if="index === 1" class="actor"
          ><span class="actor-avatar" aria-hidden="true">{{
            row.source.actorName.slice(0, 1).toUpperCase()
          }}</span
          ><span class="actor-info"
            ><strong>{{ row.source.actorName }}</strong
            ><small
              class="actor-role"
              :title="isLegacyRole(row.source) ? legacyRoleNote : undefined"
              >{{ roleName(row.source.actorRole) }}</small
            ></span
          ></span
        >
        <Badge v-else-if="index === 2" :variant="actionVariant(row.source.action)">{{ auditAction(row.source.action) }}</Badge>
        <span v-else-if="index === 3" class="audit-record"
          ><strong>{{ humanize(row.source.entityType) }}</strong
          ><small>{{ row.source.entityId }}</small></span
        >
        <template v-else><Button v-if="Object.keys(row.source.details || {}).length" variant="outline" size="sm" @click="selectedRecord = row.source"><IonIcon :icon="documentTextOutline" aria-hidden="true" />View changes</Button><span v-else class="muted">No additional details</span></template>
      </template>
    </RecordsGrid>
    <div v-else-if="!error" class="audit-empty"><IonIcon :icon="listOutline" aria-hidden="true" />
      <h3>No matching activity</h3>
      <p>Try another person, action, or date range.</p>
    </div>
    <details v-if="hasLegacyRoles" class="legacy-role-help">
      <summary>About roles in older records</summary>
      <p>{{ legacyRoleNote }}</p>
    </details>
<WorkspacePagination :page="page" :total="total" :disabled="loading" @change="move($event - page)">Dates use Philippine time.</WorkspacePagination></div>
    <IonModal :is-open="!!selectedRecord" class="audit-details-modal" @didDismiss="selectedRecord = null"><section v-if="selectedRecord" class="audit-dialog"><header><div><p class="eyebrow">AUDIT ENTRY</p><h2>{{ auditAction(selectedRecord.action) }}</h2></div><Button variant="ghost" size="icon" aria-label="Close audit details" @click="selectedRecord = null"><IonIcon :icon="closeOutline" aria-hidden="true" /></Button></header><div class="audit-dialog-scroll"><dl class="entry-context"><div><dt>When</dt><dd>{{ date(selectedRecord.createdAt) }} (PH)</dd></div><div><dt>Who</dt><dd>{{ selectedRecord.actorName }}<small>{{ roleName(selectedRecord.actorRole) }}</small></dd></div><div><dt>Record</dt><dd>{{ humanize(selectedRecord.entityType) }}<small>{{ selectedRecord.entityId }}</small></dd></div></dl><p v-if="isLegacyRole(selectedRecord)" class="legacy-note">{{ legacyRoleNote }}</p><h3>Recorded changes</h3><AuditChanges :details="selectedRecord.details" /></div><footer><Button variant="outline" @click="selectedRecord = null">Close</Button></footer></section></IonModal>
  </section>
</template>
<script setup lang="ts">
import WorkspacePagination from "../shared/WorkspacePagination.vue";
import { computed, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { IonIcon, IonModal } from '@ionic/vue';
import { alertCircleOutline, closeOutline, documentTextOutline, listOutline, searchOutline } from 'ionicons/icons';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import RecordsGrid from "../shared/RecordsGrid.vue";
import AuditChanges from "./AuditChanges.vue";
import {
  auditLabel as humanize,
  auditAction,
} from "../../data/auditPresentation";
import { staffDatabase } from "../../services/session";
import {
  auditLog,
  type ActivityRecord,
  type AuditFilters,
} from "../../services/database/operations";
import { databaseRequestError } from "../../data/databaseErrors";
const selectedRecord = ref<ActivityRecord | null>(null);
const actionVariant = (value: string): 'default' | 'warning' | 'destructive' | 'success' => /DELETE|CANCEL/.test(value) ? 'destructive' : /EXPIRE|REFUND/.test(value) ? 'warning' : /CREATE|INSERT|SAVED|PAYMENT_RECEIVED/.test(value) ? 'success' : 'default';
const route = useRoute();
const entityType = ref(
  typeof route.query.entityType === "string" ? route.query.entityType : "",
);
const roleName = (role?: string) =>
  ({
    ADMIN: "Administrator",
    TICKETING: "Ticketing staff",
    BOARDING: "Boarding staff",
    PASSENGER: "Passenger",
    SYSTEM: "System",
    UNKNOWN: "Role unavailable",
  })[role || "UNKNOWN"] || "Role unavailable";
const search = ref(""),
  action = ref(""),
  fromDate = ref(""),
  toDate = ref("");
const records = ref<ActivityRecord[]>([]),
  actions = ref<string[]>([]),
  page = ref(0),
  total = ref(0),
  loading = ref(false),
  error = ref("");
const legacyRoleNote =
  "Older records did not save the role at the time of the action. The role shown is the account's present role.";
const isLegacyRole = (record: ActivityRecord) =>
  record.actorRoleRecorded === false &&
  !!record.actorRole &&
  !["SYSTEM", "UNKNOWN"].includes(record.actorRole);
const gridRows = computed(() =>
  records.value.map((record) => ({
    key: record.id,
    source: record,
    sortValues: [new Date(record.createdAt).getTime()],
    cells: [
      date(record.createdAt),
      record.actorName + " " + roleName(record.actorRole),
      auditAction(record.action),
      humanize(record.entityType) + " " + record.entityId,
      "",
    ],
  })),
);
const entityTypes = computed(() => [...new Set(['operation_settings', 'booking', 'sailing', 'booking_passenger', 'accommodation', 'travel_advisory', 'ferry_route', 'notification_campaign', ...records.value.map(record => record.entityType), ...(entityType.value ? [entityType.value] : [])])]);
const hasLegacyRoles = computed(() => records.value.some(isLegacyRole));
let applied: Omit<AuditFilters, "page"> = { entityType: entityType.value };

const date = (value: string) =>
  new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
async function load() {
  if (!staffDatabase || loading.value) return;
  loading.value = true;
  error.value = "";
  records.value = [];
  try {
    const result = await auditLog(staffDatabase, {
      ...applied,
      page: page.value,
    });
    records.value = result.data.records;
    total.value = result.data.totalCount;
    actions.value = result.data.actions;
  } catch (cause) {
    error.value = databaseRequestError(cause, "Could not load audit records.");
    total.value = 0;
  } finally {
    loading.value = false;
  }
}
function applyFilters() {
  if (loading.value) return;
  if (fromDate.value && toDate.value && fromDate.value > toDate.value) {
    error.value = "From date must be on or before To date.";
    return;
  }
  applied = {
    entityType: entityType.value,
    search: search.value,
    action: action.value,
    fromDate: fromDate.value,
    toDate: toDate.value,
  };
  page.value = 0;
  void load();
}
function reset() {
  entityType.value = "";
  search.value = "";
  action.value = "";
  fromDate.value = "";
  toDate.value = "";
  applyFilters();
}
function move(delta: number) {
  if (loading.value || page.value + delta < 0 || (page.value + delta) * 30 >= Math.max(total.value, 1)) return;
  page.value += delta;
  void load();
}
watch(
  () => route.query.entityType,
  (value) => {
    entityType.value = typeof value === "string" ? value : "";
    applyFilters();
  },
);
onMounted(load);
</script>
<style scoped>
.audit-panel { display:grid; gap:20px; min-width:0; }
.audit-filters,.audit-directory { border:1px solid var(--line); border-radius:16px; background:var(--surface); min-width:0; }
.audit-directory { overflow:hidden; }
.audit-filters { display:grid; grid-template-columns:minmax(200px,2fr) repeat(4,minmax(120px,1fr)); gap:16px; padding:22px; }
.filter-heading { grid-column:1/-1; display:flex; justify-content:space-between; align-items:center; gap:14px; padding-bottom:16px; border-bottom:1px solid var(--line); }
.filter-heading > span { font-size:11px; color:var(--muted); }
label { display:grid; align-content:start; gap:8px; font-size:12px; font-weight:600; min-width:0; color:var(--muted); }
input,select { width:100%; min-width:0; height:42px; padding:0 12px; border:1px solid var(--line); border-radius:9px; background:var(--surface-soft); color:var(--ink); font:inherit; font-size:12px; }
.search-field { position:relative; }
.search-field input { padding-left:36px; }
.search-field ion-icon { position:absolute; left:12px; top:13px; font-size:16px; pointer-events:none; color:var(--muted); }
.filter-actions { grid-column:1/-1; display:flex; gap:10px; justify-content:flex-end; }
.audit-summary { display:flex; justify-content:space-between; align-items:center; gap:16px; padding:22px; border-bottom:1px solid var(--line); }
.eyebrow { font-size:10px; letter-spacing:.1em; font-weight:800; color:var(--ocean); margin:0 0 7px; }
h2 { margin:0; font-size:19px; color:var(--ink); }
.directory-note { font-size:12px; line-height:1.6; color:var(--muted); margin:7px 0 0; }
.muted { font-size:11px; color:var(--muted); }
.actor { display:flex; align-items:center; gap:10px; }
.actor-info { display:grid; gap:4px; min-width:0; }
.actor-info strong { font-weight:600; color:var(--ink); }
.actor-role { margin:0; font-size:10px; color:var(--muted); }
.actor-avatar { display:grid; place-items:center; width:32px; height:32px; flex:none; border-radius:50%; background:var(--light-blue); color:var(--ocean); font-weight:700; }
.audit-record { display:grid; gap:5px; }
.audit-record small { color:var(--muted); font-size:10px; overflow-wrap:anywhere; }
time { font-size:11px; }
.audit-empty { text-align:center; padding:40px 20px; color:var(--muted); font-size:12px; }
.audit-empty > ion-icon { font-size:30px; color:var(--ocean); }
.audit-empty h3 { color:var(--ink); margin:12px 0 8px; }
.audit-error { display:flex; align-items:center; gap:12px; padding:16px 20px; color:#bd3b45; border:1px solid #bd3b4533; background:var(--surface); border-radius:12px; font-size:12px; }
.audit-error p { flex:1; margin:0; }
.audit-error ion-icon { font-size:22px; flex:none; }
.legacy-role-help { margin:14px 20px; padding:14px; border:1px solid var(--line); border-radius:10px; background:var(--surface-soft); }
.legacy-role-help summary { cursor:pointer; font-size:11px; color:var(--muted); }
.legacy-role-help p,.legacy-note { max-width:650px; font-size:12px; line-height:1.6; color:var(--muted); margin:10px 0 0; }
.audit-details-modal { --width:620px; --height:auto; --max-height:calc(100dvh - 32px); --border-radius:18px; --background:var(--surface); }
.audit-dialog { display:flex; flex-direction:column; max-height:calc(100dvh - 32px); overflow:hidden; background:var(--surface); color:var(--ink); }
.audit-dialog header { display:flex; align-items:center; justify-content:space-between; gap:16px; padding:22px; border-bottom:1px solid var(--line); flex:none; }
.audit-dialog-scroll { padding:22px; overflow-y:auto; min-height:0; flex:1; overscroll-behavior:contain; }
.entry-context { display:grid; grid-template-columns:1fr 1fr; gap:18px; padding:18px; margin:0 0 20px; border:1px solid var(--line); border-radius:12px; background:var(--surface-soft); }
.entry-context > div:last-child { grid-column:1/-1; }
.entry-context dt { color:var(--muted); font-size:11px; margin-bottom:6px; }
.entry-context dd { margin:0; font-size:12px; overflow-wrap:anywhere; }
.entry-context small { display:block; color:var(--muted); font-size:11px; margin-top:5px; }
.audit-dialog h3 { font-size:14px; margin:20px 0 0; }
.audit-dialog :deep(.readable-changes) { max-width:none; }
.audit-dialog footer { display:flex; justify-content:flex-end; padding:16px 22px; border-top:1px solid var(--line); flex:none; }
@media(max-width:1100px) { .audit-filters { grid-template-columns:repeat(3,minmax(0,1fr)); } .audit-search { grid-column:span 2; } }
@media(max-width:600px) { .audit-filters { padding:16px; grid-template-columns:repeat(2,minmax(0,1fr)); gap:14px; } .audit-search { grid-column:1/-1; } .filter-heading,.audit-summary { align-items:start; flex-direction:column; } .filter-actions > button { flex:1; } .audit-summary { padding:18px; } .audit-details-modal { --width:calc(100vw - 24px); } .audit-dialog header,.audit-dialog-scroll { padding:18px; } .entry-context { grid-template-columns:1fr; } .audit-error { flex-wrap:wrap; } }
</style>
