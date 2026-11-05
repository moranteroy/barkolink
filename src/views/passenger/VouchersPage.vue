<template>
  <IonPage><IonContent><main class="claim-page">
    <PassengerHeader />
    <header class="claim-heading"><div><p class="eyebrow">MORE VALUE FOR YOUR JOURNEY</p><h1>Claim vouchers</h1><p>Discover travel promos and unlock rewards as you sail.</p></div><span class="heading-ticket" aria-hidden="true"><Tickets :size="34" /></span></header>
    <details class="claim-intro"><summary><Gift :size="18" aria-hidden="true" /><span>How to use your vouchers</span><ChevronDown :size="16" aria-hidden="true" /></summary><p>Copy a claimed voucher code and select Apply at booking review.</p></details>
    <div class="wallet-tools"><div class="wallet-tabs" role="group" aria-label="Voucher lists"><button :aria-pressed="tab === 'available'" @click="tab = 'available'">Available <span>{{ available.length }}</span></button><button :aria-pressed="tab === 'mine'" @click="tab = 'mine'">My vouchers <span>{{ mine.length }}</span></button></div><button class="refresh" :disabled="loading || !!claiming" @click="load"><RefreshCw :size="15" aria-hidden="true" />Refresh</button></div>
    <p v-if="loading && !data" class="wallet-state" role="status">Finding your vouchers...</p>
    <section v-else-if="error" class="wallet-state" role="alert"><strong>Vouchers are unavailable</strong><p>{{ error }}</p><Button @click="load">Try again</Button></section>
    <template v-else-if="data">
      <p class="mission-summary"><Ship :size="16" aria-hidden="true" />{{ data.completedTrips }} completed trip{{ data.completedTrips === 1 ? '' : 's' }}<span>Paid sailings with a boarded passenger count toward missions.</span></p>
      <div v-if="shown.length" class="voucher-cards" :aria-busy="loading">
        <article v-for="voucher in shown" :key="voucher.id" class="promo-card" :class="{ inactive: state(voucher) !== 'Ready to use' && !!voucher.claimedAt }">
          <div class="promo-offer"><span class="offer-icon"><Ticket :size="24" aria-hidden="true" /></span><strong>{{ voucher.discountType === 'PERCENT' ? `${voucher.value}%` : money(voucher.value) }}<small>OFF REGULAR FARES</small></strong><span class="promo-badge">{{ voucher.claimedAt ? state(voucher) : voucher.requiredTrips ? 'Trip mission' : 'Direct claim' }}</span></div>
          <div class="promo-body"><h2>{{ voucher.title }}</h2><p v-if="voucher.description" class="promo-description">{{ voucher.description }}</p><p class="promo-terms">Min. booking total {{ money(voucher.minimumSpend) }}<br />Valid until {{ expiry(voucher.expiresAt) }} (PH)</p>
            <div v-if="voucher.requiredTrips" class="mission"><div><strong>Complete {{ voucher.requiredTrips }} trip{{ voucher.requiredTrips === 1 ? '' : 's' }}</strong><span>{{ Math.min(data.completedTrips, voucher.requiredTrips) }} / {{ voucher.requiredTrips }}</span></div><progress :value="Math.min(data.completedTrips, voucher.requiredTrips)" :max="voucher.requiredTrips" :aria-label="`Completed trips for ${voucher.title}`" /></div>
            <p v-else class="no-mission"><CheckCircle2 :size="14" aria-hidden="true" />No mission required</p>
            <template v-if="voucher.claimedAt"><div class="claimed-code"><code>{{ voucher.code }}</code><button :aria-label="`Copy code for ${voucher.title}`" @click="copy(voucher)"><Copy :size="15" aria-hidden="true" />Copy</button></div><RouterLink v-if="state(voucher) === 'Ready to use'" class="book-link" to="/trips">Find a trip <ArrowRight :size="15" aria-hidden="true" /></RouterLink><p v-else class="unavailable-note">{{ voucher.used ? 'Used reservations count even if cancelled.' : 'This voucher is currently unavailable for a new booking.' }}</p></template>
            <template v-else><div class="claim-footer"><small>{{ voucher.remaining }} slot{{ voucher.remaining === 1 ? '' : 's' }} left</small><Button class="claim-button" :disabled="loading || !!claiming || data.completedTrips < voucher.requiredTrips || !ready(voucher) || voucher.remaining < 1" :aria-label="`Claim ${voucher.title}`" @click="claim(voucher)">{{ claiming === voucher.id ? 'Claiming...' : data.completedTrips < voucher.requiredTrips ? 'Mission in progress' : ready(voucher) ? 'Claim voucher' : 'Unavailable' }}</Button></div></template>
          </div>
        </article>
      </div>
      <section v-else class="wallet-state empty"><Ticket :size="38" aria-hidden="true" /><h2>{{ tab === 'mine' ? 'Your next reward is waiting' : 'No vouchers available right now' }}</h2><p>{{ tab === 'mine' ? 'Claim an available promo and its code will appear here.' : 'Check back for new travel promos. Your loyalty rewards are available on Home.' }}</p><Button v-if="tab === 'mine'" @click="tab = 'available'">Browse available vouchers</Button><RouterLink v-else to="/home#loyalty-rewards">View loyalty rewards</RouterLink></section>
      <p class="claim-rules">Each account can claim a promo once. Claiming reserves one slot until the voucher expires. Paused or expired vouchers cannot be applied. Promo missions use your total completed trips.</p>
    </template>
  </main><PassengerBottomNav /></IonContent></IonPage>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { IonPage, IonContent, onIonViewWillEnter } from '@ionic/vue';
