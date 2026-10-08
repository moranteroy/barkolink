<template>
  <section class="admin-vouchers voucher-panel">
    <div class="voucher-summary" aria-label="Voucher counts">
      <article v-for="metric in metrics" :key="metric.label">
        <span :class="['metric-icon', metric.tone]"><IonIcon :icon="metric.icon" aria-hidden="true" /></span>
        <div><small>{{ metric.label }}</small><strong>{{ loading ? '—' : metric.value }}</strong></div>
      </article>
    </div>

    <p v-if="error" class="message error" role="alert">{{ error }} <button :disabled="loading || busy" @click="load">Reload vouchers</button></p>
    <p v-if="notice" class="message success" role="status">{{ notice }}</p>

    <section class="voucher-directory" aria-labelledby="voucher-directory-title">
      <div class="directory-heading">
        <div><p class="eyebrow">PROMO MANAGEMENT</p><h2 id="voucher-directory-title">Voucher directory</h2><p>Regular fare offers, usage limits and validity.</p></div>
        <button class="primary create-voucher" :disabled="busy" @click="openCreate"><IonIcon :icon="addOutline" aria-hidden="true" /> Create voucher</button>
      </div>
      <div class="directory-tools">
        <label class="search-field"><IonIcon :icon="searchOutline" aria-hidden="true" /><input v-model="search" type="search" placeholder="Search voucher code…" aria-label="Search voucher code" /></label>
        <select v-model="statusFilter" aria-label="Filter vouchers by status">
          <option value="ALL">All statuses</option><option v-for="status in statuses" :key="status" :value="status">{{ statusLabel(status) }}</option>
        </select>
        <button class="reset-filters" :disabled="!search && statusFilter === 'ALL'" @click="resetFilters">Reset filters</button>
        <small class="result-count">{{ filteredVouchers.length }} of {{ vouchers.length }} vouchers</small>
      </div>
      <p v-if="loading" class="empty-state" role="status">Loading vouchers…</p>
      <div v-else-if="filteredVouchers.length" class="table-wrap">
        <table>
          <thead><tr><th>Voucher code</th><th>Offer</th><th>Usage</th><th>Validity · PH time</th><th>Status</th><th class="action-heading">Action</th></tr></thead>
          <tbody>
            <tr v-for="voucher in filteredVouchers" :key="voucher.id">
              <td data-label="Voucher code"><strong class="voucher-code">{{ voucher.code }}</strong></td>
              <td data-label="Offer"><div><strong>{{ voucher.discountType === 'PERCENT' ? `${voucher.value}%` : money(voucher.value) }} off</strong><small>Min. {{ money(voucher.minimumSpend) }}</small></div></td>
              <td data-label="Usage"><div class="usage"><span><strong>{{ voucher.used }}</strong> / {{ voucher.usageLimit }}</span><div class="usage-track" role="meter" :aria-label="`Uses for ${voucher.code}`" :aria-valuenow="voucher.used" :aria-valuemin="0" :aria-valuemax="voucher.usageLimit"><span :style="{ width: usagePercent(voucher) + '%' }" /></div></div></td>
              <td data-label="Validity"><div><small class="validity-date">{{ date(voucher.startsAt) }}</small><small>Until {{ date(voucher.expiresAt) }}</small></div></td>
              <td data-label="Status"><span :class="['status-badge', voucherStatus(voucher).toLowerCase()]">{{ statusLabel(voucherStatus(voucher)) }}</span></td>
              <td data-label="Action" class="action-cell"><button :disabled="busy || loading" :aria-label="`${voucher.isActive ? 'Pause' : 'Activate'} voucher ${voucher.code}`" @click="toggle(voucher)"><IonIcon :icon="voucher.isActive ? pauseOutline : playOutline" aria-hidden="true" />{{ pendingId === voucher.id ? 'Saving…' : voucher.isActive ? 'Pause' : 'Activate' }}</button></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="empty-state"><IonIcon :icon="search || statusFilter !== 'ALL' ? searchOutline : ticketOutline" aria-hidden="true" /><h3>{{ vouchers.length ? 'No matching vouchers' : 'No vouchers yet' }}</h3><p>{{ vouchers.length ? 'Try another code or reset your filters.' : 'Create an offer to add your first promo code.' }}</p><button v-if="search || statusFilter !== 'ALL'" @click="resetFilters">Clear filters</button></div>
      <p class="directory-note">Each account can use a code once. Issued reservations count toward the usage limit, including cancelled reservations.</p>
    </section>

    <details class="loyalty-info">
      <summary><span><IonIcon :icon="ribbonOutline" aria-hidden="true" /> Automatic loyalty rewards</span><small>Rules & milestones</small></summary>
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
            </fieldset><div class="loyalty-save"><p>Newly issued rewards use these settings. Existing vouchers keep their saved amounts and expiry dates.</p><button class="primary" :disabled="loyaltySaving || !loyaltyDirty" type="submit">{{ loyaltySaving ? 'Saving…' : 'Save milestones' }}</button></div></form>
          </details>
          <p v-if="loyaltyNotice" role="status" class="loyalty-notice">{{ loyaltyNotice }}</p>
        </template>
      </div>
    </details>

    <IonModal class="admin-vouchers voucher-modal" :is-open="showCreate" :backdrop-dismiss="!busy" @didDismiss="showCreate = false">
      <form class="voucher-dialog" @submit.prevent="create">
        <header class="modal-heading"><span class="modal-icon"><IonIcon :icon="ticketOutline" aria-hidden="true" /></span><div><p class="eyebrow">NEW OFFER</p><h2>Create a voucher</h2><p>Set the discount, usage limit and availability.</p></div><button type="button" class="close-button" :disabled="busy" aria-label="Close voucher form" @click="showCreate = false"><IonIcon :icon="closeOutline" aria-hidden="true" /></button></header>
        <div class="form-scroll">
          <p v-if="formError" class="message error" role="alert">{{ formError }}</p>
          <fieldset :disabled="busy" class="voucher-form">
            <section class="form-section"><h3><span class="form-step">1</span> Offer details</h3><div class="form-grid">
              <label>Code<input v-model.trim="form.code" required pattern="[A-Za-z0-9_\-]{3,30}" maxlength="30" placeholder="SAIL50" /><small>3–30 letters, numbers, hyphens or underscores.</small></label>
              <label>Discount type<select v-model="form.discountType"><option value="FIXED">Fixed amount (PHP)</option><option value="PERCENT">Percentage (%)</option></select></label>
              <label>{{ form.discountType === 'PERCENT' ? 'Discount (%)' : 'Discount amount (PHP)' }}<input v-model.number="form.value" type="number" min="1" :max="form.discountType === 'PERCENT' ? 99 : undefined" step="1" required /></label>
              <label>Minimum booking total (PHP)<input v-model.number="form.minimumSpend" type="number" min="0" step="1" required /></label>
            </div></section>
            <section class="form-section usage-section"><h3><span class="form-step">2</span> Usage & validity</h3><div class="form-grid">
              <label class="limit-field">Total uses allowed<input v-model.number="form.usageLimit" type="number" min="1" step="1" required /></label>
              <label>Starts (Philippine time)<input v-model="form.startsAt" type="datetime-local" required /></label>
              <label>Expires (Philippine time)<input v-model="form.expiresAt" type="datetime-local" :min="form.startsAt" required /></label>
            </div></section>
          </fieldset>
          <p class="form-note"><IonIcon :icon="informationCircleOutline" aria-hidden="true" /> Voucher discounts apply to regular passenger fares. Each account can use a code once.</p>
        </div>
        <footer class="form-footer"><span class="offer-preview">{{ form.discountType === 'PERCENT' ? `${form.value}%` : money(form.value || 0) }} off regular fares</span><button type="button" :disabled="busy" @click="showCreate = false">Cancel</button><button class="primary" :disabled="busy" type="submit">{{ busy ? 'Saving…' : 'Create voucher' }}</button></footer>
      </form>
    </IonModal>
  </section>
