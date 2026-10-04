<template>
  <section class="manifest-export" aria-labelledby="manifest-export-title">
    <div><h2 id="manifest-export-title">Passenger manifest export</h2><p>Choose a sailing from the report filters above. CSV includes all passengers on paid, confirmed reservations.</p></div>
    <div class="export-controls"><label for="export-manifest-sailing">Sailing<select id="export-manifest-sailing" v-model="selected" :disabled="exporting || !sailings.length"><option value="">Select a sailing</option><option v-for="s in sailings" :key="s.code" :value="s.code">{{ s.code }} · {{ s.origin }} → {{ s.destination }} · {{ s.vessel }}</option></select></label><button :disabled="!selected || exporting" @click="exportManifest">{{ exporting ? 'Exporting…' : 'Export manifest' }}</button></div>
    <p v-if="!sailings.length">No sailings match the selected report filters.</p><p v-if="error" class="error" role="alert">{{ error }}</p><p v-if="notice" role="status">{{ notice }}</p>
  </section>
</template>
<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { adminExportManifest, type AdminExportManifestData } from '../dataconnect-generated/staff'
import { staffDataConnect } from '../services/firebase'
import { reportCsv, type ReportSailing } from '../data/reportAnalytics'
import { ticketRequestError } from '../data/ticketActions'
const props = defineProps<{ sailings: ReportSailing[] }>()
const selected = ref(''), exporting = ref(false), error = ref(''), notice = ref('')
let request = 0
watch(() => props.sailings, sailings => {
  if (selected.value && !sailings.some(s => s.code === selected.value)) { request++; selected.value = ''; exporting.value = false; error.value = ''; notice.value = '' }
})
watch(selected, () => { error.value = ''; notice.value = '' })
onBeforeUnmount(() => { request++ })
async function exportManifest() {
  if (!selected.value || exporting.value) return
  const code = selected.value, version = ++request
  exporting.value = true; error.value = ''; notice.value = ''
  try {
    if (!staffDataConnect) throw new Error('The manifest service is unavailable.')
    const passengers: AdminExportManifestData['bookingPassengers'] = []
    for (let offset = 0; ; offset += 500) {
      const result = await adminExportManifest(staffDataConnect, { sailingCode: code, offset }, { fetchPolicy: 'SERVER_ONLY' })
      if (version !== request) return
      passengers.push(...result.data.bookingPassengers)
      if (result.data.bookingPassengers.length < 500) break
    }
    if (!passengers.length) { notice.value = 'No paid, confirmed passengers to export for this sailing.'; return }
    const dateTime = (value: string) => new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
    const csv = reportCsv(['Passenger', 'Sex', 'Type', 'Booking', 'Sailing', 'Ticket', 'Boarded at (PH)'], passengers.map(p => [p.fullName, p.sex || '', p.passengerType, p.booking.reference, p.booking.sailing.code, p.ticketStatus, p.boardedAt ? dateTime(p.boardedAt) : '']))
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const link = document.createElement('a'); link.href = url; link.download = `manifest-${code}.csv`; link.click(); URL.revokeObjectURL(url)
    notice.value = `Exported ${passengers.length} passengers for ${code}.`
  } catch (e) { if (version === request) error.value = ticketRequestError(e, 'Could not export the manifest. Try again.') }
  finally { if (version === request) exporting.value = false }
}
</script>
<style scoped>
.manifest-export{padding:22px;background:var(--surface);border:1px solid var(--line);border-radius:16px;color:var(--ink)}h2{font-size:18px;margin:0 0 10px}p{font-size:12px;line-height:1.6;color:var(--muted);margin:0 0 12px}.export-controls{display:flex;gap:16px;align-items:flex-end}label{display:grid;gap:8px;font-size:12px;font-weight:600;flex:1;min-width:0}select{width:100%;padding:10px;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--ink)}button{background:#238fe0;color:white;border:0;border-radius:8px;padding:12px 18px;white-space:nowrap;cursor:pointer;font-weight:600}button:disabled{opacity:.5;cursor:default}.error{color:#d85563}.manifest-export>p{margin:14px 0 0}@media(max-width:700px){.export-controls{flex-direction:column;align-items:stretch}.manifest-export{padding:16px}}
</style>
