<template>
  <section class="online-payment" aria-label="Payment options">
    <div class="payment-heading">
      <span class="payment-icon"><ion-icon :icon="walletOutline" aria-hidden="true" /></span>
      <div><h3>Awaiting payment</h3><p>Your seat is reserved. Payment has not been completed.</p></div>
    </div>
    <div class="online-option">
      <div class="option-heading"><strong>Pay online</strong><span><ion-icon :icon="shieldCheckmarkOutline" aria-hidden="true" /> Secure checkout</span></div>
      <p>Choose a method and complete payment at checkout. We will verify your payment before issuing your e-ticket.</p>
      <div class="payment-methods" aria-label="Accepted online payment methods">
        <span class="gcash">GCash</span><span class="maya">Maya</span><span><ion-icon :icon="cardOutline" aria-hidden="true" /> Credit / debit card</span>
      </div>
      <button class="pay-button" :disabled="busy || closed" @click="run('checkout')">
        <ion-icon :icon="lockClosedOutline" aria-hidden="true" />
        {{ busy ? 'Processing…' : closed ? 'Online checkout closed' : 'Continue to payment' }}
        <ion-icon :icon="arrowForwardOutline" aria-hidden="true" />
      </button>
      <div class="payment-support"><small>Payments processed by PayMongo</small><button :disabled="busy" @click="run('status')">Check payment</button></div>
    </div>
    <div class="cash-option">
      <ion-icon :icon="cashOutline" aria-hidden="true" />
      <div><strong>Prefer to pay in cash?</strong><p>Pay at the ticketing counter before your deadline.</p></div>
      <button :disabled="busy || closed" @click="run('close')">{{ closed ? 'Cash selected' : 'Choose cash' }}</button>
    </div>
    <p v-if="notice" class="payment-notice" role="status"><ion-icon :icon="informationCircleOutline" aria-hidden="true" />{{ notice }}</p>
    <p v-if="error" class="payment-error" role="alert">{{ error }}</p>
  </section>
</template>
<script setup lang="ts">
import { ref } from 'vue';
import { IonIcon } from '@ionic/vue';
import { walletOutline, shieldCheckmarkOutline, cardOutline, lockClosedOutline, arrowForwardOutline, cashOutline, informationCircleOutline } from 'ionicons/icons';
import { paymentRequest } from '../../services/payments';
const props = defineProps<{ bookingId: string; reference: string }>();
const emit = defineEmits<{ updated: [] }>();
const busy = ref(false), closed = ref(false), notice = ref(''), error = ref('');
async function run(action: 'checkout' | 'status' | 'close') {
  if (busy.value) return;
  busy.value = true; error.value = ''; notice.value = '';
  try {
    const result = await paymentRequest(action, props.bookingId);
    if (result.checkoutUrl) {
      const url = new URL(result.checkoutUrl);
      if (result.testMode !== true || url.protocol !== 'https:' || url.hostname !== 'checkout.paymongo.com') throw new Error('Could not open the payment page. Please try again.');
      window.location.assign(url.href);
      return;
    }
    closed.value = result.status === 'CLOSED';
    notice.value = result.status === 'PAID' ? 'Payment received. Open My bookings to check staff verification and e-ticket availability.'
      : result.status === 'REVIEW' ? 'Payment requires administrator review. Do not pay again.'
      : closed.value ? 'Online checkout is closed. You can now pay cash at ticketing.'
      : 'No completed payment yet. You can resume checkout or close it before paying cash.';
    if (result.status !== 'UNPAID') emit('updated');
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Could not process payment.';
  } finally { busy.value = false; }
}
</script>
<style scoped>
.online-payment { margin: 18px 0; padding: 18px; border: 1px solid var(--line); border-radius: 16px; background: var(--surface); color: var(--ink); text-align: left; font-family: inherit; }
.payment-heading { display: flex; align-items: center; gap: 12px; margin-bottom: 18px; }
.payment-icon { display: grid; place-items: center; width: 42px; height: 42px; flex: none; border-radius: 12px; background: var(--light-blue); color: var(--ocean); font-size: 23px; }
.payment-heading h3 { margin: 0; font-size: 16px; line-height: 1.4; }
.online-payment p { font-size: 12px; line-height: 1.7; margin: 5px 0 0; color: var(--muted); }
.online-option { padding: 16px; border: 1px solid var(--line); border-radius: 12px; background: var(--surface-soft); }
.option-heading { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; justify-content: space-between; font-size: 14px; }
.option-heading > span { display: inline-flex; align-items: center; gap: 4px; color: var(--muted); font-size: 10px; }
.payment-methods { display: flex; flex-wrap: wrap; gap: 7px; margin: 14px 0; }
.payment-methods span { display: inline-flex; align-items: center; gap: 5px; padding: 7px 9px; border: 1px solid var(--line); border-radius: 7px; background: var(--surface); font-size: 11px; font-weight: 600; }
.payment-methods .gcash { color: var(--ocean); }
.payment-methods .maya { color: var(--success, #218466); }
.online-payment button { font-family: inherit; cursor: pointer; }
.pay-button { display: flex; align-items: center; justify-content: center; gap: 9px; width: 100%; min-height: 46px; padding: 11px; border: 0; border-radius: 9px; background: var(--action); color: #fff; font-size: 13px; font-weight: 600; }
.pay-button ion-icon { flex: none; font-size: 17px; }
.pay-button ion-icon:last-child { margin-left: auto; }
.pay-button ion-icon:first-child { margin-right: auto; }
.payment-support { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 5px; margin-top: 9px; }
.payment-support small { color: var(--muted); font-size: 10px; }
.payment-support button { padding: 7px 0; min-height: 36px; border: 0; background: transparent; color: var(--ocean); font-size: 11px; font-weight: 600; }
.cash-option { display: grid; grid-template-columns: 22px minmax(0, 1fr); gap: 8px 10px; align-items: start; padding-top: 16px; margin-top: 16px; border-top: 1px solid var(--line); }
.cash-option > ion-icon { color: var(--ocean); font-size: 21px; }
.cash-option strong { font-size: 12px; }
.cash-option button { grid-column: 2; justify-self: start; min-height: 36px; padding: 7px 12px; border: 1px solid var(--line); border-radius: 7px; background: var(--surface-soft); color: var(--ocean); font-size: 11px; font-weight: 600; }
.online-payment .payment-notice { display: flex; gap: 7px; margin-top: 14px; color: var(--ocean); }
.payment-notice ion-icon { flex: none; font-size: 18px; margin-top: 2px; }
.online-payment .payment-error { margin-top: 14px; color: var(--danger); }
.online-payment button:disabled { opacity: .6; cursor: default; }
.online-payment button:focus-visible { outline: 2px solid var(--ocean); outline-offset: 3px; }
@media (max-width: 380px) { .online-payment { padding: 14px; } .online-option { padding: 12px; } }
</style>
