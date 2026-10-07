<template>
  <section class="voucher-panel">
    <h2>Vouchers</h2><p>Create offers for regular passenger fares. Each account can use a code once. Issued reservations count toward the limit, including cancelled reservations.</p>
    <form class="voucher-form" @submit.prevent="create">
      <label>Code<input v-model.trim="form.code" required pattern="[A-Za-z0-9_\-]{3,30}" maxlength="30" placeholder="SAIL50" /></label>
      <label>Discount type<select v-model="form.discountType"><option value="FIXED">Fixed amount (PHP)</option><option value="PERCENT">Percentage (%)</option></select></label>
      <label>Discount value<input v-model.number="form.value" type="number" min="1" :max="form.discountType==='PERCENT'?99:undefined" step="1" required /></label>
      <label>Minimum booking total (PHP)<input v-model.number="form.minimumSpend" type="number" min="0" step="1" required /></label>
      <label>Total uses allowed<input v-model.number="form.usageLimit" type="number" min="1" step="1" required /></label>
      <label>Starts (Philippine time)<input v-model="form.startsAt" type="datetime-local" required /></label>
      <label>Expires (Philippine time)<input v-model="form.expiresAt" type="datetime-local" :min="form.startsAt" required /></label>
      <button :disabled="busy" type="submit">{{busy?'Saving…':'Create voucher'}}</button>
    </form>
    <p v-if="error" role="alert">{{error}}</p><p v-if="notice" role="status">{{notice}}</p>
    <p v-if="loading">Loading vouchers…</p><button v-if="error" @click="load">Reload vouchers</button>
    <div class="voucher-list"><article v-for="v in vouchers" :key="v.id"><div><strong>{{v.code}}</strong><span>{{v.discountType==='PERCENT'?`${v.value}%`:`PHP ${v.value}`}} off regular fares</span><small>Minimum PHP {{v.minimumSpend}} · {{v.used}} / {{v.usageLimit}} used</small><small>{{date(v.startsAt)}} – {{date(v.expiresAt)}}</small></div><div><b>{{!v.isActive?'Paused':new Date(v.expiresAt).getTime()<=Date.now()?'Expired':new Date(v.startsAt).getTime()>Date.now()?'Scheduled':'Active'}}</b><button :disabled="busy" @click="toggle(v)">{{v.isActive?'Pause':'Activate'}}</button></div></article><p v-if="!loading&&!error&&!vouchers.length">No vouchers yet. Create your first offer above.</p></div>
  </section>
</template>
<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { requireSupabase } from '../../services/supabase';
import { listVouchers, saveVoucher, type Voucher } from '../../services/vouchers';
import { databaseRequestError } from '../../data/databaseErrors';
const vouchers=ref<Voucher[]>([]),busy=ref(false),loading=ref(false),error=ref(''),notice=ref('');
const localNow=new Date(Date.now()+8*3600000).toISOString().slice(0,16);
const form=reactive({code:'',discountType:'FIXED',value:50,minimumSpend:0,usageLimit:100,startsAt:localNow,expiresAt:''});
const date=(value:string)=>new Intl.DateTimeFormat('en-PH',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Manila'}).format(new Date(value));
async function load(){loading.value=true;error.value='';try{vouchers.value=(await listVouchers(requireSupabase())).data.vouchers;}catch(e){error.value=databaseRequestError(e,'Could not load vouchers.');}finally{loading.value=false;}}
async function create(){busy.value=true;error.value='';notice.value='';try{await saveVoucher(requireSupabase(),{...form,startsAt:new Date(`${form.startsAt}+08:00`).toISOString(),expiresAt:new Date(`${form.expiresAt}+08:00`).toISOString(),isActive:true});form.code='';notice.value='Voucher created.';await load();}catch(e){error.value=databaseRequestError(e,'Could not save voucher. Check code, amount, and dates.');}finally{busy.value=false;}}
async function toggle(v:Voucher){busy.value=true;error.value='';try{await saveVoucher(requireSupabase(),{id:v.id,isActive:!v.isActive});await load();}catch(e){error.value=databaseRequestError(e,'Could not update voucher.');}finally{busy.value=false;}}
onMounted(load);
</script>
<style scoped>
.voucher-panel{padding:24px;border:1px solid var(--line);border-radius:16px;background:var(--surface);color:var(--ink)}
h2{margin-top:0}p,small{color:var(--muted);line-height:1.6}.voucher-form{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin:24px 0}label{display:grid;gap:8px;font-size:12px}input,select,button{min-height:44px;border:1px solid var(--line);border-radius:9px;padding:10px;background:var(--surface);color:var(--ink);font:inherit;width:100%;box-sizing:border-box}button{cursor:pointer;color:var(--ocean);font-weight:600}button:disabled{opacity:.5;cursor:wait}.voucher-list article{display:flex;justify-content:space-between;gap:20px;padding:18px 0;border-top:1px solid var(--line)}article div{display:grid;gap:8px}article strong{font-size:18px}article span,article b{font-size:13px}article button{min-width:100px}input:focus-visible,select:focus-visible,button:focus-visible{outline:2px solid var(--ocean);outline-offset:2px}@media(max-width:700px){.voucher-form{grid-template-columns:1fr}.voucher-panel{padding:16px}.voucher-list article{flex-wrap:wrap}}
</style>