import { Ticket, Tickets, Gift, Ship, RefreshCw, CheckCircle2, Copy, ArrowRight, ChevronDown } from '@lucide/vue';
import { Button } from "../../components/ui/button";
import PassengerHeader from '../../components/passenger/PassengerHeader.vue';
import PassengerBottomNav from '../../components/passenger/PassengerBottomNav.vue';
import { passengerVouchers, claimVoucher, type PassengerVoucherData, type PassengerVoucher } from '../../services/vouchers';
import { requireSupabase } from '../../services/supabase';
import { databaseRequestError } from '../../data/databaseErrors';
import { notifyError, notifySuccess } from '../../composables/toast';
const data = ref<PassengerVoucherData | null>(null), loading = ref(false), error = ref(''), claiming = ref(''), tab = ref<'available'|'mine'>('available');
const now = ref(Date.now());
const timer = setInterval(() => { now.value = Date.now(); }, 30000);
onBeforeUnmount(() => clearInterval(timer));
const available = computed(() => data.value?.vouchers.filter(v => !v.claimedAt && ready(v) && v.remaining > 0) || []);
const mine = computed(() => data.value?.vouchers.filter(v => v.claimedAt).sort((a,b) => Number(state(a) !== 'Ready to use') - Number(state(b) !== 'Ready to use') || Date.parse(a.expiresAt) - Date.parse(b.expiresAt)) || []);
const shown = computed(() => tab.value === 'available' ? available.value : mine.value);
const money = (amount:number) => `PHP ${amount.toLocaleString('en-PH')}`;
const expiry = (at:string) => new Intl.DateTimeFormat('en-PH',{timeZone:'Asia/Manila',dateStyle:'medium',timeStyle:'short'}).format(new Date(at));
function ready(v:PassengerVoucher) { return v.isActive && Date.parse(v.startsAt) <= now.value && Date.parse(v.expiresAt) > now.value; }
function state(v:PassengerVoucher) { return v.used ? 'Used' : !v.isActive ? 'Paused' : Date.parse(v.expiresAt) <= now.value ? 'Expired' : Date.parse(v.startsAt) > now.value ? 'Not yet available' : 'Ready to use'; }
async function load() {
  if (loading.value) return;
  loading.value = true; error.value = '';
  try { data.value = (await passengerVouchers(requireSupabase())).data; now.value = Date.now(); }
  catch (cause) { error.value = databaseRequestError(cause,'Could not load vouchers. Please try again.'); }
  finally { loading.value = false; }
}
async function claim(v:PassengerVoucher) {
  if (claiming.value) return;
  claiming.value = v.id;
  try {
    const result = (await claimVoucher(requireSupabase(),v.id)).data;
    v.claimedAt = result.claimedAt; v.code = result.code;
    tab.value = 'mine'; notifySuccess('Voucher claimed. Copy your code and apply it at booking review.');
    await load();
  } catch (cause) { notifyError(databaseRequestError(cause,'Could not claim this voucher. Refresh and try again.')); await load(); }
  finally { claiming.value = ''; }
}
async function copy(v:PassengerVoucher) {
  if (!v.code) return;
  try { await navigator.clipboard.writeText(v.code); notifySuccess('Voucher code copied.'); }
  catch { notifyError('Could not copy the code. Select the displayed code and copy it manually.'); }
}
onIonViewWillEnter(load);
</script>
<style scoped>
.claim-page { max-width:560px; box-sizing:border-box; margin:0 auto; padding:24px 24px 120px; color:var(--ink); }
.claim-heading { display:flex; align-items:center; justify-content:space-between; gap:18px; margin:24px 0 18px; }
.eyebrow { color:var(--ocean); font-size:11px; font-weight:700; letter-spacing:.1em; }
h1 { margin:7px 0 10px; font-size:28px; letter-spacing:-.035em; } .claim-heading p:last-child { color:var(--muted); font-size:14px; line-height:1.6; }
.heading-ticket { display:grid; place-items:center; width:54px; height:54px; flex:none; border:1px solid var(--line); border-radius:20px; background:var(--light-blue); color:var(--ocean); transform:rotate(-8deg); }
.claim-intro { border:1px solid var(--line); border-radius:12px; background:var(--surface); }
.claim-intro summary { display:flex; align-items:center; gap:10px; min-height:48px; padding:10px 14px; box-sizing:border-box; color:var(--ink); font-size:13px; font-weight:600; cursor:pointer; list-style:none; }
.claim-intro summary::-webkit-details-marker { display:none; }.claim-intro summary>svg { color:var(--ocean); flex:none; }.claim-intro summary>svg:last-child { margin-left:auto; transition:transform .15s; }.claim-intro[open] summary>svg:last-child { transform:rotate(180deg); }
.claim-intro p { margin:0; padding:0 14px 14px 42px; font-size:13px; line-height:1.7; color:var(--muted); }
.wallet-tools { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px; margin:18px 0 12px; }
.wallet-tabs { display:flex; gap:4px; padding:4px; border:1px solid var(--line); border-radius:12px; background:var(--surface); }
button,a { -webkit-tap-highlight-color:transparent; }.wallet-tabs button,.refresh,.claimed-code button { display:inline-flex; align-items:center; justify-content:center; gap:7px; min-height:44px; border:0; border-radius:9px; background:transparent; color:var(--muted); font:inherit; font-size:13px; font-weight:600; cursor:pointer; padding:8px 12px; }
.wallet-tabs button[aria-pressed=true] { color:var(--ocean); background:var(--light-blue); }.wallet-tabs span { font-size:11px; }.refresh { border:1px solid var(--line); background:var(--surface); }
.mission-summary { display:flex; align-items:center; flex-wrap:wrap; gap:8px; color:var(--ink); font-size:12px; margin:16px 0; }.mission-summary>svg { color:var(--ocean); }.mission-summary span { color:var(--muted); }
.voucher-cards { display:grid; grid-template-columns:minmax(0,1fr); gap:18px; align-items:start; }.promo-card { min-width:0; border:1px solid var(--line); border-radius:18px; overflow:hidden; background:var(--surface); }
.promo-offer { display:flex; align-items:center; flex-wrap:wrap; gap:12px; padding:20px; background:linear-gradient(125deg,var(--light-blue),var(--surface-soft)); border-bottom:1px dashed var(--line); }
.offer-icon { display:grid; place-items:center; width:46px; height:46px; border-radius:14px; background:var(--surface); color:var(--ocean); flex:none; }.promo-offer>strong { font-size:26px; letter-spacing:-.035em; color:var(--ocean); }.promo-offer strong small { display:block; margin-top:3px; font-size:9px; letter-spacing:.1em; color:var(--muted); }.promo-badge { margin-left:auto; border:1px solid var(--line); border-radius:20px; padding:6px 9px; font-size:10px; font-weight:600; color:var(--ink); background:var(--surface); }
.promo-body { padding:20px; }h2 { font-size:16px; line-height:1.5; margin:0 0 8px; overflow-wrap:anywhere; }.promo-description { color:var(--muted); font-size:13px; line-height:1.65; white-space:pre-wrap; overflow-wrap:anywhere; }.promo-terms { margin:14px 0; font-size:12px; line-height:1.8; color:var(--muted); }
.mission { padding:12px; background:var(--surface-soft); border-radius:10px; }.mission>div { display:flex; justify-content:space-between; gap:10px; font-size:12px; }progress { width:100%; height:7px; margin-top:10px; accent-color:var(--ocean); }.no-mission { display:flex; align-items:center; gap:6px; color:var(--ocean); font-size:12px; }
.claim-footer { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-top:18px; }.claim-footer small { color:var(--muted); font-size:12px; }.claim-button,.wallet-state button,.book-link { min-height:44px; display:inline-flex; align-items:center; justify-content:center; gap:8px; padding:11px 16px; border:0; border-radius:10px; background:var(--action); color:white; font:inherit; font-size:13px; font-weight:600; text-decoration:none; cursor:pointer; }button:disabled { opacity:.55; cursor:not-allowed; }
.claimed-code { display:flex; align-items:center; gap:8px; padding:8px 10px; border:1px dashed var(--line); border-radius:10px; margin-top:16px; background:var(--surface-soft); }.claimed-code code { flex:1; min-width:0; font-size:13px; font-weight:700; overflow-wrap:anywhere; user-select:all; }.claimed-code button { flex:none; color:var(--ocean); padding:6px; }.book-link { width:100%; box-sizing:border-box; margin-top:12px; }.unavailable-note { color:var(--muted); font-size:12px; margin-top:12px; line-height:1.6; }.inactive .promo-offer>strong { color:var(--muted); }
.wallet-state { padding:30px 20px; border:1px solid var(--line); border-radius:16px; background:var(--surface); text-align:center; }.wallet-state p { margin:10px 0 16px; color:var(--muted); font-size:13px; line-height:1.7; }.wallet-state>svg { color:var(--ocean); margin-bottom:12px; }.wallet-state a { color:var(--ocean); display:inline-block; padding:12px; }.claim-rules { margin-top:22px; color:var(--muted); font-size:12px; line-height:1.8; }
button:focus-visible,a:focus-visible,summary:focus-visible { outline:2px solid var(--ocean); outline-offset:3px; }
@container passenger (max-width:650px) { .claim-page { padding:20px 16px 110px; }.claim-heading { margin-top:24px; }h1 { font-size:28px; }.heading-ticket { width:54px; height:54px; }.voucher-cards { grid-template-columns:minmax(0,1fr); }.promo-offer,.promo-body { padding:16px; }.wallet-tools { gap:8px; }.wallet-tabs button { padding:8px 10px; }.refresh { padding:8px; }.mission-summary span { flex-basis:100%; } }
</style>
