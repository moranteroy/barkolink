<template>
  <section class="no-shows-panel">
    <div class="no-show-picker-card">
    <div class="catalog-tools no-show-heading">
      <div class="no-show-intro"><span class="no-show-symbol"><IonIcon :icon="personRemoveOutline" aria-hidden="true" /></span><div><p class="eyebrow">ATTENDANCE REVIEW</p><h2>Review a completed sailing</h2>
      <p>
        Review paid passengers who did not board. Record no-shows only after the
        trip is completed.
      </p>
      </div></div>
      <button
        class="primary-button"
        :disabled="busy || loading || !eligibleCount || sailing?.status !== 'COMPLETED'"
        @click="mark()"
      >
        {{ busy ? 'Recording…' : 'Mark remaining as no-show' }}
      </button>
    </div>
    <label class="catalog-picker"
      >Completed trip<select v-model="code" :disabled="busy || loading" @change="load">
        <option value="">Select trip</option>
        <option v-for="s in sailings" :key="s.code" :value="s.code">
          {{ s.code }} · {{ s.origin.name }} → {{ s.destination.name }}
        </option>
      </select></label
    ><button
      v-if="sailings.length < sailingTotal"
      :disabled="loading"
      @click="more"
    >
      Load older trips
    </button>
    </div>
    <p v-if="error" role="alert" class="catalog-error">{{ error }}</p>
    <p v-if="notice" role="status" class="no-show-notice">{{ notice }}</p>
    <div v-if="code" class="catalog-tools no-show-search">
      <label class="no-show-search-label" for="no-show-search">Search passengers<div class="no-show-search-input"><IonIcon :icon="searchOutline" aria-hidden="true" /><input
        id="no-show-search"
        v-model.trim="search"
        class="catalog-search"
        type="search"
        placeholder="Search passenger or booking"
        aria-label="Search no-shows"
      /></div></label><Button variant="ghost" :disabled="!search" @click="search = ''">Reset search</Button><span
        >{{ visible.length }} passengers · {{ eligibleCount }} not yet
        marked</span
      >
    </div>
    <div v-if="code && !loading" class="no-show-counts" aria-label="Attendance totals"><div><span class="count-icon"><IonIcon :icon="peopleOutline" aria-hidden="true" /></span><div><span>Not boarded</span><strong>{{ rows.length }}</strong></div></div><div class="pending-count"><span class="count-icon"><IonIcon :icon="timeOutline" aria-hidden="true" /></span><div><span>Not yet recorded</span><strong>{{ eligibleCount }}</strong></div></div><div class="recorded-count"><span class="count-icon"><IonIcon :icon="checkmarkCircleOutline" aria-hidden="true" /></span><div><span>No-shows recorded</span><strong>{{ rows.filter(p => p.noShow).length }}</strong></div></div></div>
    <div v-if="loading" class="no-show-empty" role="status">Loading passenger attendance…</div>
    <div v-else-if="!visible.length && !error" class="no-show-empty" role="status"><span class="no-show-empty-symbol"><IonIcon :icon="code && !search ? checkmarkCircleOutline : personRemoveOutline" aria-hidden="true" /></span><strong>{{ search ? 'No matching passengers' : code ? 'No passengers to record' : 'Choose a completed trip' }}</strong><p>{{ search ? 'Try another passenger name or booking reference.' : code ? 'No non-boarded paid passengers were found for this completed sailing.' : 'Select a completed sailing to review attendance.' }}</p></div>
    <div v-else-if="visible.length" class="catalog-table">
      <div class="no-show-table-heading"><p class="eyebrow">PASSENGER ATTENDANCE</p><h2>Passengers who did not board</h2></div>
      <RecordsGrid title="Passenger no-show records" :columns="['Passenger', 'Booking', 'Accommodation', 'Ticket', 'Attendance']" :rows="gridRows" density="compact" :column-min-widths="[150, 145, 130, 105, 145]" :action-width="135" :max-grid-height="360">
        <template #cell="{ row, index, value }">
          <strong v-if="index === 0">{{ value }}</strong>
          <Badge v-else-if="index === 3" :variant="row.source.ticketStatus === 'CHECKED_IN' ? 'success' : row.source.ticketStatus === 'ISSUED' ? 'default' : 'warning'">{{ value }}</Badge>
          <Badge v-else-if="index === 4" :variant="row.source.noShow ? 'destructive' : 'warning'">{{ value }}</Badge>
          <span v-else>{{ value }}</span>
        </template>
        <template #actions="{ row }"><button v-if="!row.source.noShow" class="mark-no-show" :disabled="busy || loading || sailing?.status !== 'COMPLETED'" :aria-label="`Mark ${row.source.fullName} as no-show`" @click="mark(row.source.id)">Mark no-show</button><span v-else class="attendance-recorded"><IonIcon :icon="checkmarkCircleOutline" aria-hidden="true" />Recorded</span></template>
      </RecordsGrid>
    </div>
  </section>
