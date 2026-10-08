<template>
  <section class="loyalty-card" aria-labelledby="loyalty-heading" :aria-busy="loading">
    <header class="loyalty-heading"><h2 id="loyalty-heading"><span class="heading-icon"><Gift :size="17" aria-hidden="true" /></span>Loyalty rewards</h2><span v-if="data" class="tier-badge" :data-tier="data.currentTier.toLowerCase()"><Medal :size="13" aria-hidden="true" />{{ data.currentTier }}</span></header>
    <p v-if="loading && !data" class="state-message" role="status">Checking your rewards…</p>
    <p v-else-if="error" class="state-message" role="status">Could not load your rewards. <button @click="load">Try again</button></p>
    <template v-else-if="data">
      <div class="reward-overview"><div><span class="reward-eyebrow">YOUR NEXT REWARD</span><strong class="reward-amount">{{ money(data.rewardValue) }}<small>off</small></strong><p>Eligible regular passenger fares</p></div><span class="reward-art" aria-hidden="true"><Ticket :size="34" :stroke-width="1.6" /><Sparkles :size="16" /></span></div>
      <div class="progress-section"><div class="progress-heading"><strong>{{ data.tripsToNextReward }} more trip{{ data.tripsToNextReward === 1 ? '' : 's' }} to unlock</strong><span>{{ progressTrips }} / {{ cycleSize }}</span></div><progress :value="progressTrips" :max="cycleSize" aria-label="Trips toward your next loyalty voucher" :aria-valuetext="`${progressTrips} of ${cycleSize} trips toward your next reward`" /><p><Ship :size="13" aria-hidden="true" />{{ data.completedTrips }} completed trip{{ data.completedTrips === 1 ? '' : 's' }}<span>Rewards grow with your journeys</span></p></div>
      <div v-if="data.vouchers.length" class="voucher-list"><div class="voucher-heading"><strong>Ready to use</strong><span>{{ data.vouchers.length }} reward{{ data.vouchers.length === 1 ? '' : 's' }}</span></div><article v-for="voucher in data.vouchers" :key="voucher.code" class="reward-ready"><span class="voucher-icon"><Ticket :size="22" aria-hidden="true" /></span><div><strong>{{ money(voucher.value) }} off your next eligible booking</strong><p>Applies automatically at booking review.</p><small>Valid until {{ expiry(voucher.expiresAt) }} · Regular fares only</small></div><CheckCircle2 :size="17" class="voucher-check" aria-hidden="true" /></article></div>
      <div class="milestone-heading"><h3>Your milestones</h3><span>One reward per booking</span></div>
      <div class="reward-tiers" aria-label="Loyalty reward milestones"><div v-for="tier in data.tiers" :key="tier.name" class="milestone" :data-tier="tier.name.toLowerCase()" :class="{ reached: data.completedTrips >= tier.trips, next: nextTier?.name === tier.name }"><span class="milestone-icon"><Medal :size="20" :stroke-width="1.8" aria-hidden="true" /></span><strong class="tier-name">{{ tier.name }}</strong><b>{{ money(tier.value) }}</b><small>{{ tier.trips }} trips</small><span class="milestone-state"><Check :size="10" v-if="data.completedTrips >= tier.trips" aria-hidden="true" />{{ data.completedTrips >= tier.trips ? 'Unlocked' : nextTier?.name === tier.name ? 'Up next' : 'Milestone' }}</span></div></div>
      <details class="reward-rules"><summary>How rewards work <ChevronDown :size="14" aria-hidden="true" /></summary><p>Counted once per sailing, after boarding and trip completion. After {{ data.tiers.at(-1)?.trips }} trips, earn {{ money(data.tiers.at(-1)?.value || 0) }} every {{ data.tripsPerReward }} more trips. Rewards apply to eligible regular fares.</p></details>
    </template>
  </section>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Gift, Medal, Ticket, Sparkles, Ship, Check, CheckCircle2, ChevronDown } from '@lucide/vue';
