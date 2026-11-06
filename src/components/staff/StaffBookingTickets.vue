<template>
  <section v-if="ready" class="staff-e-tickets" aria-label="Passenger e-tickets">
    <div class="ticket-heading">
      <div>
        <h3>Passenger e-ticket{{ ticket.passengers.length === 1 ? '' : 's' }}</h3>
        <p>{{ ticket.from }} → {{ ticket.to }} · {{ ticket.date }} · {{ ticket.departure }}</p>
      </div>
      <span class="paid-label">Paid</span>
    </div>
    <p class="ticket-vessel">{{ ticket.vessel }} · {{ ticket.reference }}</p>
    <p v-if="loading" role="status">Preparing passenger QR tickets…</p>
    <div v-else-if="qrError" class="ticket-error" role="alert">
      <p>{{ qrError }}</p>
      <button type="button" @click="prepareQr">Retry QR</button>
    </div>
    <article
      v-for="(person, index) in ticket.passengers"
      :key="person.ticketCode || index"
      class="passenger-ticket"
    >
      <h4>{{ person.name }}</h4>
      <p>{{ person.type }} · {{ passengerTicketState(ticket, person).label }}</p>
      <img
        v-if="passengerTicketState(ticket, person).showQr && images[index]"
        :src="images[index]"
        :alt="'Boarding QR for ' + person.name"
        width="240"
        height="240"
      />
      <p
        v-else-if="passengerTicketState(ticket, person).showQr && !loading && !qrError"
        class="ticket-error"
        role="status"
      >
        Verified QR is unavailable. Reload the booking before printing.
      </p>
      <code>{{ person.ticketCode }}</code>
      <p class="ticket-instructions">{{ passengerTicketState(ticket, person).message }}</p>
    </article>
    <p v-if="actionError" role="alert" class="ticket-error">{{ actionError }}</p>
    <div class="ticket-actions">
      <button
        type="button"
        :disabled="loading || busy || !exportReady"
        @click="exportTicket('print')"
      >
        {{ busy ? 'Preparing…' : 'Print/PDF e-ticket' }}
      </button>
      <button
        type="button"
        :disabled="loading || busy || !exportReady"
        @click="exportTicket('download')"
      >
        Download e-ticket
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import QRCode from 'qrcode';
import { staffTicket, type StaffTicketBooking } from '../../data/staffTicket';
import { passengerTicketState } from '../../data/bookingLifecycle';
import { bookingTicketReady } from '../../data/paymentVerification';
import { downloadTicket, printTicketDocument } from '../../data/ticketExport';

const props = defineProps<{ booking: StaffTicketBooking }>();
const ticket = computed(() => staffTicket(props.booking));
const ready = computed(() => bookingTicketReady(props.booking));
const exportReady = computed(
  () =>
    ready.value &&
    ticket.value.passengers.some(
      (person) =>
        person.ticketCode &&
        ['ISSUED', 'CHECKED_IN', 'BOARDED'].includes(person.ticketStatus || ''),
    ) &&
    ticket.value.passengers.every(
      (person) => !passengerTicketState(ticket.value, person).showQr || !!person.ticketQrPayload,
    ),
);
const images = ref<string[]>([]),
  loading = ref(false),
  busy = ref(false),
  qrError = ref(''),
  actionError = ref('');
let generation = 0;
async function prepareQr() {
  const current = ++generation;
  images.value = [];
  qrError.value = '';
  actionError.value = '';
  if (!ready.value) {
    loading.value = false;
    return;
  }
  loading.value = true;
  try {
    const document = ticket.value;
    const result = await Promise.all(
      document.passengers.map((person) =>
        passengerTicketState(document, person).showQr && person.ticketQrPayload
          ? QRCode.toDataURL(person.ticketQrPayload, {
              width: 360,
              margin: 4,
              errorCorrectionLevel: 'M',
            })
          : '',
      ),
    );
    if (generation === current) images.value = result;
  } catch {
    if (generation === current)
      qrError.value = 'Could not prepare the QR image. Retry without collecting cash again.';
  } finally {
    if (generation === current) loading.value = false;
  }
}
async function exportTicket(action: 'print' | 'download') {
  if (!exportReady.value || busy.value) return;
  busy.value = true;
  actionError.value = '';
  try {
    await (action === 'print' ? printTicketDocument(ticket.value) : downloadTicket(ticket.value));
  } catch (error) {
    actionError.value =
      error instanceof Error ? error.message : 'Could not export this ticket. Try again.';
  } finally {
    busy.value = false;
  }
}
watch(ticket, prepareQr, { immediate: true });
onBeforeUnmount(() => {
  generation++;
});
</script>

<style scoped>
.staff-e-tickets {
  padding: 20px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--surface);
  color: var(--ink);
  margin: 20px 0;
  min-width: 0;
}
.ticket-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
h3,
h4 {
  margin: 0 0 8px;
}
p {
  line-height: 1.6;
  overflow-wrap: anywhere;
}
.ticket-heading p,
.ticket-vessel,
.ticket-instructions {
  color: var(--muted);
  font-size: 13px;
}
.paid-label {
  color: var(--ocean);
  font-weight: 700;
}
.passenger-ticket {
  border-top: 1px dashed var(--line);
  margin-top: 16px;
  padding-top: 16px;
  text-align: center;
  min-width: 0;
}
.passenger-ticket img {
  display: block;
  max-width: 100%;
  height: auto;
  margin: 16px auto;
  background: white;
  border-radius: 10px;
}
code {
  display: block;
  overflow-wrap: anywhere;
  font-size: 12px;
}
.ticket-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 16px;
}
button {
  min-height: 44px;
  padding: 10px 14px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface-soft);
  color: var(--ink);
  font: inherit;
  cursor: pointer;
}
button:disabled {
  opacity: 0.5;
  cursor: default;
}
button:focus-visible {
  outline: 2px solid var(--ocean);
  outline-offset: 3px;
}
.ticket-error {
  color: var(--ink);
}
</style>