</template>
<script setup lang="ts">
import { confirmAction } from "../../composables/confirmation";
import { IonIcon } from "@ionic/vue";
import { personRemoveOutline, searchOutline, checkmarkCircleOutline, peopleOutline, timeOutline } from "ionicons/icons";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import RecordsGrid from "../shared/RecordsGrid.vue";
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import { staffDatabase } from "../../services/session";
import {
  staffTrips,
  noShows,
  markNoShow,
  type WorkspaceTrip,
  type WorkspacePassenger,
} from "../../services/database/workspaces";
import { databaseRequestError } from "../../data/databaseErrors";
import { auditLabel as humanize } from "../../data/auditPresentation";
const route = useRoute(),
  code = ref(String(route.query.sailing || "")),
  search = ref(""),
  sailings = ref<WorkspaceTrip[]>([]),
  sailing = ref<WorkspaceTrip | null>(null),
  rows = ref<WorkspacePassenger[]>([]),
  busy = ref(false),
  loading = ref(false),
  error = ref(""),
  notice = ref(""),
  sailingTotal = ref(0),
  sailingPage = ref(0);
const eligibleCount = computed(
  () =>
    rows.value.filter(
      (p) => !p.noShow && ["ISSUED", "CHECKED_IN"].includes(p.ticketStatus),
    ).length,
);
const visible = computed(() =>
  rows.value.filter(
    (p) =>
      !search.value ||
      `${p.fullName} ${p.booking.reference}`
        .toLowerCase()
        .includes(search.value.toLowerCase()),
  ),
);
const gridRows = computed(() => visible.value.map(passenger => ({
  key: passenger.id,
  cells: [passenger.fullName, passenger.booking.reference, passenger.booking.accommodationName || 'Standard', humanize(passenger.ticketStatus), passenger.noShow ? 'No-show recorded' : 'Did not board'],
  source: passenger,
  statusIndex: 3,
})));
async function load() {
  if (!staffDatabase) return;
  if (!code.value) { rows.value = []; sailing.value = null; search.value = ''; notice.value = ''; return; }
  loading.value = true;
  error.value = "";
  try {
    const r = await noShows(staffDatabase, code.value);
    rows.value = r.data.passengers;
    sailing.value = r.data.sailing;
  } catch (e) {
    error.value = databaseRequestError(e, "Could not load no-shows.");
  } finally {
    loading.value = false;
  }
}
async function more() {
  if (!staffDatabase) return;
  loading.value = true;
  try {
    const r = await staffTrips(staffDatabase, {
      status: "COMPLETED",
      page: sailingPage.value + 1,
    });
    sailings.value.push(...r.data.sailings);
    sailingPage.value++;
    sailingTotal.value = r.data.totalCount;
  } catch (e) {
    error.value = databaseRequestError(e, "Could not load trips.");
  } finally {
    loading.value = false;
  }
}
async function mark(id?: string) {
  if (!staffDatabase || busy.value || loading.value || sailing.value?.status !== 'COMPLETED') return;
  if (
    !(await confirmAction({
      title: "Record no-show attendance?",
      message: `Record ${id ? "this passenger" : `${eligibleCount.value} remaining passengers`} as no-show for ${code.value}? Fares and booking history will be preserved.`,
      confirmText: "Record no-shows",
    }))
  )
    return;
  busy.value = true;
  error.value = "";
  try {
    const r = await markNoShow(staffDatabase, code.value, id);
    await load();
    notice.value = `${r.data.marked} no-show records added.`;
  } catch (e) {
    error.value = databaseRequestError(e, "Could not record attendance.");
  } finally {
    busy.value = false;
  }
}
onMounted(async () => {
  if (!staffDatabase) return;
  try {
    const r = await staffTrips(staffDatabase, { status: "COMPLETED" });
    sailings.value = r.data.sailings;
    sailingTotal.value = r.data.totalCount;
    if (!code.value) code.value = sailings.value[0]?.code || "";
    if (code.value) await load();
  } catch (e) {
    error.value = databaseRequestError(e, "Could not load completed trips.");
  }
});
</script>