import { database } from '../../services/session';
import { myLoyalty, type LoyaltyData } from '../../services/vouchers';
const props = withDefaults(defineProps<{active?:boolean}>(),{active:true});
const data=ref<LoyaltyData|null>(null),loading=ref(false),error=ref(false);
const cycleSize = computed(() => Math.max(1, data.value?.tripsPerReward || 5));
const progressTrips = computed(() => (data.value?.completedTrips || 0) % cycleSize.value);
const nextTier = computed(() => data.value?.tiers.find(tier => tier.trips > (data.value?.completedTrips || 0)));
const money = (value: number) => `₱${value.toLocaleString('en-PH')}`;
async function load(){
  if(loading.value)return;
  loading.value=true;error.value=false;
  try{if(!database)throw new Error('Unavailable');data.value=(await myLoyalty(database)).data;}
  catch{error.value=true;}finally{loading.value=false;}
}
watch(()=>props.active,active=>{if(active)void load();},{immediate:true});
const expiry=(at:string)=>new Date(at).toLocaleDateString('en-PH',{timeZone:'Asia/Manila',month:'short',day:'numeric',year:'numeric'});
</script>
<style scoped>
.loyalty-card { margin-top:24px; padding:18px; border:1px solid var(--line); border-radius:18px; background:var(--surface); color:var(--ink); }
.loyalty-heading { display:flex; align-items:center; justify-content:space-between; gap:10px; }
h2 { display:flex; align-items:center; gap:8px; margin:0; font-size:14px; }
.heading-icon { display:grid; place-items:center; width:30px; height:30px; border-radius:9px; background:var(--light-blue); color:var(--ocean); }
.tier-badge { display:inline-flex; align-items:center; gap:5px; padding:6px 9px; border:1px solid var(--line); border-radius:20px; color:var(--muted); font-size:10px; font-weight:600; }
.tier-badge[data-tier="gold"] { color:#b78124; background:#d99e2812; border-color:#d99e2840; }
.tier-badge[data-tier="platinum"] { color:#a18bdd; background:#a18bdd12; border-color:#a18bdd40; }
.reward-overview { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-top:16px; padding:16px; border:1px solid color-mix(in srgb,var(--ocean) 22%,var(--line)); border-radius:14px; background:linear-gradient(120deg,var(--light-blue),var(--surface-soft)); }
.reward-eyebrow { color:var(--ocean); font-size:9px; font-weight:700; letter-spacing:.1em; }
.reward-amount { display:flex; align-items:baseline; gap:7px; margin-top:6px; font-size:32px; line-height:1.1; letter-spacing:-.04em; }
.reward-amount small { color:var(--muted); font-size:14px; font-weight:500; letter-spacing:0; }
.reward-overview p { margin:7px 0 0; color:var(--muted); font-size:10px; line-height:1.6; }
.reward-art { position:relative; display:grid; place-items:center; width:58px; height:58px; flex-shrink:0; border:1px dashed color-mix(in srgb,var(--ocean) 45%,transparent); border-radius:16px; background:color-mix(in srgb,var(--ocean) 10%,transparent); color:var(--ocean); transform:rotate(-8deg); }
.reward-art > svg:last-child { position:absolute; right:-5px; top:-6px; color:#dba838; }
.progress-section { margin:16px 0 18px; }
.progress-heading { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:9px; }
.progress-heading strong { font-size:12px; }.progress-heading > span { color:var(--ocean); font-size:11px; font-weight:700; font-variant-numeric:tabular-nums; }
progress { display:block; appearance:none; width:100%; height:8px; overflow:hidden; border:0; border-radius:10px; background:var(--line); accent-color:var(--ocean); }
progress::-webkit-progress-bar { background:var(--line); border-radius:10px; }progress::-webkit-progress-value { background:linear-gradient(90deg,var(--ocean),#32b7a5); border-radius:10px; }progress::-moz-progress-bar { background:var(--ocean); border-radius:10px; }
.progress-section p { display:flex; align-items:center; flex-wrap:wrap; gap:5px; margin:9px 0 0; color:var(--muted); font-size:10px; line-height:1.6; }.progress-section p > span { margin-left:auto; font-size:9px; }
.voucher-heading { display:flex; align-items:center; justify-content:space-between; gap:8px; margin:0 0 8px; font-size:12px; }.voucher-heading > span { color:var(--success); font-size:10px; }
.reward-ready { display:flex; align-items:center; gap:9px; margin-bottom:9px; padding:12px; border:1px dashed color-mix(in srgb,var(--success) 45%,var(--line)); border-radius:12px; background:var(--success-soft); }
.voucher-icon { color:var(--success); flex-shrink:0; }.reward-ready > div { flex:1; min-width:0; }.reward-ready strong { display:block; font-size:12px; line-height:1.5; }.reward-ready p { margin:4px 0; color:var(--muted); font-size:10px; line-height:1.6; }.reward-ready small { color:var(--muted); font-size:9px; line-height:1.6; }.voucher-check { flex-shrink:0; color:var(--success); }
.milestone-heading { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:10px; }h3 { margin:0; font-size:12px; }.milestone-heading > span { color:var(--muted); font-size:9px; }
.reward-tiers { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:8px; }
.milestone { --tier-color:#829fb8; display:flex; align-items:center; flex-direction:column; gap:5px; min-width:0; padding:12px 5px 9px; border:1px solid var(--line); border-radius:12px; background:var(--surface-soft); }
.milestone[data-tier="gold"] { --tier-color:#d1a13e; }.milestone[data-tier="platinum"] { --tier-color:#a18bdd; }
.milestone.reached { border-color:color-mix(in srgb,var(--tier-color) 65%,var(--line)); background:color-mix(in srgb,var(--tier-color) 7%,var(--surface-soft)); }.milestone.next { border-style:dashed; border-color:color-mix(in srgb,var(--tier-color) 65%,var(--line)); }
.milestone-icon { display:grid; place-items:center; width:32px; height:32px; margin-bottom:3px; border-radius:50%; background:color-mix(in srgb,var(--tier-color) 14%,transparent); color:var(--tier-color); }
.tier-name { font-size:10px; }.milestone > b { font-size:18px; line-height:1.4; }.milestone > small { color:var(--muted); font-size:9px; }
.milestone-state { display:flex; align-items:center; gap:2px; margin-top:4px; color:var(--muted); font-size:8px; }.reached .milestone-state { color:var(--tier-color); }
.reward-rules { margin-top:14px; border-top:1px solid var(--line); padding-top:5px; }.reward-rules summary { display:flex; align-items:center; justify-content:space-between; min-height:44px; color:var(--muted); font-size:10px; cursor:pointer; list-style:none; }.reward-rules summary::-webkit-details-marker { display:none; }.reward-rules[open] summary svg { transform:rotate(180deg); }.reward-rules p { margin:2px 0 0; color:var(--muted); font-size:10px; line-height:1.8; }
.state-message { color:var(--muted); font-size:12px; line-height:1.7; }button { min-height:44px; border:0; background:transparent; color:var(--ocean); cursor:pointer; }button:focus-visible,summary:focus-visible { outline:2px solid var(--ocean); outline-offset:3px; }
@container passenger (max-width:380px) { .loyalty-card { padding:16px 12px; }.reward-overview { padding:14px 12px; }.progress-section p > span { flex-basis:100%; margin:0; }.milestone-heading > span { font-size:8px; } }
</style>
