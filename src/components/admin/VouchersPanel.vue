<template>
  <section class="admin-vouchers voucher-panel">
    <div class="voucher-summary" aria-label="Voucher counts">
      <article v-for="metric in metrics" :key="metric.label">
        <span :class="['metric-icon', metric.tone]"><AppIcon :icon="metric.icon" aria-hidden="true" /></span>
        <div><small>{{ metric.label }}</small><strong>{{ loading ? '—' : metric.value }}</strong></div>
      </article>
    </div>

    <p v-if="error" class="message error" role="alert">{{ error }} <button :disabled="loading || busy" @click="load">Reload vouchers</button></p>
    <p v-if="notice" class="message success" role="status">{{ notice }}</p>

    <section class="voucher-directory" aria-labelledby="voucher-directory-title">
      <div class="directory-heading">
        <div><p class="eyebrow">PROMO MANAGEMENT</p><h2 id="voucher-directory-title">Voucher directory</h2><p>Promo details, optional missions, claim limits and validity.</p></div>
        <button data-slot="button" data-variant="default" data-size="default" class="primary create-voucher" :disabled="busy" @click="openCreate"><AppIcon :icon="addOutline" aria-hidden="true" /> Create voucher</button>
      </div>
      <div class="directory-tools">
        <label class="search-field"><AppIcon :icon="searchOutline" aria-hidden="true" /><input v-model="search" type="search" placeholder="Search code or promo name…" aria-label="Search code or promo name" /></label>
        <select v-model="statusFilter" aria-label="Filter vouchers by status">
          <option value="ALL">All statuses</option><option v-for="status in statuses" :key="status" :value="status">{{ statusLabel(status) }}</option>
        </select>
        <button class="reset-filters" :disabled="!search && statusFilter === 'ALL'" @click="resetFilters">Reset filters</button>
        <small class="result-count">{{ filteredVouchers.length }} of {{ vouchers.length }} vouchers</small>
      </div>
      <p v-if="loading" class="empty-state" role="status">Loading vouchers…</p>
      <div v-else-if="filteredVouchers.length" class="table-wrap">
        <table>
          <colgroup><col class="col-voucher" /><col class="col-offer" /><col class="col-mission" /><col class="col-claims" /><col class="col-validity" /><col class="col-actions" /></colgroup>
          <thead><tr><th scope="col">Voucher</th><th scope="col">Discount</th><th scope="col">Mission</th><th scope="col">Claims &amp; uses</th><th scope="col">Validity &middot; PH</th><th scope="col" class="action-heading">Actions</th></tr></thead>
          <tbody>
            <tr v-for="voucher in filteredVouchers" :key="voucher.id">
              <td data-label="Voucher" class="voucher-identity"><div><strong class="promo-title">{{ voucher.ownerUid ? 'Personal loyalty reward' : voucher.title || 'Travel promo' }}</strong><small class="voucher-code">{{ voucher.code }}</small>              <span :class="['status-badge', voucherStatus(voucher).toLowerCase()]">{{ voucher.claimable && (voucher.claimed || 0) >= voucher.usageLimit && voucher.used < voucher.usageLimit && voucherStatus(voucher) === "EXHAUSTED" ? "Fully claimed" : statusLabel(voucherStatus(voucher)) }}</span></div></td>
              <td data-label="Discount"><div><strong>{{ voucher.discountType === 'PERCENT' ? `${voucher.value}%` : money(voucher.value) }} off</strong><small>Min. {{ money(voucher.minimumSpend) }}</small></div></td>
              <td data-label="Mission"><div><strong>{{ voucher.ownerUid ? "Loyalty reward" : voucher.requiredTrips ? `Complete ${voucher.requiredTrips} trip${voucher.requiredTrips === 1 ? "" : "s"}` : "No mission" }}</strong><small>{{ voucher.ownerUid ? "Earned automatically" : voucher.claimable ? "Claim in app" : "Code entry only" }}</small></div></td>
              <td data-label="Claims &amp; uses"><div class="usage"><span><strong>{{ allocated(voucher) }}</strong> / {{ voucher.usageLimit }} <small class="slots-label">{{ voucher.claimable ? "slots" : "uses" }}</small></span><div class="usage-track" role="meter" :aria-label="`Allocated slots for ${voucher.code}`" :aria-valuenow="allocated(voucher)" :aria-valuemin="0" :aria-valuemax="voucher.usageLimit"><span :style="{ width: usagePercent(voucher) + '%' }" /></div><small v-if="voucher.claimable">{{ voucher.used }} used &middot; {{ voucher.claimed || 0 }} claimed</small></div></td>
              <td data-label="Validity"><div><small class="validity-date">{{ date(voucher.startsAt) }}</small><small>Until {{ date(voucher.expiresAt) }}</small></div></td>

              <td data-label="Actions" class="action-cell"><div class="row-actions"><button v-if="!voucher.ownerUid" :disabled="busy || loading" :aria-label="`Edit details for ${voucher.code}`" @click="openDetails(voucher)">Edit details</button><button :disabled="busy || loading" :aria-label="`${voucher.isActive ? 'Pause' : 'Activate'} voucher ${voucher.code}`" @click="toggle(voucher)"><AppIcon :icon="voucher.isActive ? pauseOutline : playOutline" aria-hidden="true" />{{ pendingId === voucher.id ? 'Saving…' : voucher.isActive ? 'Pause' : 'Activate' }}</button></div></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="empty-state"><AppIcon :icon="search || statusFilter !== 'ALL' ? searchOutline : giftOutline" aria-hidden="true" /><h3>{{ vouchers.length ? 'No matching vouchers' : 'No vouchers yet' }}</h3><p>{{ vouchers.length ? 'Try another code or reset your filters.' : 'Create an offer to add your first promo code.' }}</p><button v-if="search || statusFilter !== 'ALL'" @click="resetFilters">Clear filters</button></div>
      <p class="directory-note">Each account can use a code once. Claims reserve slots for listed promos. Issued reservations count toward the usage limit, including cancelled reservations.</p>
    </section>

    <details class="loyalty-info">
      <summary><span><AppIcon :icon="ribbonOutline" aria-hidden="true" /> Automatic loyalty rewards</span><small>Rules & milestones</small></summary>
      <div class="loyalty-body">
        <p v-if="loyaltyLoading" role="status">Loading saved milestones…</p>
        <p v-if="loyaltyError" class="message error" role="alert">{{ loyaltyError }}<button :disabled="loyaltyLoading || loyaltySaving" @click="loadLoyalty">Retry</button></p>
        <template v-if="loyaltySettings">
          <div class="loyalty-tiers"><article v-for="tier in loyaltyTiers" :key="tier.name"><small>{{ tier.name }}</small><strong>{{ money(tier.value) }}</strong><span>{{ tier.trips }} completed trips</span></article></div>
          <p>After {{ loyaltySettings.tripsPerReward * 3 }} trips, earn {{ money(loyaltySettings.platinumReward) }} every {{ loyaltySettings.tripsPerReward }} more trips. Rewards expire after {{ loyaltySettings.expiryDays }} days. Counted sailings must be paid and have a boarded passenger.</p>
          <details class="loyalty-editor"><summary>Edit reward settings</summary>
            <form @submit.prevent="saveLoyalty"><fieldset :disabled="loyaltySaving || loyaltyLoading" class="loyalty-fields">
              <label>Trips per milestone<input v-model.number="loyaltyDraft.tripsPerReward" type="number" min="1" max="1000" step="1" required /><small>Silver at {{ loyaltyDraft.tripsPerReward }}, Gold at {{ loyaltyDraft.tripsPerReward * 2 }}, Platinum at {{ loyaltyDraft.tripsPerReward * 3 }} trips.</small></label>
              <label>Reward validity (days)<input v-model.number="loyaltyDraft.expiryDays" type="number" min="1" max="3650" step="1" required /></label>
              <label>Silver reward (PHP)<input v-model.number="loyaltyDraft.silverReward" type="number" min="1" max="1000000" step="1" required /></label>
              <label>Gold reward (PHP)<input v-model.number="loyaltyDraft.goldReward" type="number" :min="loyaltyDraft.silverReward" max="1000000" step="1" required /></label>
              <label>Platinum reward (PHP)<input v-model.number="loyaltyDraft.platinumReward" type="number" :min="loyaltyDraft.goldReward" max="1000000" step="1" required /></label>
            </fieldset><div class="loyalty-save"><p>Newly issued rewards use these settings. Existing vouchers keep their saved amounts and expiry dates.</p><button data-slot="button" data-variant="default" data-size="default" class="primary" :disabled="loyaltySaving || !loyaltyDirty" type="submit">{{ loyaltySaving ? 'Saving…' : 'Save milestones' }}</button></div></form>
          </details>
          <p v-if="loyaltyNotice" role="status" class="loyalty-notice">{{ loyaltyNotice }}</p>
        </template>
      </div>
    </details>

    <IonModal class="admin-vouchers voucher-modal" :is-open="!!selectedVoucher" :backdrop-dismiss="!detailsBusy" @didDismiss="selectedVoucher = null">
      <form class="voucher-dialog" @submit.prevent="saveDetails">
        <header class="modal-heading"><span class="modal-icon"><AppIcon :icon="giftOutline" aria-hidden="true" /></span><div><p class="eyebrow">PROMO SETTINGS</p><h2>Edit voucher details</h2><p>{{ selectedVoucher?.code }}</p></div><button type="button" class="close-button" aria-label="Close voucher details" :disabled="detailsBusy" @click="selectedVoucher = null"><AppIcon :icon="closeOutline" /></button></header>
        <div class="form-scroll"><p v-if="detailsError" class="message error" role="alert">{{ detailsError }}</p><fieldset class="voucher-form" :disabled="detailsBusy"><div class="form-grid">
          <label>Promo name<input v-model.trim="details.title" minlength="3" maxlength="120" required /></label>
          <label>Claim limit<input v-model.number="details.usageLimit" type="number" :min="detailsMinimum" max="2147483647" step="1" required /><small>{{ detailsMinimum }} minimum to cover existing claims and uses.</small></label>
          <label class="promo-description-field">Promo description<textarea v-model.trim="details.description" maxlength="1000" rows="3" /></label>
          <label>Mission<select v-model="details.mission" :disabled="detailsLocked || !selectedVoucher?.claimable"><option value="NONE">No mission - direct claim</option><option value="TRIPS">Complete trips</option></select><small v-if="detailsLocked">Mission locked: this promo already has claims or uses.</small><small v-else-if="!selectedVoucher?.claimable">This promo uses code entry rather than the claim page.</small></label>
          <label v-if="details.mission === 'TRIPS'">Completed trips required<input v-model.number="details.requiredTrips" :disabled="detailsLocked" type="number" min="1" max="1000" step="1" required /><small>Completed, paid sailings with a boarded passenger. Existing completed trips count.</small></label>
        </div></fieldset><p class="form-note">Discount amounts, codes and validity dates retain their original terms.</p></div>
        <footer class="form-footer"><button type="button" :disabled="detailsBusy" @click="selectedVoucher = null">Cancel</button><button data-slot="button" data-variant="default" data-size="default" class="primary" :disabled="detailsBusy" type="submit">{{ detailsBusy ? 'Saving...' : 'Save details' }}</button></footer>
      </form>
    </IonModal>
    <IonModal class="admin-vouchers voucher-modal" :is-open="showCreate" :backdrop-dismiss="!busy" @didDismiss="showCreate = false">
      <form class="voucher-dialog" @submit.prevent="create">
        <header class="modal-heading"><span class="modal-icon"><AppIcon :icon="giftOutline" aria-hidden="true" /></span><div><p class="eyebrow">NEW OFFER</p><h2>Create a voucher</h2><p>Set the discount, usage limit and availability.</p></div><button type="button" class="close-button" :disabled="busy" aria-label="Close voucher form" @click="showCreate = false"><AppIcon :icon="closeOutline" aria-hidden="true" /></button></header>
        <div class="form-scroll">
          <p v-if="formError" class="message error" role="alert">{{ formError }}</p>
          <fieldset :disabled="busy" class="voucher-form">
            <section class="form-section"><h3><span class="form-step">1</span> Promo details</h3><div class="form-grid">
              <label class="claim-setting full-field"><span><input v-model="form.claimable" type="checkbox" /> Show on the passenger Claim vouchers page</span><small>Passengers can discover this promo and claim an available slot.</small></label>
              <label v-if="form.claimable">Promo name<input v-model.trim="form.title" minlength="3" maxlength="120" required placeholder="e.g. Weekend sailing treat" /></label>
              <label :class="{ 'full-field': !form.claimable }">Voucher code<input v-model.trim="form.code" readonly aria-label="Voucher code" required pattern="[A-Za-z0-9_\-]{3,30}" maxlength="30" /><small>Generated automatically.</small></label>
              <label v-if="form.claimable" class="full-field">Promo description<textarea v-model.trim="form.description" maxlength="1000" rows="2" placeholder="Describe the offer passengers will see." /></label>
            </div></section>
            <section class="form-section"><h3><span class="form-step">2</span> Discount &amp; limit</h3><div class="form-grid">
              <label>Discount type<select v-model="form.discountType"><option value="FIXED">Fixed amount (PHP)</option><option value="PERCENT">Percentage (%)</option></select></label>
              <label>{{ form.discountType === 'PERCENT' ? 'Discount (%)' : 'Discount amount (PHP)' }}<input v-model.number="form.value" type="number" min="1" :max="form.discountType === 'PERCENT' ? 99 : undefined" step="1" required /></label>
              <label>Minimum booking total (PHP)<input v-model.number="form.minimumSpend" type="number" min="0" step="1" required /></label>
              <label>{{ form.claimable ? "Total claim slots" : "Total uses allowed" }}<input v-model.number="form.usageLimit" type="number" min="1" step="1" required /><small>{{ form.claimable ? "Each claim reserves one slot." : "Maximum reservations using this code." }}</small></label>
            </div></section>
            <section class="form-section"><h3><span class="form-step">3</span> Mission &amp; availability</h3><div class="form-grid">
              <template v-if="form.claimable"><label :class="{ 'full-field': form.mission === 'NONE' }">Mission<select v-model="form.mission"><option value="NONE">No mission - direct claim</option><option value="TRIPS">Complete trips</option></select><small v-if="form.mission === 'NONE'">Passengers can claim immediately while slots are available.</small></label><label v-if="form.mission === 'TRIPS'">Completed trips required<input v-model.number="form.requiredTrips" type="number" min="1" max="1000" step="1" required /><small>Paid sailings with a boarded passenger. Previous trips count.</small></label></template>
              <label>Starts (Philippine time)<input v-model="form.startsAt" type="datetime-local" required /></label>
              <label>Expires (Philippine time)<input v-model="form.expiresAt" type="datetime-local" :min="form.startsAt" required /></label>
            </div></section>
          </fieldset>
        </div>
        <footer class="form-footer"><span class="offer-preview">{{ form.discountType === 'PERCENT' ? `${form.value}%` : money(form.value || 0) }} off regular fares</span><button type="button" :disabled="busy" @click="showCreate = false">Cancel</button><button data-slot="button" data-variant="default" data-size="default" class="primary" :disabled="busy" type="submit">{{ busy ? 'Saving…' : 'Create voucher' }}</button></footer>
      </form>
    </IonModal>
  </section>
