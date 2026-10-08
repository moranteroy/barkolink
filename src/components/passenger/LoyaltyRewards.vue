<template>
  <section class="loyalty-card" aria-labelledby="loyalty-heading">
    <div class="loyalty-heading"><h2 id="loyalty-heading"><IonIcon :icon="giftOutline" aria-hidden="true" /> Loyalty rewards</h2><span v-if="data?.vouchers.length">{{ data.vouchers.length }} ready</span></div>
    <p v-if="loading && !data" role="status">Checking your rewards…</p>
    <p v-else-if="error" role="status">Could not load your rewards. <button @click="load">Try again</button></p>
    <template v-else-if="data">
      <p class="tier-label">{{ data.currentTier }} · Rewards grow with your journeys</p>
      <div v-for="(voucher,index) in data.vouchers" :key="voucher.code" class="reward-ready"><strong>₱{{ voucher.value }} {{ index === 0 ? 'off your next eligible booking' : 'reward ready' }}</strong><p v-if="index === 0">Your voucher applies automatically at review.</p><small>Valid until {{ expiry(voucher.expiresAt) }} · Regular fares only</small></div>
      <div class="reward-tiers" aria-label="Loyalty reward milestones"><div v-for="tier in data.tiers" :key="tier.name" :class="{ reached:data.completedTrips>=tier.trips }"><small>{{ tier.name }}</small><strong>₱{{ tier.value }}</strong><span>{{ tier.trips }} trips</span></div></div>
      <p v-if="!data.vouchers.length">Your next reward: ₱{{ data.rewardValue }} off regular fares.</p>
      <div class="loyalty-progress"><span>{{ data.completedTrips }} completed trip{{ data.completedTrips === 1 ? '' : 's' }}</span><span>{{ data.tripsToNextReward }} more for ₱{{ data.rewardValue }} off</span></div>
      <progress :value="data.completedTrips % data.tripsPerReward" :max="data.tripsPerReward" aria-label="Trips toward your next loyalty voucher" />
      <small>Counted once per sailing, after boarding and trip completion.</small>
      <small>After 15 trips, earn ₱300 every 5 more trips.</small>
    </template>
  </section>
</template>
<script setup lang="ts">
import { ref, watch } from 'vue';
import { IonIcon } from '@ionic/vue';
import { giftOutline } from 'ionicons/icons';
import { database } from '../../services/session';
import { myLoyalty, type LoyaltyData } from '../../services/vouchers';
const props = withDefaults(defineProps<{active?:boolean}>(),{active:true});
const data=ref<LoyaltyData|null>(null),loading=ref(false),error=ref(false);
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
.loyalty-card{margin-top:24px;padding:18px;border:1px solid var(--line);border-radius:16px;background:var(--surface);color:var(--ink)}
.loyalty-heading{display:flex;align-items:center;justify-content:space-between;gap:10px}h2{display:flex;gap:8px;align-items:center;margin:0;font-size:14px}h2 ion-icon{color:var(--ocean);font-size:18px}.loyalty-heading>span{padding:5px 8px;border-radius:6px;background:var(--light-blue);color:var(--ocean);font-size:10px}
.tier-label{font-size:11px}.reward-tiers{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:14px 0}.reward-tiers>div{display:grid;gap:6px;text-align:center;padding:12px 5px;border:1px solid var(--line);border-radius:10px;background:var(--surface-soft)}.reward-tiers strong{font-size:20px}.reward-tiers span{font-size:10px;color:var(--muted)}.reward-tiers .reached{border-color:var(--ocean);background:var(--light-blue)}.reward-tiers .reached strong{color:var(--ocean)}
p{color:var(--muted);font-size:12px;line-height:1.6}small{display:block;color:var(--muted);font-size:10px;line-height:1.6}.reward-ready{margin:14px 0;padding:12px;border-radius:10px;background:var(--light-blue)}.reward-ready strong{color:var(--ocean);font-size:14px}.reward-ready p{margin:6px 0}.loyalty-progress{display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px;margin:14px 0 8px;font-size:10px;color:var(--muted)}progress{width:100%;height:8px;accent-color:var(--ocean);margin-bottom:8px}button{min-height:44px;border:0;background:transparent;color:var(--ocean);cursor:pointer}button:focus-visible{outline:2px solid var(--ocean);outline-offset:2px}
</style>
