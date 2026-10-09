<template>
  <section class="manifest-export" :class="{ 'workspace-export': sailingCode || externalSelection }" aria-labelledby="manifest-export-title">
    <div class="export-heading">
      <span class="export-symbol"><FileText aria-hidden="true" /></span>
      <div>
      <p class="eyebrow">CSV DOWNLOAD</p>
      <h2 id="manifest-export-title">Passenger manifest export</h2>
      <p>
        {{ sailingCode ? `Sailing ${sailingCode}.` : externalSelection ? 'Choose a sailing in the filters below.' : 'Choose a sailing below.' }} CSV includes all
        passengers on paid, confirmed reservations.
      </p>
      </div>
    </div>
    <div class="export-controls">
      <label v-if="!sailingCode && !externalSelection" for="export-manifest-sailing"
        >Sailing<select
          id="export-manifest-sailing"
          v-model="selected"
          :disabled="exporting || !sailings.length"
        >
          <option value="">Select a sailing</option>
          <option v-for="s in sailings" :key="s.code" :value="s.code">
            {{ s.code }} · {{ s.origin }} → {{ s.destination }} · {{ s.vessel }}
          </option>
        </select></label
      ><button :disabled="!selected || exporting" @click="exportManifest">
        <Download aria-hidden="true" />
        {{ exporting ? "Exporting…" : "Export manifest" }}
      </button>
    </div>
    <p v-if="!sailings.length">
      No sailings are available to export.
    </p>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="notice" role="status">{{ notice }}</p>
  </section>
</template>
<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from "vue";
import { FileText, Download } from "@lucide/vue";
import {
  adminExportManifest,
  type AdminExportManifestData,
} from "../../services/database/staff";
import { staffDatabase } from "../../services/session";
import { reportCsv, type ReportSailing } from "../../data/reportAnalytics";
import { ticketRequestError } from "../../data/ticketActions";
const props = defineProps<{
  sailings: Pick<ReportSailing, "code" | "origin" | "destination" | "vessel">[];
  sailingCode?: string;
  externalSelection?: boolean;
}>();
const selected = ref(""),
  exporting = ref(false),
  error = ref(""),
  notice = ref("");
let request = 0;
watch(() => props.sailingCode, (code) => {
  request++;
  exporting.value = false;
  selected.value = code && props.sailings.some(s => s.code === code) ? code : '';
  error.value = '';
  notice.value = '';
}, { immediate: true });
watch(
  () => props.sailings,
  (sailings) => {
    if (selected.value && !sailings.some((s) => s.code === selected.value)) {
      request++;
      selected.value = "";
      exporting.value = false;
      error.value = "";
      notice.value = "";
    }
  },
);
watch(selected, () => {
  error.value = "";
  notice.value = "";
});
onBeforeUnmount(() => {
  request++;
});
async function exportManifest() {
  if (!selected.value || exporting.value) return;
  const code = selected.value,
    version = ++request;
  exporting.value = true;
  error.value = "";
  notice.value = "";
  try {
    if (!staffDatabase) throw new Error("The manifest service is unavailable.");
    const passengers: AdminExportManifestData["bookingPassengers"] = [];
    for (let offset = 0; ; offset += 500) {
      const result = await adminExportManifest(
        staffDatabase,
        { sailingCode: code, offset },
        { fetchPolicy: "SERVER_ONLY" },
      );
      if (version !== request) return;
      passengers.push(...result.data.bookingPassengers);
      if (result.data.bookingPassengers.length < 500) break;
    }
    if (!passengers.length) {
      notice.value =
        "No paid, confirmed passengers to export for this sailing.";
      return;
    }
    const dateTime = (value: string) =>
      new Intl.DateTimeFormat("en-PH", {
        timeZone: "Asia/Manila",
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value));
    const csv = reportCsv(
      [
        "Passenger",
        "Sex",
        "Type",
        "Booking",
        "Sailing",
        "Ticket",
        "Boarded at (PH)",
      ],
      passengers.map((p) => [
        p.fullName,
        p.sex || "",
        p.passengerType,
        p.booking.reference,
        p.booking.sailing.code,
        p.ticketStatus,
        p.boardedAt ? dateTime(p.boardedAt) : "",
      ]),
    );
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8;" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `manifest-${code}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    notice.value = `Exported ${passengers.length} passengers for ${code}.`;
  } catch (e) {
    if (version === request)
      error.value = ticketRequestError(
        e,
        "Could not export the manifest. Try again.",
      );
  } finally {
    if (version === request) exporting.value = false;
  }
}
</script>
<style scoped>
.manifest-export {
  padding: 14px 16px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 14px;
  color: var(--ink);
}
.workspace-export { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 14px; padding: 16px 18px; border-radius: 12px; }
.workspace-export .export-heading { margin: 0; }
.workspace-export h2 { font-size: 15px; }
.workspace-export > p { grid-column: 1 / -1; margin: 0; }
.workspace-export button { font-size: 12px; min-height: 40px; padding: 10px 14px; }
h2 {
  font-size: 17px;
  margin: 0 0 10px;
}
p {
  font-size: 12px;
  line-height: 1.6;
  color: var(--muted);
  margin: 0 0 12px;
}
.export-controls {
  display: flex;
  gap: 12px;
  align-items: flex-end;
}
label {
  display: grid;
  gap: 8px;
  font-size: 12px;
  font-weight: 600;
  flex: 1;
  min-width: 0;
}
select {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface);
  color: var(--ink);
  min-height: 40px;
  font: inherit;
  font-size: 12px;
  background: var(--surface-soft);
}
button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 40px;
  background: #246fba;
  color: white;
  border: 0;
  border-radius: 8px;
  padding: 9px 14px;
  white-space: nowrap;
  cursor: pointer;
  font-weight: 600;
}
button:disabled {
  opacity: 0.5;
  cursor: default;
}
.error {
  color: #d85563;
}
.manifest-export > p {
  margin: 14px 0 0;
}
.export-heading { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 12px; }
.export-heading p:last-child { margin-bottom: 0; }
.export-symbol { display: grid; place-items: center; width: 36px; height: 36px; flex: none; border-radius: 10px; background: var(--light-blue); color: var(--ocean); }
.export-symbol svg { width: 23px; height: 23px; }
.export-heading .eyebrow { margin: 0 0 6px; color: var(--ocean); font-size: 10px; font-weight: 800; letter-spacing: .1em; }
.export-heading h2 { margin-bottom: 6px; }
button svg { width: 16px; height: 16px; }
button:focus-visible, select:focus-visible { outline: 2px solid var(--ocean); outline-offset: 3px; }
@media (max-width: 700px) {
  .workspace-export { grid-template-columns: 1fr; }
  .export-controls {
    flex-direction: column;
    align-items: stretch;
  }
  .manifest-export {
    padding: 16px;
  }
  select { min-height: 44px; font-size: 16px; }
  button { min-height: 44px; }
}
</style>
