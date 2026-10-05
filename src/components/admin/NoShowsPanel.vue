<template>
  <section class="catalog-panel">
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
    <div class="catalog-tools">
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
    <div class="catalog-table">
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