<style scoped>
.no-shows-panel { display: grid; gap: 16px; min-width: 0; font-family: var(--ion-font-family); color: var(--ink); }
.no-show-picker-card { padding: 14px 16px; border: 1px solid var(--line); border-radius: 14px; background: var(--surface); }
.no-show-intro { display: flex; align-items: flex-start; gap: 12px; min-width: 0; }
.no-show-symbol, .no-show-empty-symbol { display: grid; place-items: center; flex: none; border-radius: 10px; background: var(--light-blue); color: var(--ocean); }
.no-show-symbol { width: 36px; height: 36px; font-size: 22px; }
.no-show-empty-symbol { width: 40px; height: 40px; font-size: 24px; margin: 0 auto 12px; }
.no-shows-panel h2 { font-size: 17px; margin: 0; color: var(--ink); line-height: 1.4; }
.eyebrow { font-size: 10px; color: var(--ocean); font-weight: 800; letter-spacing: .1em; margin: 0 0 5px; }
.no-show-heading { display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-bottom: 14px; }
.no-show-intro > div > p:last-child { margin: 6px 0 0; color: var(--muted); font-size: 12px; line-height: 1.5; }
.no-show-heading > button { flex: none; background: var(--light-blue); color: var(--ocean); font-weight: 600; }
.no-show-picker-card > button { margin-top: 10px; }
.catalog-picker, .no-show-search-label { display: grid; gap: 7px; min-width: 0; font-size: 12px; font-weight: 600; color: var(--muted); }
.no-shows-panel select, .no-shows-panel input { box-sizing: border-box; width: 100%; min-width: 0; min-height: 40px; padding: 8px 12px; border: 1px solid var(--line); border-radius: 9px; background: var(--surface-soft); color: var(--ink); font: inherit; font-size: 12px; }
.no-shows-panel button { min-height: 40px; padding: 8px 12px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface); color: var(--ocean); font-family: inherit; font-size: 12px; cursor: pointer; }
.no-shows-panel button:disabled, .no-shows-panel select:disabled { opacity: .6; cursor: default; }
.no-shows-panel button:focus-visible, .no-shows-panel select:focus-visible { outline: 2px solid var(--ocean); outline-offset: 2px; }
.no-show-search { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: end; gap: 8px 12px; padding: 12px 16px; border: 1px solid var(--line); border-radius: 14px; background: var(--surface); }
.no-show-search > span { grid-column: 1 / -1; color: var(--muted); font-size: 11px; line-height: 1.5; }
.no-show-search-input { display: flex; align-items: center; gap: 8px; padding-left: 12px; border: 1px solid var(--line); border-radius: 9px; background: var(--surface-soft); }
.no-show-search-input ion-icon { font-size: 17px; flex: none; color: var(--muted); }
.no-shows-panel .no-show-search-input input { border: 0; background: transparent; outline: none; }
.no-show-search-input:focus-within { outline: 2px solid var(--ocean); outline-offset: 2px; }
.no-show-counts { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); border: 1px solid var(--line); border-radius: 12px; background: var(--surface); overflow: hidden; }
.no-show-counts > div { display: flex; align-items: center; gap: 10px; padding: 12px 16px; min-width: 0; }
.no-show-counts > div + div { border-left: 1px solid var(--line); }
.no-show-counts > div > div { display: grid; gap: 3px; min-width: 0; }
.no-show-counts span { color: var(--muted); font-size: 11px; line-height: 1.5; }
.no-show-counts strong { font-size: 21px; line-height: 1.2; font-variant-numeric: tabular-nums; }
.no-show-counts .count-icon { display: grid; place-items: center; width: 30px; height: 30px; flex: none; border-radius: 8px; background: var(--light-blue); color: var(--ocean); font-size: 18px; }
.pending-count .count-icon { color: var(--muted); }
.no-show-empty { padding: 22px 16px; text-align: center; border: 1px dashed var(--line); border-radius: 12px; background: var(--surface-soft); }
.no-show-empty strong { font-size: 14px; }
.no-show-empty p { margin: 6px 0 0; font-size: 12px; color: var(--muted); line-height: 1.5; }
.catalog-table { border: 1px solid var(--line); border-radius: 14px; background: var(--surface); overflow: hidden; min-width: 0; }
.no-show-table-heading { padding: 14px 16px; border-bottom: 1px solid var(--line); }
.catalog-table :deep(.grid-tools) { padding: 8px 16px; border-bottom: 1px solid var(--line); }
.catalog-table :deep(.grid-tools button) { min-height: 34px; padding: 6px 8px; }
.catalog-table :deep(.desktop-grid) { padding: 8px; }
.catalog-table :deep(.grid-cell-content) { padding: 7px 0; font-size: 12px; line-height: 1.5; }
.catalog-table :deep(.grid-row-actions) { display: flex; align-items: center; min-height: 44px; padding: 7px 0; }
.no-shows-panel .mark-no-show { min-height: 32px; padding: 5px 9px; font-size: 11px; background: var(--light-blue); }
.attendance-recorded { display: inline-flex; align-items: center; gap: 6px; color: var(--muted); font-size: 12px; white-space: nowrap; }
.attendance-recorded ion-icon { color: var(--ocean); font-size: 16px; }
.no-show-notice { padding: 10px 16px; margin: 0; border: 1px solid var(--line); border-radius: 10px; background: var(--light-blue); color: var(--ocean); font-size: 12px; }
@media (max-width: 700px) {
  .no-show-heading { flex-direction: column; align-items: stretch; gap: 12px; }
  .no-show-counts > div { flex-direction: column; align-items: flex-start; gap: 6px; padding: 10px; }
  .catalog-table :deep(.grid-tools) { flex-wrap: wrap; }
  .no-shows-panel select, .no-shows-panel input { min-height: 44px; font-size: 16px; }
  .no-shows-panel button, .no-shows-panel .mark-no-show { min-height: 44px; }
}
</style>
