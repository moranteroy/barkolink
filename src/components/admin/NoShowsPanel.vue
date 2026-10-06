<template>
  <section class="catalog-panel no-shows-panel">
    <div class="catalog-tools">
      <p>
        Review paid passengers who did not board. Record no-shows only after the
        trip is completed.
      </p>
      <button
        class="primary-button"
        :disabled="busy || !eligibleCount || sailing?.status !== 'COMPLETED'"
        @click="mark()"
      >
        Mark remaining as no-show
      </button>
    </div>
    <label class="catalog-picker"
      >Completed trip<select v-model="code" @change="load">
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
    <p v-if="error" role="alert" class="catalog-error">{{ error }}</p>
    <p v-if="notice" role="status">{{ notice }}</p>
    <div class="catalog-tools no-show-search">
      <input
        v-model.trim="search"
        class="catalog-search"
        type="search"
        placeholder="Search passenger or booking"
        aria-label="Search no-shows"
      /><span
        >{{ visible.length }} passengers · {{ eligibleCount }} not yet
        marked</span
      >
    </div>
    <div class="no-show-counts"><div><span>Passengers not boarded</span><strong>{{ rows.length }}</strong></div><div><span>Not yet recorded</span><strong>{{ eligibleCount }}</strong></div><div><span>No-shows recorded</span><strong>{{ rows.filter(p => p.noShow).length }}</strong></div></div>
    <div v-if="!visible.length" class="no-show-empty" role="status"><strong>{{ loading ? 'Loading passengers...' : search ? 'No matching passengers' : code ? 'No passengers to record' : 'Choose a completed trip' }}</strong><p>{{ search ? 'Try another passenger name or booking reference.' : code ? 'No non-boarded paid passengers were found for this completed sailing.' : 'Select a completed sailing to review attendance.' }}</p></div>
    <div v-else class="catalog-table">
      <table>
        <thead>
          <tr>
            <th>Passenger</th>
            <th>Booking</th>
            <th>Accommodation</th>
            <th>Ticket</th>
            <th>Attendance</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in visible" :key="p.id">
            <td data-label="Passenger">{{ p.fullName }}</td>
            <td data-label="Booking">{{ p.booking.reference }}</td>
            <td data-label="Accommodation">
              {{ p.booking.accommodationName || "Standard" }}
            </td>
            <td data-label="Ticket">{{ humanize(p.ticketStatus) }}</td>
            <td data-label="Attendance">
              <span class="status">{{
                p.noShow ? "No-show recorded" : "Did not board"
              }}</span>
            </td>
            <td data-label="Action">
              <button
                v-if="!p.noShow"
                :disabled="busy || sailing?.status !== 'COMPLETED'"
                @click="mark(p.id)"
              >
                Mark no-show</button
              ><span v-else>Recorded</span>
            </td>
          </tr>
          <tr v-if="!visible.length">
            <td colspan="6">
              {{
                loading
                  ? "Loading passengers…"
                  : code
                    ? "No matching non-boarded passengers."
                    : "Choose a completed trip."
              }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
<script setup lang="ts">
import { confirmAction } from "../../composables/confirmation";
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
async function load() {
  if (!staffDatabase) return;
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
  if (!staffDatabase || busy.value) return;
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
.no-shows-panel { display: grid; gap: 16px; padding: 18px; border: 1px solid var(--line); border-radius: 12px; background: var(--surface); }
.no-shows-panel .catalog-tools { display: flex; justify-content: space-between; align-items: center; gap: 14px; margin: 0; }
.no-shows-panel .catalog-tools p { margin: 0; max-width: 620px; color: var(--muted); font-size: 12px; line-height: 1.7; }
.no-shows-panel button { min-height: 42px; padding: 9px 12px; border: 1px solid var(--line); border-radius: 8px; font-size: 12px; }
.no-shows-panel .catalog-picker { display: grid; gap: 7px; font-size: 12px; font-weight: 500; }
.no-shows-panel select, .no-shows-panel input { box-sizing: border-box; width: 100%; min-width: 0; height: 44px; padding: 0 12px; border: 1px solid var(--line); border-radius: 9px; background: var(--surface-soft); color: var(--ink); font-size: 12px; }
.no-show-search input { flex: 1; }
.no-show-search > span { color: var(--muted); font-size: 11px; line-height: 1.6; }
.no-show-counts { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.no-show-counts > div { display: grid; gap: 8px; padding: 14px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface-soft); }
.no-show-counts span { font-size: 11px; color: var(--muted); }
.no-show-counts strong { font-size: 24px; }
.no-show-empty { padding: 28px 18px; text-align: center; border: 1px dashed var(--line); border-radius: 10px; background: var(--surface-soft); }
.no-show-empty strong { font-size: 15px; }
.no-show-empty p { font-size: 12px; color: var(--muted); line-height: 1.7; margin-bottom: 0; }
.no-shows-panel table { width: 100%; border-collapse: collapse; font-size: 12px; }
.no-shows-panel th { text-align: left; font-size: 10px; color: var(--muted); padding: 12px; }
.no-shows-panel td { padding: 12px; border-top: 1px solid var(--line); overflow-wrap: anywhere; }
@media (max-width: 700px) {
 .no-shows-panel { padding: 14px; }
 .no-shows-panel .catalog-tools { flex-direction: column; align-items: stretch; }
 .no-show-counts { gap: 8px; }
 .no-show-counts > div { padding: 10px; }
 .no-show-counts strong { font-size: 21px; }
 .no-shows-panel thead { display: none; }
 .no-shows-panel tbody, .no-shows-panel tr { display: block; }
 .no-shows-panel tr { margin-bottom: 12px; padding: 8px; border: 1px solid var(--line); border-radius: 9px; }
 .no-shows-panel td { display: grid; grid-template-columns: 90px minmax(0, 1fr); gap: 8px; padding: 9px 4px; }
 .no-shows-panel td::before { content: attr(data-label); color: var(--muted); font-size: 11px; }
}
</style>
