<template>
  <section class="audit-panel" aria-label="Audit records">
    <form class="audit-filters" @submit.prevent="applyFilters">
      <label class="audit-search"
        >Search activity<input
          v-model.trim="search"
          type="search"
          maxlength="120"
          placeholder="Person, action, or record" /></label
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
          <option value="operation_settings">Reservation settings</option>
        </select></label
      ><label>From date<input v-model="fromDate" type="date" /></label
      ><label>To date<input v-model="toDate" type="date" /></label
      ><button class="primary-button" :disabled="loading">Apply filters</button
      ><button type="button" :disabled="loading" @click="reset">Reset</button>
    </form>
    <p v-if="error" class="audit-error" role="alert">{{ error }}</p>
    <div class="audit-summary">
      <div>
        <p class="eyebrow">ACCOUNTABILITY</p>
        <h2>System activity</h2>
      </div>
      <span>{{ total.toLocaleString() }} matching records</span>
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
        <span v-else-if="index === 2" class="audit-action">{{
          auditAction(row.source.action)
        }}</span>
        <span v-else-if="index === 3" class="audit-record"
          ><strong>{{ humanize(row.source.entityType) }}</strong
          ><small>{{ row.source.entityId }}</small></span
        >
        <template v-else
          ><details v-if="Object.keys(row.source.details || {}).length">
            <summary>View changes</summary>
            <AuditChanges :details="row.source.details" />
          </details>
          <span v-else class="muted">No additional details</span></template
        >
      </template>
    </RecordsGrid>
    <div v-else class="audit-empty">
      <h3>No matching activity</h3>
      <p>Try another person, action, or date range.</p>
    </div>
    <details v-if="hasLegacyRoles" class="legacy-role-help">
      <summary>About roles in older records</summary>
      <p>{{ legacyRoleNote }}</p>
    </details>
    <footer class="audit-pagination">
      <span>Dates use Philippine time.</span>
      <div>
        <button :disabled="page === 0 || loading" @click="move(-1)">
          Previous</button
        ><span
          >Page {{ page + 1 }} of {{ Math.max(1, Math.ceil(total / 30)) }}</span
        ><button
          :disabled="(page + 1) * 30 >= total || loading"
          @click="move(1)"
        >
          Next
        </button>
      </div>
    </footer>
  </section>
</template>
<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
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
.audit-panel {
  min-width: 0;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 16px;
  overflow: hidden;
}
.audit-filters {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  gap: 12px;
  padding: 20px;
  border-bottom: 1px solid var(--line);
  background: var(--surface-soft);
}
label {
  display: grid;
  gap: 8px;
  font-size: 11px;
  font-weight: 650;
  flex: 1;
  min-width: 140px;
}
.audit-search {
  flex: 2;
  min-width: 200px;
}
input,
select {
  width: 100%;
  min-width: 0;
  height: 42px;
  padding: 0 12px;
  border: 1px solid var(--line);
  border-radius: 9px;
  background: var(--surface);
  color: var(--ink);
  font-size: 12px;
}
button {
  min-height: 42px;
  padding: 0 14px;
  border: 1px solid var(--line);
  border-radius: 9px;
  background: var(--surface);
  color: var(--ink);
  font-size: 12px;
  font-weight: 650;
  cursor: pointer;
}
button:disabled {
  opacity: 0.5;
  cursor: default;
}
.audit-summary {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 22px;
}
.eyebrow {
  font-size: 9px;
  letter-spacing: 0.12em;
  font-weight: 750;
  color: var(--ocean);
  margin: 0 0 8px;
}
h2 {
  margin: 0;
  font-size: 19px;
}
.audit-summary > span,
.muted {
  font-size: 11px;
  color: var(--muted);
}
.audit-table {
  overflow: auto;
}
table {
  border-collapse: collapse;
  width: 100%;
  text-align: left;
}
th {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
  background: var(--surface-soft);
}
th,
td {
  padding: 16px 20px;
  border-bottom: 1px solid var(--line);
}
td {
  font-size: 12px;
  vertical-align: top;
}
td small {
  display: block;
  max-width: 220px;
  overflow-wrap: anywhere;
  margin-top: 5px;
  color: var(--muted);
  font-size: 10px;
}
.audit-record small {
  display: block;
  margin-top: 5px;
  color: var(--muted);
  font-size: 10px;
  overflow-wrap: anywhere;
}
.actor {
  display: flex;
  align-items: center;
  gap: 9px;
}
.actor-info {
  display: grid;
  gap: 4px;
  min-width: 0;
}
.actor-info strong {
  font-weight: 600;
}
.actor-info .actor-role {
  margin: 0;
  font-size: 10px;
  color: var(--muted);
  max-width: none;
}
.actor-avatar {
  display: grid;
  place-items: center;
  flex: none;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--light-blue);
  color: var(--ocean);
  font-weight: 700;
}
.audit-action {
  display: inline-block;
  padding: 6px 9px;
  border: 1px solid var(--line);
  border-radius: 7px;
  font-size: 10px;
  white-space: nowrap;
}
summary {
  cursor: pointer;
  color: var(--ocean);
  font-size: 11px;
}
dl {
  max-width: 280px;
  font-size: 11px;
  line-height: 1.6;
}
dl div {
  margin-bottom: 8px;
}
dt {
  color: var(--muted);
}
dd {
  margin: 0;
  overflow-wrap: anywhere;
}
.audit-empty {
  text-align: center;
  padding: 40px 20px;
  color: var(--muted);
  font-size: 12px;
}
.audit-empty h3 {
  color: var(--ink);
}
.audit-error {
  padding: 12px 20px;
  color: #bd3b45;
}
.legacy-role-help {
  padding: 14px 20px;
  border-bottom: 1px solid var(--line);
  background: var(--surface-soft);
}
.legacy-role-help summary {
  font-size: 11px;
  color: var(--muted);
}
.legacy-role-help p {
  max-width: 650px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--muted);
  margin: 10px 0 0;
}
.audit-pagination {
  padding: 18px 20px;
  display: flex;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  align-items: center;
  font-size: 11px;
  color: var(--muted);
}
.audit-pagination > div {
  display: flex;
  align-items: center;
  gap: 12px;
}
@media (max-width: 600px) {
  .audit-filters {
    padding: 16px;
    gap: 10px;
  }
  .audit-search {
    min-width: 100%;
    flex: 1;
  }
  label {
    min-width: calc(50% - 10px);
  }
  .audit-summary {
    padding: 18px;
    align-items: start;
    flex-direction: column;
  }
  .audit-table table,
  .audit-table tbody,
  .audit-table tr,
  .audit-table td {
    display: block;
  }
  .audit-table thead {
    display: none;
  }
  .audit-table tr {
    padding: 16px;
    border-bottom: 1px solid var(--line);
  }
  .audit-table td {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    border: 0;
    padding: 8px 0;
    text-align: right;
    overflow-wrap: anywhere;
  }
  .audit-table td:before {
    content: attr(data-label);
    color: var(--muted);
    text-align: left;
    min-width: 48px;
    font-size: 10px;
  }
  .audit-action {
    white-space: normal;
  }
  .audit-table td small {
    max-width: 190px;
  }
  .audit-pagination > div {
    width: 100%;
    justify-content: space-between;
  }
  .audit-pagination {
    padding: 16px;
  }
  .audit-table dl {
    text-align: left;
  }
}
</style>