</template>
<script setup lang="ts">
import { notifyError, notifySuccess } from '@/composables/toast';
import { voucherCode } from '../../data/recordCodes';
import { activeFirst } from '../../data/statusOrder';
import '../../theme/admin-vouchers.css';
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { IonModal } from '@ionic/vue';
import AppIcon from "@/components/ui/icon/AppIcon.vue";
import { addOutline, searchOutline, giftOutline, ribbonOutline, pauseOutline, playOutline, closeOutline, checkmarkCircleOutline, timeOutline } from 'ionicons/icons';
import { requireSupabase } from '../../services/supabase';
import { listVouchers, saveVoucher, updateVoucherDetails, adminLoyaltySettings, saveLoyaltySettings, type LoyaltySettings, type Voucher } from '../../services/vouchers';
import { databaseRequestError } from '../../data/databaseErrors';

const vouchers = ref<Voucher[]>([]), busy = ref(false), loading = ref(false), error = ref(''), notice = ref('');
const showCreate = ref(false), formError = ref(''), pendingId = ref(''), search = ref(''), statusFilter = ref('ALL');
const now = ref(Date.now());
const loyaltySettings = ref<LoyaltySettings | null>(null), loyaltyLoading = ref(false), loyaltySaving = ref(false), loyaltyError = ref(''), loyaltyNotice = ref('');
const loyaltyDraft = reactive<LoyaltySettings>({ tripsPerReward: 0, silverReward: 0, goldReward: 0, platinumReward: 0, expiryDays: 0 });
const loyaltyTiers = computed(() => loyaltySettings.value ? [
  { name: 'Silver', trips: loyaltySettings.value.tripsPerReward, value: loyaltySettings.value.silverReward },
  { name: 'Gold', trips: loyaltySettings.value.tripsPerReward * 2, value: loyaltySettings.value.goldReward },
  { name: 'Platinum', trips: loyaltySettings.value.tripsPerReward * 3, value: loyaltySettings.value.platinumReward },
] : []);
const loyaltyDirty = computed(() => !!loyaltySettings.value && Object.keys(loyaltyDraft).some(key => loyaltyDraft[key as keyof LoyaltySettings] !== loyaltySettings.value![key as keyof LoyaltySettings]));
async function loadLoyalty() {
  if (loyaltyLoading.value || loyaltySaving.value) return;
  loyaltyLoading.value = true; loyaltyError.value = '';
  try { loyaltySettings.value = (await adminLoyaltySettings(requireSupabase())).data.settings; Object.assign(loyaltyDraft, loyaltySettings.value); }
  catch (cause) { loyaltyError.value = databaseRequestError(cause, 'Could not load loyalty settings.'); }
  finally { loyaltyLoading.value = false; }
}
async function saveLoyalty() {
  if (loyaltySaving.value || !loyaltyDirty.value) return;
  loyaltyError.value = ''; loyaltyNotice.value = '';
  if (!Object.values(loyaltyDraft).every(value => Number.isInteger(value) && value > 0) || loyaltyDraft.tripsPerReward > 1000 || loyaltyDraft.expiryDays > 3650 || loyaltyDraft.platinumReward > 1000000 || loyaltyDraft.goldReward < loyaltyDraft.silverReward || loyaltyDraft.platinumReward < loyaltyDraft.goldReward) {
    loyaltyError.value = 'Use positive whole numbers and increasing reward amounts within the field limits.'; return;
  }
  loyaltySaving.value = true;
  try { loyaltySettings.value = (await saveLoyaltySettings(requireSupabase(), { ...loyaltyDraft })).data.settings; Object.assign(loyaltyDraft, loyaltySettings.value); notifySuccess('Loyalty milestones saved.'); }
  catch (cause) { notifyError(databaseRequestError(cause, 'Could not save loyalty settings.')); }
  finally { loyaltySaving.value = false; }
}
let clock: ReturnType<typeof setInterval> | undefined;
const statuses = ['ACTIVE', 'SCHEDULED', 'PAUSED', 'EXPIRED', 'EXHAUSTED'] as const;
function voucherStatus(voucher: Voucher) {
  if (!voucher.isActive) return 'PAUSED';
  if (Date.parse(voucher.expiresAt) <= now.value) return 'EXPIRED';
  if (allocated(voucher) >= voucher.usageLimit) return 'EXHAUSTED';
  if (Date.parse(voucher.startsAt) > now.value) return 'SCHEDULED';
  return 'ACTIVE';
}
const statusLabel = (status: string) => ({ ACTIVE: 'Active', SCHEDULED: 'Scheduled', PAUSED: 'Paused', EXPIRED: 'Expired', EXHAUSTED: 'Fully used' }[status] || status);
const filteredVouchers = computed(() => activeFirst(vouchers.value.filter(v => [v.code,v.title || '',v.description || ''].join(' ').toLowerCase().includes(search.value.trim().toLowerCase()) && (statusFilter.value === 'ALL' || voucherStatus(v) === statusFilter.value)), v => !['ACTIVE', 'SCHEDULED'].includes(voucherStatus(v))));
const metrics = computed(() => [
  { label: 'Total vouchers', value: vouchers.value.length, icon: giftOutline, tone: 'blue' },
  { label: 'Active offers', value: vouchers.value.filter(v => voucherStatus(v) === 'ACTIVE').length, icon: checkmarkCircleOutline, tone: 'green' },
  { label: 'Scheduled', value: vouchers.value.filter(v => voucherStatus(v) === 'SCHEDULED').length, icon: timeOutline, tone: 'purple' },
  { label: 'Recorded uses', value: vouchers.value.reduce((sum, v) => sum + v.used, 0), icon: ribbonOutline, tone: 'blue' },
]);
const money = (value: number) => `PHP ${value.toLocaleString('en-PH')}`;
const allocated = (v: Voucher) => v.claimable ? (v.claimed || 0) : v.used;
const usagePercent = (v: Voucher) => Math.min(100, Math.max(0, v.usageLimit ? allocated(v) / v.usageLimit * 100 : 0));
const localNow = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 16);
const form = reactive({ code: '', discountType: 'FIXED', value: 50, minimumSpend: 0, usageLimit: 100, startsAt: localNow, expiresAt: '', claimable: true, title: 'Travel promo', description: '', mission: 'NONE', requiredTrips: 1 });
const date = (value: string) => new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' }).format(new Date(value));
function resetFilters() { search.value = ''; statusFilter.value = 'ALL'; }
function openCreate() { formError.value = ''; if (!form.code) form.code = voucherCode(); showCreate.value = true; }
async function load() {
  if (loading.value) return;
  loading.value = true; error.value = '';
  try { vouchers.value = (await listVouchers(requireSupabase())).data.vouchers; now.value = Date.now(); }
  catch (cause) { error.value = databaseRequestError(cause, 'Could not load vouchers.'); }
  finally { loading.value = false; }
}
async function create() {
  if (busy.value) return;
  formError.value = ''; notice.value = '';
  const startsAt = new Date(`${form.startsAt}+08:00`).getTime();
  const expiresAt = new Date(`${form.expiresAt}+08:00`).getTime();
  if (!Number.isFinite(startsAt) || !Number.isFinite(expiresAt) || expiresAt <= startsAt) {
    formError.value = 'Expiry must be later than the start date.'; return;
  }
  if (form.claimable && (form.title.trim().length < 3 || form.title.length > 120 || form.description.length > 1000 || (form.mission === 'TRIPS' && (!Number.isInteger(form.requiredTrips) || form.requiredTrips < 1 || form.requiredTrips > 1000)))) {
    formError.value = 'Enter a promo name and a valid completed-trip mission.'; return;
  }
  busy.value = true;
  try {
    await saveVoucher(requireSupabase(), { ...form, title: form.claimable ? form.title : "Travel promo", requiredTrips: form.claimable && form.mission === "TRIPS" ? form.requiredTrips : 0, startsAt: new Date(startsAt).toISOString(), expiresAt: new Date(expiresAt).toISOString(), isActive: true });
    form.code = ''; form.title = 'Travel promo'; form.description = ''; form.claimable = true; form.mission = 'NONE'; form.requiredTrips = 1; showCreate.value = false; notifySuccess('Voucher created.'); resetFilters(); await load();
  } catch (cause) { notifyError(databaseRequestError(cause, 'Could not save voucher. Check code, amount, and dates.')); }
  finally { busy.value = false; }
}
const selectedVoucher = ref<Voucher|null>(null), detailsBusy = ref(false), detailsError = ref('');
const details = reactive({title:'',description:'',mission:'NONE',requiredTrips:1,usageLimit:1});
const detailsMinimum = computed(() => Math.max(1, selectedVoucher.value ? allocated(selectedVoucher.value) : 0));
const detailsLocked = computed(() => !!selectedVoucher.value && allocated(selectedVoucher.value)>0);
function openDetails(v:Voucher) {
  selectedVoucher.value=v; detailsError.value='';
  Object.assign(details,{title:v.title || 'Travel promo',description:v.description || '',mission:v.requiredTrips ? 'TRIPS' : 'NONE',requiredTrips:v.requiredTrips || 1,usageLimit:v.usageLimit});
}
async function saveDetails() {
  const selected=selectedVoucher.value;if (!selected || detailsBusy.value) return;
  detailsError.value='';
  const requiredTrips=details.mission==='TRIPS' ? details.requiredTrips : 0;
  if(details.title.trim().length<3 || details.title.length>120 || details.description.length>1000 || !Number.isSafeInteger(details.usageLimit) || details.usageLimit<detailsMinimum.value || details.usageLimit>2147483647 || !Number.isInteger(requiredTrips) || requiredTrips<0 || requiredTrips>1000 || (details.mission==='TRIPS' && requiredTrips<1)) {
    detailsError.value='Enter a promo name, valid mission and a limit that covers existing claims and uses.';return;
  }
  detailsBusy.value=true;
  try {await updateVoucherDetails(requireSupabase(),{id:selected.id,title:details.title,description:details.description,requiredTrips,usageLimit:details.usageLimit});selectedVoucher.value=null;notifySuccess('Voucher details updated.');await load();}
  catch(cause){notifyError(databaseRequestError(cause,'Could not update voucher details.'));}
  finally{detailsBusy.value=false;}
}
async function toggle(voucher: Voucher) {
  if (busy.value) return;
  busy.value = true; pendingId.value = voucher.id; error.value = ''; notice.value = '';
  try { await saveVoucher(requireSupabase(), { id: voucher.id, isActive: !voucher.isActive }); notifySuccess(`${voucher.code} ${voucher.isActive ? 'paused' : 'activated'}.`); await load(); }
  catch (cause) { notifyError(databaseRequestError(cause, 'Could not update voucher.')); }
  finally { busy.value = false; pendingId.value = ''; }
}
onMounted(() => { void load(); void loadLoyalty(); clock = setInterval(() => { now.value = Date.now(); }, 60000); });
onBeforeUnmount(() => { clearInterval(clock); });
</script>
