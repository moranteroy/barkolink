<template>
  <section class="payment-return" :class="state" role="status" :aria-busy="busy">
    <small>PAYMENT UPDATE · {{ reference }}</small>
    <h2>{{ heading }}</h2>
    <p>{{ message }}</p>
    <router-link v-if="state === 'paid'" :to="`${ticketEligible ? '/ticket' : '/booking-details'}?reference=${encodeURIComponent(reference)}`">{{ ticketEligible ? 'View e-ticket' : 'View booking details' }}</router-link>
    <button v-else :disabled="busy" @click="verify">{{ busy ? 'Checking payment…' : 'Check again' }}</button>
  </section>
</template>
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { paymentRequest } from '../../services/payments';
const props = defineProps<{ bookingId: string; reference: string; ticketEligible: boolean; awaitingVerification?: boolean; cancelled?: boolean }>();
const emit = defineEmits<{ updated: []; checking: [] }>();
const busy = ref(false), state = ref('checking'), failure = ref('');
const heading = computed(() => ({ checking: 'Confirming payment receipt', paid: props.awaitingVerification ? 'Awaiting staff verification' : 'Payment successful', unpaid: props.cancelled ? 'Checkout cancelled' : 'Payment not yet confirmed', review: 'Payment needs review', error: 'Could not verify payment' })[state.value] || 'Payment update');
const message = computed(() => ({ checking: 'Please wait while we confirm your payment with the payment provider.', paid: props.awaitingVerification ? 'Your online payment was received. Staff will verify the transaction before issuing your e-ticket. Do not pay again.' : props.ticketEligible ? 'Your payment is confirmed and your e-ticket is ready. No further payment is needed.' : 'Your payment is confirmed. Check your booking details for ticket availability. Do not pay again.', unpaid: 'Your reservation is still awaiting payment. Resume checkout below or choose cash at ticketing.', review: 'Contact ticketing for assistance. Do not pay again.', error: failure.value })[state.value] || '');
async function verify() {
  if (busy.value) return;
  busy.value = true; state.value = 'checking'; failure.value = '';
  emit('checking');
  try {
    const result = await paymentRequest('status', props.bookingId);
    state.value = result.status === 'PAID' ? 'paid' : result.status === 'REVIEW' ? 'review' : 'unpaid';
    emit('updated');
  } catch (cause) {
    state.value = 'error';
    failure.value = cause instanceof Error ? cause.message : 'Please retry. Do not pay again until your payment status is verified.';
  } finally { busy.value = false; }
}
onMounted(verify);
</script>
<style scoped>
.payment-return { margin: 0 0 20px; padding: 20px; border: 1px solid var(--line); border-radius: 14px; background: var(--surface); color: var(--ink); }
.payment-return.paid { border-color: var(--ocean); background: var(--light-blue); }
small { color: var(--muted); font-size: 10px; letter-spacing: .04em; overflow-wrap: anywhere; }
h2 { margin: 8px 0; font-size: 20px; }
p { margin: 0; font-size: 13px; line-height: 1.7; color: var(--muted); }
a, button { display: inline-block; margin-top: 14px; padding: 10px 15px; border: 0; border-radius: 8px; background: var(--action); color: #fff; text-decoration: none; font: inherit; font-size: 12px; cursor: pointer; }
button:disabled { opacity: .6; cursor: default; }
</style>