</template>
<script setup lang="ts">
import '../../theme/admin-vouchers.css';
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { IonIcon, IonModal } from '@ionic/vue';
import { addOutline, searchOutline, ticketOutline, ribbonOutline, pauseOutline, playOutline, closeOutline, informationCircleOutline, checkmarkCircleOutline, timeOutline } from 'ionicons/icons';
import { requireSupabase } from '../../services/supabase';
import { listVouchers, saveVoucher, adminLoyaltySettings, saveLoyaltySettings, type LoyaltySettings, type Voucher } from '../../services/vouchers';
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
  try { loyaltySettings.value = (await saveLoyaltySettings(requireSupabase(), { ...loyaltyDraft })).data.settings; Object.assign(loyaltyDraft, loyaltySettings.value); loyaltyNotice.value = 'Loyalty milestones saved.'; }
  catch (cause) { loyaltyError.value = databaseRequestError(cause, 'Could not save loyalty settings.'); }
  finally { loyaltySaving.value = false; }
}
let clock: ReturnType<typeof setInterval> | undefined;
const statuses = ['ACTIVE', 'SCHEDULED', 'PAUSED', 'EXPIRED', 'EXHAUSTED'] as const;
function voucherStatus(voucher: Voucher) {
  if (!voucher.isActive) return 'PAUSED';
  if (Date.parse(voucher.expiresAt) <= now.value) return 'EXPIRED';
  if (voucher.used >= voucher.usageLimit) return 'EXHAUSTED';
  if (Date.parse(voucher.startsAt) > now.value) return 'SCHEDULED';
  return 'ACTIVE';
}
const statusLabel = (status: string) => ({ ACTIVE: 'Active', SCHEDULED: 'Scheduled', PAUSED: 'Paused', EXPIRED: 'Expired', EXHAUSTED: 'Fully used' }[status] || status);
const filteredVouchers = computed(() => vouchers.value.filter(v => v.code.toLowerCase().includes(search.value.trim().toLowerCase()) && (statusFilter.value === 'ALL' || voucherStatus(v) === statusFilter.value)));
const metrics = computed(() => [
  { label: 'Total vouchers', value: vouchers.value.length, icon: ticketOutline, tone: 'blue' },
  { label: 'Active offers', value: vouchers.value.filter(v => voucherStatus(v) === 'ACTIVE').length, icon: checkmarkCircleOutline, tone: 'green' },
  { label: 'Scheduled', value: vouchers.value.filter(v => voucherStatus(v) === 'SCHEDULED').length, icon: timeOutline, tone: 'purple' },
  { label: 'Recorded uses', value: vouchers.value.reduce((sum, v) => sum + v.used, 0), icon: ribbonOutline, tone: 'blue' },
]);
const money = (value: number) => `PHP ${value.toLocaleString('en-PH')}`;
const usagePercent = (v: Voucher) => Math.min(100, Math.max(0, v.usageLimit ? v.used / v.usageLimit * 100 : 0));
const localNow = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 16);
const form = reactive({ code: '', discountType: 'FIXED', value: 50, minimumSpend: 0, usageLimit: 100, startsAt: localNow, expiresAt: '' });
const date = (value: string) => new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' }).format(new Date(value));
function resetFilters() { search.value = ''; statusFilter.value = 'ALL'; }
function openCreate() { formError.value = ''; showCreate.value = true; }
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
  busy.value = true;
  try {
    await saveVoucher(requireSupabase(), { ...form, startsAt: new Date(startsAt).toISOString(), expiresAt: new Date(expiresAt).toISOString(), isActive: true });
    form.code = ''; showCreate.value = false; notice.value = 'Voucher created.'; resetFilters(); await load();
  } catch (cause) { formError.value = databaseRequestError(cause, 'Could not save voucher. Check code, amount, and dates.'); }
  finally { busy.value = false; }
}
async function toggle(voucher: Voucher) {
  if (busy.value) return;
  busy.value = true; pendingId.value = voucher.id; error.value = ''; notice.value = '';
  try { await saveVoucher(requireSupabase(), { id: voucher.id, isActive: !voucher.isActive }); notice.value = `${voucher.code} ${voucher.isActive ? 'paused' : 'activated'}.`; await load(); }
  catch (cause) { error.value = databaseRequestError(cause, 'Could not update voucher.'); }
  finally { busy.value = false; pendingId.value = ''; }
}
onMounted(() => { void load(); void loadLoyalty(); clock = setInterval(() => { now.value = Date.now(); }, 60000); });
onBeforeUnmount(() => { clearInterval(clock); });
</script>
