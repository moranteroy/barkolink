<template>
  <ion-page><ion-content :fullscreen="true">
    <div class="shell">
      <button v-if="menuOpen" class="scrim" aria-label="Close menu" @click="menuOpen = false"></button>
      <aside id="admin-sidebar" class="sidebar" :class="{ open: menuOpen }">
        <BrandMark />
        <nav aria-label="Admin navigation">
          <div v-for="group in navigation" :key="group.label" class="nav-group">
            <span>{{ group.label }}</span>
            <router-link v-for="item in group.items" :key="item.key" :to="item.key === 'dashboard' ? '/admin' : `/admin/${item.key}`" :class="{ active: section === item.key }" @click="menuOpen = false"><ion-icon :icon="item.icon" aria-hidden="true" />{{ item.label }}</router-link>
          </div>
        </nav>
        <button class="logout" @click="logout"><ion-icon :icon="logOutOutline" />Log out</button>
      </aside>
      <div class="workspace">
        <header class="topbar">
          <button class="menu-button" :aria-expanded="menuOpen" aria-controls="admin-sidebar" aria-label="Open menu" @click="menuOpen = true"><ion-icon :icon="menuOutline" /></button>
          <div class="admin-breadcrumbs"><span>Operations</span><ion-icon :icon="chevronForwardOutline" aria-hidden="true" /><strong>{{ page.title }}</strong></div>
          <span class="admin-profile-chip" :title="auth?.currentUser?.email || 'Administrator account'" aria-label="Administrator account">
            <span class="admin-profile-icon"><ion-icon :icon="shieldCheckmarkOutline" aria-hidden="true" /></span>
            <span class="admin-profile-copy"><strong>{{ auth?.currentUser?.displayName?.trim() || 'Admin User' }}</strong><small>Administrator</small></span>
          </span>
        </header>
        <main class="content">
          <div class="heading"><div><p class="eyebrow">{{ page.group }}</p><h1>{{ page.title }}</h1><p>{{ page.description }}</p></div><div class="heading-actions"><button class="secondary" :disabled="loading" @click="loadData"><ion-icon :icon="refreshOutline" />Refresh</button><button v-if="primaryAction" class="primary" @click="openAction">{{ primaryAction }}</button></div></div>
          <p v-if="error" class="alert" role="alert">{{ error }}</p><p v-if="notice" class="notice" role="status">{{ notice }}</p>
          <AdminReportsPanel v-if="section === 'reports'" :refresh-token="reportsRefresh" @loading="loading = $event" />
          <template v-else-if="section === 'dashboard'"><div class="metrics"><article v-for="metric in metrics" :key="metric.label"><small>{{ metric.label }}</small><strong>{{ metric.value }}</strong><span>{{ metric.note }}</span></article></div><div class="dashboard-grid"><section class="panel"><div class="panel-head"><div><p class="eyebrow">LIVE OPERATIONS</p><h2>Today's trips</h2></div><router-link to="/admin/trips">View all →</router-link></div><div class="table-wrap"><table><thead><tr><th>Trip</th><th>Route</th><th>Vessel</th><th>Departure</th><th>Booked</th><th>Status</th></tr></thead><tbody><tr v-for="s in todaySailings" :key="s.code"><td><strong>{{ s.code }}</strong></td><td>{{ routeLabel(s) }}</td><td>{{ s.vessel.name }}</td><td>{{ dateTime(s.departureAt) }}</td><td>{{ s.vessel.passengerCapacity - s.availableSeats }} / {{ s.vessel.passengerCapacity }}</td><td><span class="status">{{ s.status }}</span></td></tr><tr v-if="!todaySailings.length"><td colspan="6" class="empty">No sailings today.</td></tr></tbody></table></div></section><section class="panel flow"><p class="eyebrow">TERMINAL HEALTH</p><h2>Passenger flow</h2><div class="flow-row"><span>Issued tickets</span><strong>{{ count(stats?.allPassengers) }}</strong></div><div class="flow-row"><span>Checked in</span><strong>{{ count(stats?.checkedInPassengers) }}</strong></div><div class="flow-row"><span>Boarded</span><strong>{{ count(stats?.boardedPassengers) }}</strong></div><div class="progress"><i :style="{ width: `${flowPercent}%` }"></i></div><small>{{ flowPercent }}% of issued tickets checked in</small></section></div></template>
          <section v-else-if="section === 'fares'" class="fare-settings-panel" aria-label="Fare configuration">
            <div class="panel fare-vessel-picker">
              <div><p class="eyebrow">VESSEL PRICING</p><h2>Choose a vessel</h2><p>Each ferry has its own regular fare and passenger discounts.</p></div>
              <div><label for="fare-vessel">Vessel</label><select id="fare-vessel" v-model="selectedFareVesselId" :disabled="loading || !!busy || !fareSettingsLoaded"><option value="" disabled>Select a vessel</option><option v-for="v in activeVessels" :key="v.id" :value="v.id">{{ v.name }} · {{ v.code }}</option></select><span class="fare-config-status" :class="{ configured: selectedVesselHasFares }">{{ selectedFareVesselId ? selectedVesselHasFares ? 'Saved rates' : 'Rates not saved yet' : 'No active vessels' }}</span></div>
            </div>
            <p v-if="fareSettingsLoaded && !activeVessels.length" class="fare-vessel-note">Add an active vessel in <router-link to="/admin/vessels">Vessels</router-link> to configure its fares.</p>
            <p v-else-if="fareSettingsLoaded && selectedFareVesselId && !selectedVesselHasFares" class="fare-vessel-note">Set and save rates for {{ selectedFareVessel?.name }} before creating its trips. The values below are a starting point.</p>
            <form @submit.prevent="saveFareSettings"><fieldset :disabled="loading || !!busy || !fareSettingsLoaded || !selectedFareVesselId">
              <div class="fare-layout">
                <div class="fare-editor">
                  <section class="panel fare-card">
                    <div class="fare-card-heading"><span class="fare-card-icon"><ion-icon :icon="ticketOutline" aria-hidden="true" /></span><div><h2>Regular fare</h2><p>The base price for {{ selectedFareVessel?.name || 'the selected vessel' }}.</p></div></div>
                    <label for="regular-fare">Base fare</label>
                    <div class="fare-input fare-base-input"><span aria-hidden="true">PHP</span><input id="regular-fare" v-model.number="fareSettingsForm.regularFare" type="number" min="1" max="2147483647" step="1" required aria-describedby="regular-fare-hint" /></div>
                    <p id="regular-fare-hint" class="fare-hint">Passenger discounts are calculated from this amount.</p>
                  </section>
                  <section class="panel fare-card">
                    <div class="fare-card-heading"><span class="fare-card-icon"><ion-icon :icon="peopleOutline" aria-hidden="true" /></span><div><h2>Passenger discounts</h2><p>Set a discount for each passenger type.</p></div></div>
                    <div class="fare-discount-grid"><div v-for="type in discountTypes" :key="type.key" class="fare-discount-field">
                      <label :for="`fare-${type.key}`">{{ type.label }}</label>
                      <div class="fare-input"><input :id="`fare-${type.key}`" v-model.number="fareSettingsForm[type.key]" type="number" min="0" max="99" step="1" required :aria-describedby="`hint-${type.key}`" /><span aria-hidden="true">%</span></div>
                      <small :id="`hint-${type.key}`">{{ validFareSettings(fareSettingsForm) ? `PHP ${(fareSettingsForm.regularFare - settingsFarePreview[type.fareKey]).toLocaleString()} off regular fare` : 'Enter a discount from 0 to 99%' }}</small>
                    </div></div>
                  </section>
                </div>
                <aside class="panel fare-preview-card" aria-labelledby="fare-preview-title">
                  <div class="fare-preview-heading"><p class="eyebrow">LIVE PREVIEW</p><h2 id="fare-preview-title">Passenger fares</h2><p>{{ selectedFareVessel?.name || 'Select a vessel to configure its rates.' }}</p></div>
                  <div class="fare-preview">
                    <div class="fare-preview-regular"><span>Regular<small>Base fare</small></span><strong>PHP {{ validFareSettings(fareSettingsForm) ? settingsFarePreview.regularFare.toLocaleString() : '—' }}</strong></div>
                    <div v-for="type in discountTypes" :key="type.key"><span>{{ type.label }}<small>{{ Number.isInteger(fareSettingsForm[type.key]) && fareSettingsForm[type.key] >= 0 && fareSettingsForm[type.key] < 100 ? `${fareSettingsForm[type.key]}% discount` : 'Invalid discount' }}</small></span><strong>PHP {{ validFareSettings(fareSettingsForm) ? settingsFarePreview[type.fareKey].toLocaleString() : '—' }}</strong></div>
                  </div>
                  <p class="fare-preview-note"><ion-icon :icon="ticketOutline" aria-hidden="true" />Fares are rounded to whole pesos, with a minimum of PHP 1.</p>
                </aside>
              </div>
              <div class="panel fare-save-bar"><div><strong>{{ loading ? 'Loading fare settings…' : `Apply to new trips for ${selectedFareVessel?.name || 'this vessel'}` }}</strong><p>Existing trips and reservations keep their saved fares.</p></div><button class="primary" type="submit" :disabled="!validFareSettings(fareSettingsForm) || !selectedFareVesselId">{{ busy === 'fares' ? 'Saving…' : 'Save fares & discounts' }}</button></div>
            </fieldset></form>
          </section>
          <template v-else><p v-if="section === 'boarding'" class="boarding-help"><ion-icon :icon="informationCircleOutline" aria-hidden="true" /><span>Boarding is available for checked-in passengers on paid, confirmed reservations when the trip status is <strong>BOARDING</strong>. Open boarding in <router-link to="/admin/trips">Trips & schedules</router-link>.</span></p><div class="toolbar"><input v-model.trim="search" type="search" :placeholder="`Search ${page.title.toLowerCase()}`" :aria-label="`Search ${page.title}`" /><select v-if="['bookings','passengers','trips','check-in','boarding','users'].includes(section)" v-model="statusFilter" aria-label="Filter by status"><option value="ALL">All statuses</option><option v-for="value in filterOptions" :key="value" :value="value">{{ value }}</option></select><select v-if="['check-in','boarding','manifest'].includes(section)" v-model="sailingFilter" aria-label="Filter by sailing"><option value="ALL">All sailings</option><option v-for="s in sailings" :key="s.code" :value="s.code">{{ s.code }} · {{ routeLabel(s) }}</option></select></div>
            <section class="panel"><div class="panel-head"><div><p class="eyebrow">POSTGRESQL DATA</p><h2>{{ page.table }}</h2></div><span class="count">{{ rows.length }} {{ rows.length === 1 ? 'record' : 'records' }}</span></div><div class="table-wrap"><table><thead><tr><th v-for="heading in columns" :key="heading">{{ heading }}</th><th v-if="hasRowAction">Action</th></tr></thead><tbody><tr v-for="row in rows" :key="row.key"><td v-for="(cell, index) in row.cells" :key="index"><span :class="{ status: index === row.statusIndex }">{{ cell }}</span></td><td v-if="hasRowAction"><template v-if="section === 'bookings'"><button class="text-action danger" :disabled="(row.source.paymentStatus !== 'UNPAID' || !['PENDING','CONFIRMED'].includes(row.source.status)) || busy === row.key" @click="cancelBooking(row.source)">Cancel</button></template><template v-else-if="section === 'ports' || section === 'vessels'"><button class="text-action" @click="editRecord(row.source)">Edit</button></template><template v-else-if="section === 'trips'"><div class="trip-row-actions"><button class="text-action" type="button" :disabled="!canEditTrip(row.source) || !!busy" :title="canEditTrip(row.source) ? 'Edit trip details' : 'Boarding or completed trips cannot be edited'" @click="openTripEditor(row.source)">Edit</button><select :value="row.source.status" :disabled="!!busy || nextStatuses(row.source).length === 1" :aria-label="`Status for ${row.key}`" @change="changeSailingStatus(row.source, $event)"><option v-for="state in nextStatuses(row.source)" :key="state" :value="state">{{ state }}</option></select></div></template><template v-else-if="section === 'check-in'"><button class="text-action" :disabled="!!ticketActionBlockReason(row.source, 'check-in') || !!busy" :title="ticketActionBlockReason(row.source, 'check-in') || 'Check in passenger'" @click="processTicket(row.source,'check-in')">{{ row.source.ticketStatus === 'ISSUED' ? 'Check in' : 'Done' }}</button></template><template v-else-if="section === 'boarding'"><div class="boarding-row-action"><button class="text-action" :disabled="!!ticketActionBlockReason(row.source, 'boarding') || !!busy" :title="ticketActionBlockReason(row.source, 'boarding') || 'Board passenger'" @click="processTicket(row.source,'boarding')">{{ busy === row.key ? 'Boarding…' : row.source.ticketStatus === 'BOARDED' ? 'Boarded' : 'Board' }}</button></div></template></td></tr><tr v-if="!rows.length"><td :colspan="columns.length + (hasRowAction ? 1 : 0)" class="empty">{{ loading ? 'Loading records…' : 'No matching records.' }}</td></tr></tbody></table></div><p class="table-foot">{{ section === 'bookings' ? 'Latest 100 reservations' : ['passengers','check-in','boarding','manifest'].includes(section) ? 'Passenger figures use the latest 1,000 ticket records' : 'Live records from SQL Connect' }}</p></section></template>
        </main>
      </div>
    </div>
    <ion-modal :is-open="modal !== ''" :class="{ 'trip-modal': modal === 'trip' }" @didDismiss="closeModal"><div class="modal-body" :class="{ 'trip-dialog': modal === 'trip' }"><div class="modal-head"><div class="trip-modal-title"><span v-if="modal === 'trip'" class="trip-title-icon"><ion-icon :icon="boatOutline" aria-hidden="true" /></span><div><p v-if="modal === 'trip'" class="eyebrow">TRIPS & SCHEDULES</p><h2>{{ modalTitle }}</h2><p v-if="modal === 'trip'" class="trip-subtitle">{{ editingId ? 'Review sailing details and update the schedule.' : 'Choose a route, vessel, and departure schedule.' }}</p></div></div><button type="button" aria-label="Close dialog" :disabled="!!busy" @click="closeModal"><ion-icon :icon="closeOutline" /></button></div><p v-if="formError" class="alert" role="alert">{{ formError }}</p>
      <form v-if="modal === 'port'" @submit.prevent="savePort"><label>Port code<input v-model.trim="portForm.code" :disabled="!!editingId" required maxlength="12" /></label><label>Name<input v-model.trim="portForm.name" required maxlength="120" /></label><label>City<input v-model.trim="portForm.city" required maxlength="120" /></label><label>Region<input v-model.trim="portForm.region" maxlength="120" /></label><label v-if="editingId" class="checkbox"><input v-model="portForm.isActive" type="checkbox" /> Active</label><button class="primary" :disabled="!!busy">{{ busy ? 'Saving…' : 'Save port' }}</button></form>
      <form v-else-if="modal === 'vessel'" @submit.prevent="saveVessel"><label>Vessel code<input v-model.trim="vesselForm.code" :disabled="!!editingId" required maxlength="20" /></label><label>Name<input v-model.trim="vesselForm.name" required maxlength="120" /></label><label>Passenger capacity<input v-model.number="vesselForm.capacity" type="number" min="1" max="10000" :disabled="!!editingId" required /></label><p v-if="editingId" class="form-note">Capacity is fixed after creation to preserve existing sailing availability.</p><label v-if="editingId" class="checkbox"><input v-model="vesselForm.isActive" type="checkbox" /> Active</label><button class="primary" :disabled="!!busy">{{ busy ? 'Saving…' : 'Save vessel' }}</button></form>
      <form v-else-if="modal === 'trip'" class="trip-form" @submit.prevent="saveTrip">
        <div class="trip-scroll">
          <div class="trip-code-banner"><label>Trip code<input :value="tripForm.code" readonly required /></label><span class="trip-code-badge">{{ editingId ? 'Existing sailing' : 'Auto-generated' }}</span><p v-if="!editingId">Today's daily number is finalized when you create the trip.</p></div>
          <div v-if="editingId && tripEditLoading" class="trip-callout"><ion-icon :icon="refreshOutline" aria-hidden="true" /><p>Checking active reservations…</p></div>
          <div v-if="editingId && tripBookingsLoaded && tripHasBookings" class="trip-callout"><ion-icon :icon="lockClosedOutline" aria-hidden="true" /><div><strong>{{ tripBookings.length }} active {{ tripBookings.length === 1 ? 'reservation' : 'reservations' }}</strong><p>Only departure and arrival can be changed. Account holders will receive a schedule notification.</p><p v-if="tripBookings.some(item => item.bookingChannel === 'WALK_IN')">Contact walk-in passengers directly about the new schedule.</p></div></div>
          <div class="trip-grid">
            <div class="trip-details">
              <section class="trip-section" aria-labelledby="trip-route-title">
                <div class="trip-section-heading"><span><ion-icon :icon="locationOutline" aria-hidden="true" /></span><div><h3 id="trip-route-title">Route & vessel</h3><p>Choose where and how passengers will travel.</p></div><small v-if="tripFieldsLocked" class="trip-lock-badge"><ion-icon :icon="lockClosedOutline" aria-hidden="true" />Locked</small></div>
                <div class="form-grid"><label>Origin<select v-model="tripForm.originPortId" :disabled="tripFieldsLocked" required><option value="" disabled>Select origin port</option><option v-for="p in activePorts" :key="p.id" :value="p.id">{{ p.name }}</option></select></label><label>Destination<select v-model="tripForm.destinationPortId" :disabled="tripFieldsLocked" required><option value="" disabled>Select destination port</option><option v-for="p in activePorts" :key="p.id" :value="p.id">{{ p.name }}</option></select></label></div>
                <label>Vessel<select v-model="tripForm.vesselId" :disabled="tripFieldsLocked" required><option value="" disabled>Select vessel</option><option v-for="v in activeVessels" :key="v.id" :value="v.id">{{ v.name }} · {{ v.passengerCapacity }} seats</option></select></label>
                <p v-if="selectedTripVessel" class="trip-field-hint"><ion-icon :icon="peopleOutline" aria-hidden="true" />{{ selectedTripVessel.passengerCapacity }} passenger seats on {{ selectedTripVessel.name }}</p>
              </section>
              <section class="trip-section" aria-labelledby="trip-schedule-title">
                <div class="trip-section-heading"><span><ion-icon :icon="calendarOutline" aria-hidden="true" /></span><div><h3 id="trip-schedule-title">Sailing schedule</h3><p>Set the departure and expected arrival.</p></div></div>
                <div class="form-grid"><label>Departure<input v-model="tripForm.departureAt" type="datetime-local" required /></label><label>Arrival<input v-model="tripForm.arrivalAt" type="datetime-local" required /></label></div>
                <p class="trip-field-hint"><ion-icon :icon="timeOutline" aria-hidden="true" />{{ tripDurationLabel || 'Arrival must be later than departure.' }}</p>
              </section>
            </div>
            <aside class="trip-section trip-fare-section" aria-labelledby="trip-fares-title">
              <div class="trip-section-heading"><span><ion-icon :icon="ticketOutline" aria-hidden="true" /></span><div><h3 id="trip-fares-title">Passenger fares</h3><p>{{ tripFieldsLocked ? 'Saved fares are locked.' : 'Based on the selected vessel.' }}</p></div></div>
              <div v-if="tripForm.vesselId || editingId" class="trip-fare-values">
                <label class="trip-regular-fare">Regular fare (PHP)<input v-model.number="tripForm.regularFare" type="number" min="1" max="2147483647" step="1" :readonly="!editingId" :disabled="tripFieldsLocked || !tripVesselFares" required /></label>
                <div class="trip-discount-fares"><label v-for="type in discountTypes" :key="type.key"><span>{{ type.label }}<small>PHP</small></span><input :value="tripForm[type.fareKey]" type="number" readonly /></label></div>
              </div>
              <div v-else class="trip-fares-empty"><ion-icon :icon="boatOutline" aria-hidden="true" /><strong>Select a vessel</strong><p>Its regular and discounted fares will appear here automatically.</p></div>
              <p v-if="tripForm.vesselId && !tripVesselFares && !tripFieldsLocked" class="trip-fare-warning">Save fares for this vessel in <router-link to="/admin/fares">Fares & discounts</router-link> before creating a trip or changing its fares.</p>
              <p v-else-if="tripForm.vesselId && !tripFieldsLocked" class="trip-field-hint">{{ editingId ? 'Changing the regular fare recalculates fares using this vessel’s saved discounts.' : 'Fares are filled automatically from this vessel’s saved rates.' }}</p>
            </aside>
          </div>
        </div>
        <footer class="trip-form-footer"><span><ion-icon :icon="boatOutline" aria-hidden="true" />{{ editingId ? 'Review your changes before saving.' : 'New trips start as Scheduled.' }}</span><div><button class="secondary" type="button" :disabled="!!busy" @click="closeModal">Cancel</button><button class="primary" type="submit" :disabled="!!busy || tripEditLoading || (!editingId && !tripVesselFares) || (!!editingId && !tripBookingsLoaded) || (!!editingId && tripHasBookings && !tripScheduleChanged) || (!tripHasBookings && (activePorts.length < 2 || !activeVessels.length))">{{ busy ? 'Saving…' : editingId ? 'Save trip changes' : 'Create trip' }}</button></div></footer>
      </form>
      <div v-else-if="modal === 'user'"><div v-if="createdAccount" class="created"><strong>Account created</strong><p>{{ createdAccount.email }} · {{ createdAccount.role }}</p><label>Temporary password<div class="copy-row"><code>{{ createdAccount.password }}</code><button @click="copyPassword">Copy</button></div></label><p>Share this password privately.</p><button class="primary" @click="closeModal">Done</button></div><form v-else @submit.prevent="saveUser"><fieldset :disabled="!!busy"><label>Full name<input v-model.trim="userForm.fullName" required maxlength="120" /></label><label>Email<input v-model.trim="userForm.email" type="email" required /></label><label>Role<select v-model="userForm.role"><option value="PASSENGER">Passenger</option><option value="TICKETING">Ticketing staff</option><option value="BOARDING">Boarding staff</option></select></label><label>Temporary password<div class="copy-row"><input v-model="userForm.password" type="text" required minlength="8" /><button type="button" :disabled="!!busy" @click="generatePassword">{{ busy === 'password' ? 'Generating...' : 'Generate' }}</button></div></label><button class="primary" :disabled="!!busy">{{ busy === 'user' ? 'Creating...' : 'Create account' }}</button></fieldset></form></div>
    </div></ion-modal>
  </ion-content></ion-page>
</template>

<script setup lang="ts">
import { dataConnectRequestError } from '../data/dataConnectErrors'
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { signOut } from 'firebase/auth'
import { httpsCallable } from 'firebase/functions'
import { IonContent, IonIcon, IonModal, IonPage, onIonViewWillEnter } from '@ionic/vue'
import { barChartOutline, boatOutline, calendarOutline, chevronForwardOutline, closeOutline, gridOutline, informationCircleOutline, listOutline, locationOutline, lockClosedOutline, logOutOutline, menuOutline, peopleCircleOutline, peopleOutline, refreshOutline, scanOutline, shieldCheckmarkOutline, ticketOutline, timeOutline } from 'ionicons/icons'
import BrandMark from '../../components/BrandMark.vue'
import AdminReportsPanel from '../components/AdminReportsPanel.vue'
import { clearSessionViews } from '../composables/sessionViews'
import { adminCancelBooking, adminCreatePort, adminCreateSailing, adminCreateVessel, adminDashboardStats, adminPassengerRecords, adminPorts, adminRescheduleSailing, adminSailingBookings, adminSailings, adminUpdatePort, adminUpdateSailingStatus, adminUpdateUnbookedSailing, adminUpdateVessel, adminUsers, adminVessels, boardTicket, checkInTicket, staffBookings, type AdminDashboardStatsData, type AdminPassengerRecordsData, type AdminPortsData, type AdminSailingBookingsData, type AdminSailingsData, type AdminUsersData, type AdminVesselsData, type StaffBookingsData } from '../dataconnect-generated/staff'
import { auth, functions, staffDataConnect } from '../services/firebase'
import { adminFareSettings, adminNextTripCode, adminSaveFareSettings } from '../dataconnect-generated/staff'
import { calculateFares, defaultFareSettings, discountTypes, validFareSettings, type FareSettings } from '../data/fareSettings'
import { ticketActionBlockReason, ticketRequestError } from '../data/ticketActions'
import { accountRequestError } from '../data/accountErrors'

const fareSettings = reactive({ ...defaultFareSettings })
const vesselFareSettings = ref<Record<string, FareSettings>>({})
const fareDrafts = ref<Record<string, FareSettings>>({})
const selectedFareVesselId = ref('')
const fareSettingsForm = reactive({ ...defaultFareSettings })
const fareSettingsLoaded = ref(false)
const nextTripCode = ref('')
const settingsFarePreview = computed(() => calculateFares(fareSettingsForm.regularFare, fareSettingsForm))

const route = useRoute(), router = useRouter()
const section = computed(() => String(route.params.section || 'dashboard'))
const isWorkspaceRoute = computed(() => route.path === '/admin' || (route.path.startsWith('/admin/') && route.path !== '/admin/settings'))
const menuOpen = ref(false), loading = ref(false), error = ref(''), notice = ref(''), busy = ref(''), modal = ref(''), formError = ref(''), editingId = ref('')
const search = ref(''), statusFilter = ref('ALL'), sailingFilter = ref('ALL')
const reportsRefresh = ref(0)
watch(section, () => { if (!isWorkspaceRoute.value) return; search.value = ''; statusFilter.value = 'ALL'; sailingFilter.value = 'ALL'; menuOpen.value = false; void loadData() })
const bookings = ref<StaffBookingsData['bookings']>([]), sailings = ref<AdminSailingsData['sailings']>([]), users = ref<AdminUsersData['users']>([]), passengers = ref<AdminPassengerRecordsData['bookingPassengers']>([]), ports = ref<AdminPortsData['ports']>([]), vessels = ref<AdminVesselsData['vessels']>([]), stats = ref<AdminDashboardStatsData | null>(null)
const navigation = [
  { label: 'OVERVIEW', items: [{ key: 'dashboard', label: 'Dashboard', icon: gridOutline }] },
  { label: 'WORKSPACE', items: [{ key: 'bookings', label: 'Bookings', icon: ticketOutline }, { key: 'passengers', label: 'Passengers', icon: peopleOutline }] },
  { label: 'FERRY OPERATIONS', items: [{ key: 'trips', label: 'Trips & schedules', icon: boatOutline }, { key: 'fares', label: 'Fares & discounts', icon: ticketOutline }, { key: 'ports', label: 'Ports & routes', icon: locationOutline }, { key: 'vessels', label: 'Vessels', icon: boatOutline }] },
  { label: 'PASSENGER OPERATIONS', items: [{ key: 'check-in', label: 'Check-in', icon: scanOutline }, { key: 'boarding', label: 'Boarding', icon: peopleOutline }, { key: 'manifest', label: 'Passenger manifest', icon: listOutline }] },
  { label: 'MANAGEMENT', items: [{ key: 'reports', label: 'Reports & analytics', icon: barChartOutline }, { key: 'users', label: 'Users', icon: peopleCircleOutline }] }
]
const pages: Record<string, { group: string; title: string; description: string; table: string }> = {
  dashboard: { group: 'OVERVIEW', title: 'Dashboard', description: 'Live bookings, departures, and passenger progress.', table: '' },
  bookings: { group: 'WORKSPACE', title: 'Booking management', description: 'Review reservations and cancel eligible unpaid bookings.', table: 'Recent bookings' },
  passengers: { group: 'WORKSPACE', title: 'Passenger management', description: 'Passenger tickets and booking accounts.', table: 'Passenger directory' },
  trips: { group: 'FERRY OPERATIONS', title: 'Trips & schedules', description: 'Schedule sailings and update their departure status.', table: 'Sailing schedule' },
  fares: { group: 'FERRY OPERATIONS', title: 'Fares & discounts', description: 'Manage regular fares and automatic passenger discounts for each vessel.', table: '' },
  ports: { group: 'FERRY OPERATIONS', title: 'Ports & routes', description: 'Manage ports available for new sailings.', table: 'Port directory' },
  vessels: { group: 'FERRY OPERATIONS', title: 'Vessels', description: 'Manage fleet details and availability.', table: 'Fleet directory' },
  'check-in': { group: 'PASSENGER OPERATIONS', title: 'Check-in', description: 'Check in issued tickets for confirmed reservations.', table: 'Ticket check-in' },
  boarding: { group: 'PASSENGER OPERATIONS', title: 'Boarding', description: 'Board passengers after check-in.', table: 'Boarding queue' },
  manifest: { group: 'PASSENGER OPERATIONS', title: 'Passenger manifest', description: 'View passenger lists by sailing. Download manifests in Reports & analytics.', table: 'Passenger manifest' },
  reports: { group: 'INSIGHTS', title: 'Reports & analytics', description: 'Explore collections, bookings, and sailing performance by date, route, and vessel.', table: 'Sailing performance' },
  users: { group: 'MANAGEMENT', title: 'User management', description: 'Create passenger and staff accounts.', table: 'System users' }
}
const page = computed(() => pages[section.value] || pages.dashboard)
const primaryAction = computed(() => ({ trips: 'Create trip', ports: 'Add port', vessels: 'Add vessel', users: 'Add user' } as Record<string, string>)[section.value] || '')
const count = (records?: { _count: number }[]) => records?.[0]?._count || 0
const metrics = computed(() => [
  { label: "Today's sailings", value: stats.value ? count(stats.value.todaySailings) : '—', note: 'Departures today' },
  { label: "Today's bookings", value: stats.value ? count(stats.value.todayBookings) : '—', note: 'Created today' },
  { label: 'Checked in', value: stats.value ? count(stats.value.checkedInPassengers) : '—', note: 'Passenger tickets' },
  { label: 'Cancelled', value: stats.value ? count(stats.value.cancelledBookings) : '—', note: 'All reservations' }
])
const flowPercent = computed(() => { const total = count(stats.value?.allPassengers); return total ? Math.round(count(stats.value?.checkedInPassengers) / total * 100) : 0 })
const localDayBounds = () => { const d = new Date(); return { dayStart: new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString(), dayEnd: new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).toISOString() } }
const todaySailings = computed(() => { const { dayStart, dayEnd } = localDayBounds(); return sailings.value.filter(s => s.departureAt >= dayStart && s.departureAt < dayEnd) })
const dateTime = (value: string) => new Date(value).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })
const routeLabel = (s: AdminSailingsData['sailings'][number]) => `${s.origin.name} → ${s.destination.name}`
async function loadData() {
  if (isWorkspaceRoute.value && section.value === 'reports') { error.value = ''; notice.value = ''; reportsRefresh.value++; return }
  if (!isWorkspaceRoute.value) return
  if (!staffDataConnect) { error.value = 'Firebase is not configured.'; return }
  loading.value = true; error.value = ''
  const dc = staffDataConnect
  fareSettingsLoaded.value = false
  nextTripCode.value = ''
  const results = await Promise.allSettled([staffBookings(dc,{fetchPolicy:'SERVER_ONLY'}), adminSailings(dc,{fetchPolicy:'SERVER_ONLY'}), adminUsers(dc,{fetchPolicy:'SERVER_ONLY'}), adminPorts(dc,{fetchPolicy:'SERVER_ONLY'}), adminVessels(dc,{fetchPolicy:'SERVER_ONLY'}), adminPassengerRecords(dc,{fetchPolicy:'SERVER_ONLY'}), adminDashboardStats(dc, localDayBounds(),{fetchPolicy:'SERVER_ONLY'}), adminFareSettings(dc,{fetchPolicy:'SERVER_ONLY'}), adminNextTripCode(dc,{fetchPolicy:'SERVER_ONLY'})] as const)
  const failed: string[] = []
  const names = ['Bookings', 'Trips', 'Users', 'Ports', 'Vessels', 'Passengers', 'Dashboard', 'Fares & discounts', 'Trip code']
  results.forEach((result, index) => { if (result.status === 'rejected') failed.push(names[index]) })
  const [b, s, u, p, v, a, d, f, c] = results
  if (c.status === 'fulfilled') {
    const preview = c.value.data.nextTripCode
    if (preview && typeof preview === 'object' && 'code' in preview && typeof preview.code === 'string' && /^TRP\d{4}-\d{4}\d{3,}$/.test(preview.code)) nextTripCode.value = preview.code
  }
  if (b.status === 'fulfilled') bookings.value = b.value.data.bookings
  if (s.status === 'fulfilled') sailings.value = s.value.data.sailings
  if (u.status === 'fulfilled') users.value = u.value.data.users
  if (p.status === 'fulfilled') ports.value = p.value.data.ports
  if (v.status === 'fulfilled') vessels.value = v.value.data.vessels
  if (a.status === 'fulfilled') passengers.value = a.value.data.bookingPassengers
  if (d.status === 'fulfilled') stats.value = d.value.data
  if (f.status === 'fulfilled') {
    Object.assign(fareSettings, f.value.data.fareSettings || defaultFareSettings)
    vesselFareSettings.value = Object.fromEntries(f.value.data.vesselFareSettings.map(item => {
      const { code, ...settings } = item
      return [code, settings]
    }))
    fareDrafts.value = {}
    if (!vessels.value.some(v => v.id === selectedFareVesselId.value && v.isActive)) selectedFareVesselId.value = vessels.value.find(v => v.isActive)?.id || ''
    Object.assign(fareSettingsForm, vesselFareSettings.value[selectedFareVesselId.value] || fareSettings)
    fareSettingsLoaded.value = true
  }
  if (failed.length) error.value = `Could not refresh ${failed.join(', ')}. Other admin records remain available. Try Refresh.`
  loading.value = false
}
onIonViewWillEnter(() => { if (isWorkspaceRoute.value) void loadData() })
async function logout() { if (auth) await signOut(auth); await router.replace('/login'); clearSessionViews() }
const activePorts = computed(() => ports.value.filter(p => p.isActive)), activeVessels = computed(() => vessels.value.filter(v => v.isActive))
const selectedFareVessel = computed(() => activeVessels.value.find(v => v.id === selectedFareVesselId.value))
const selectedVesselHasFares = computed(() => !!vesselFareSettings.value[selectedFareVesselId.value])
watch(selectedFareVesselId, (vesselId, previousId) => {
  if (previousId && fareSettingsLoaded.value) fareDrafts.value[previousId] = { ...fareSettingsForm }
  Object.assign(fareSettingsForm, fareDrafts.value[vesselId] || vesselFareSettings.value[vesselId] || fareSettings)
}, { flush: 'sync' })
const portForm = reactive({ code: '', name: '', city: '', region: '', isActive: true })
const vesselForm = reactive({ code: '', name: '', capacity: 100, isActive: true })
const tripForm = reactive({ code: '', originPortId: '', destinationPortId: '', vesselId: '', departureAt: '', arrivalAt: '', regularFare: 500, studentFare: 400, seniorFare: 400, childFare: 400, pwdFare: 400 })
const tripVesselFares = computed(() => fareSettingsLoaded.value ? vesselFareSettings.value[tripForm.vesselId] : undefined)
const selectedTripVessel = computed(() => vessels.value.find(v => v.id === tripForm.vesselId))
const tripDurationLabel = computed(() => {
  const minutes = Math.round((new Date(tripForm.arrivalAt).getTime() - new Date(tripForm.departureAt).getTime()) / 60000)
  if (!Number.isFinite(minutes) || minutes <= 0) return ''
  const hours = Math.floor(minutes / 60), remainder = minutes % 60
  return `Estimated travel time: ${hours ? `${hours}h` : ''}${hours && remainder ? ' ' : ''}${remainder ? `${remainder}m` : ''}`
})
const tripBookings = ref<AdminSailingBookingsData['bookings']>([])
const tripEditLoading = ref(false)
const tripBookingsLoaded = ref(false)
const tripHasBookings = computed(() => tripBookings.value.length > 0)
const tripFieldsLocked = computed(() => !!editingId.value && (tripEditLoading.value || !tripBookingsLoaded.value || tripHasBookings.value))
const editingTrip = computed(() => sailings.value.find(item => item.code === editingId.value))
const tripScheduleChanged = computed(() => !editingTrip.value || tripForm.departureAt !== toLocalDateTime(editingTrip.value.departureAt) || tripForm.arrivalAt !== toLocalDateTime(editingTrip.value.arrivalAt))
const fareTypes = [{ key: 'regularFare', label: 'Regular' }, { key: 'studentFare', label: 'Student' }, { key: 'seniorFare', label: 'Senior' }, { key: 'childFare', label: 'Child' }, { key: 'pwdFare', label: 'PWD' }] as const
watch(() => tripForm.regularFare, () => {
  if (modal.value === 'trip' && !tripFieldsLocked.value && tripVesselFares.value) Object.assign(tripForm, calculateFares(tripForm.regularFare, tripVesselFares.value))
}, { flush: 'sync' })
watch(() => tripForm.vesselId, () => {
  if (modal.value !== 'trip' || tripFieldsLocked.value) return
  const settings = tripVesselFares.value
  Object.assign(tripForm, settings ? calculateFares(settings.regularFare, settings) : { regularFare: 0, studentFare: 0, seniorFare: 0, childFare: 0, pwdFare: 0 })
}, { flush: 'sync' })
async function saveFareSettings() {
  const dc = staffDataConnect
  if (!dc || busy.value || !fareSettingsLoaded.value || !selectedFareVessel.value) return
  if (!validFareSettings(fareSettingsForm)) { error.value = 'Enter a positive whole-peso regular fare and whole-number discounts from 0 to 99%.'; return }
  busy.value = 'fares'; error.value = ''; notice.value = ''
  try {
    const vesselId = selectedFareVesselId.value
    const settings = { ...fareSettingsForm }
    await adminSaveFareSettings(dc, { vesselId, ...settings })
    vesselFareSettings.value[vesselId] = settings
    fareDrafts.value[vesselId] = settings
    notice.value = `Fares & discounts saved for ${selectedFareVessel.value.name}. New trips for this vessel will use these rates.`
  } catch (cause) { error.value = dataConnectRequestError(cause, 'Could not save fare settings.') }
  finally { busy.value = '' }
}
const userForm = reactive({ fullName: '', email: '', role: 'PASSENGER', password: '' })
const createdAccount = ref<{ email: string; role: string; password: string } | null>(null)
const modalTitle = computed(() => ({ trip: editingId.value ? 'Edit sailing' : 'Create a sailing', port: editingId.value ? 'Edit port' : 'Add port', vessel: editingId.value ? 'Edit vessel' : 'Add vessel', user: 'Create an account' } as Record<string, string>)[modal.value] || '')
function openAction() {
  formError.value = ''; editingId.value = ''
  modal.value = ({ trips: 'trip', ports: 'port', vessels: 'vessel', users: 'user' } as Record<string, string>)[section.value] || ''
  if (modal.value === 'port') Object.assign(portForm, { code: '', name: '', city: '', region: '', isActive: true })
  if (modal.value === 'vessel') Object.assign(vesselForm, { code: '', name: '', capacity: 100, isActive: true })
  if (modal.value === 'trip') {
    if (!fareSettingsLoaded.value) { modal.value = ''; error.value = 'Refresh fare settings before creating a trip.'; return }
    if (!nextTripCode.value) { modal.value = ''; error.value = 'Refresh the trip code before creating a trip.'; return }
    tripBookings.value = []; tripBookingsLoaded.value = true
    Object.assign(tripForm, { code: nextTripCode.value, originPortId: '', destinationPortId: '', vesselId: '', departureAt: '', arrivalAt: '', regularFare: 0, studentFare: 0, seniorFare: 0, childFare: 0, pwdFare: 0 })
  }
  if (modal.value === 'user') { Object.assign(userForm, { fullName: '', email: '', role: 'PASSENGER', password: '' }); createdAccount.value = null }
}
function closeModal() { if (busy.value) return; modal.value = ''; formError.value = ''; createdAccount.value = null }
function editRecord(record: AdminPortsData['ports'][number] | AdminVesselsData['vessels'][number]) {
  editingId.value = record.id; formError.value = ''
  if (section.value === 'ports' && 'city' in record) { Object.assign(portForm, { code: record.code, name: record.name, city: record.city, region: record.region || '', isActive: record.isActive }); modal.value = 'port' }
  if (section.value === 'vessels' && 'passengerCapacity' in record) { Object.assign(vesselForm, { code: record.code, name: record.name, capacity: record.passengerCapacity, isActive: record.isActive }); modal.value = 'vessel' }
}
async function mutate(label: string, work: () => Promise<unknown>) { busy.value = label; formError.value = ''; error.value = ''; try { await work(); modal.value = ''; notice.value = 'Saved successfully.'; await loadData() } catch (e) { const message = dataConnectRequestError(e, 'Could not save changes.'); if (modal.value) formError.value = message; else error.value = message } finally { busy.value = '' } }
async function cancelBooking(b: StaffBookingsData['bookings'][number]) { const dc = staffDataConnect; if (!dc || !['PENDING','CONFIRMED'].includes(b.status) || b.paymentStatus !== 'UNPAID') return; if (new Date(b.sailing.departureAt) <= new Date()) { error.value = 'Departed sailings cannot be cancelled.'; return } if (!window.confirm(`Cancel unpaid reservation ${b.reference} and return ${b.passengerCount} seat(s)?`)) return; await mutate(b.reference, () => adminCancelBooking(dc, { bookingId: b.id, sailingCode: b.sailing.code, passengerCount: b.passengerCount })) }
async function savePort() { const dc = staffDataConnect; if (!dc) return; const code = portForm.code.trim().toUpperCase(); if (!code || !portForm.name.trim() || !portForm.city.trim()) { formError.value = 'Complete the port code, name, and city.'; return } await mutate('port', () => editingId.value ? adminUpdatePort(dc, { id: editingId.value, name: portForm.name, city: portForm.city, region: portForm.region || null, isActive: portForm.isActive }) : adminCreatePort(dc, { code, name: portForm.name, city: portForm.city, region: portForm.region || null })) }
async function saveVessel() { const dc = staffDataConnect; if (!dc) return; const code = vesselForm.code.trim().toUpperCase(); if (!code || !vesselForm.name.trim() || !Number.isInteger(vesselForm.capacity) || vesselForm.capacity < 1) { formError.value = 'Enter a code, name, and valid capacity.'; return } const associated = sailings.value.filter(s => s.vessel.name === vesselForm.name); if (editingId.value && associated.some(s => s.vessel.passengerCapacity - s.availableSeats > vesselForm.capacity)) { formError.value = 'Capacity cannot be below seats already booked.'; return } await mutate('vessel', () => editingId.value ? adminUpdateVessel(dc, { id: editingId.value, name: vesselForm.name, capacity: vesselForm.capacity, isActive: vesselForm.isActive }) : adminCreateVessel(dc, { code, name: vesselForm.name, capacity: vesselForm.capacity })) }
function toLocalDateTime(value: string) {
  const date = new Date(value)
  const part = (number: number) => String(number).padStart(2, '0')
  return `${date.getFullYear()}-${part(date.getMonth() + 1)}-${part(date.getDate())}T${part(date.getHours())}:${part(date.getMinutes())}`
}
function canEditTrip(sailing: AdminSailingsData['sailings'][number]) { return sailing.status === 'SCHEDULED' || sailing.status === 'DELAYED' }
function nextStatuses(sailing: AdminSailingsData['sailings'][number]) {
  const options: Record<string, string[]> = { SCHEDULED: ['BOARDING', 'DELAYED'], DELAYED: ['SCHEDULED', 'BOARDING'], BOARDING: ['COMPLETED'] }
  return [sailing.status, ...(options[sailing.status] || [])]
}
async function openTripEditor(sailing: AdminSailingsData['sailings'][number]) {
  if (!canEditTrip(sailing) || !staffDataConnect) return
  editingId.value = sailing.code
  formError.value = ''
  tripBookings.value = []
  tripBookingsLoaded.value = false
  tripEditLoading.value = true
  Object.assign(tripForm, {
    code: sailing.code, originPortId: sailing.origin.id, destinationPortId: sailing.destination.id,
    vesselId: sailing.vessel.id, departureAt: toLocalDateTime(sailing.departureAt), arrivalAt: toLocalDateTime(sailing.arrivalAt),
    regularFare: sailing.regularFare, studentFare: sailing.studentFare, seniorFare: sailing.seniorFare,
    childFare: sailing.childFare, pwdFare: sailing.pwdFare,
  })
  modal.value = 'trip'
  try {
    const result = await adminSailingBookings(staffDataConnect, { code: sailing.code }, { fetchPolicy: 'SERVER_ONLY' })
    if (editingId.value !== sailing.code || modal.value !== 'trip') return
    tripBookings.value = result.data.bookings
    tripBookingsLoaded.value = true
  } catch (cause) { formError.value = dataConnectRequestError(cause, 'Could not check reservations. Close and try again.') }
  finally { tripEditLoading.value = false }
}
async function saveTrip() {
  const dc = staffDataConnect
  if (!dc || busy.value || (editingId.value && !tripBookingsLoaded.value)) return
  if ((!editingId.value || (editingTrip.value && tripForm.vesselId !== editingTrip.value.vessel.id)) && !tripVesselFares.value) { formError.value = 'Save fare settings for the selected vessel before creating or switching a trip.'; return }
  const departure = new Date(tripForm.departureAt), arrival = new Date(tripForm.arrivalAt)
  const valid = tripForm.code.trim() && tripForm.originPortId && tripForm.destinationPortId && tripForm.vesselId &&
    tripForm.originPortId !== tripForm.destinationPortId && Number.isFinite(departure.getTime()) &&
    Number.isFinite(arrival.getTime()) && departure > new Date() && arrival > departure &&
    fareTypes.every(type => Number.isSafeInteger(tripForm[type.key]) && tripForm[type.key] > 0 && tripForm[type.key] <= 2147483647)
  if (!valid) { formError.value = 'Choose different ports, an active vessel, future departure and later arrival, and positive fares.'; return }
  if (editingId.value && tripHasBookings.value && !tripScheduleChanged.value) { formError.value = 'Change the departure or arrival time before rescheduling.'; return }
  const schedule = { code: tripForm.code.trim().toUpperCase(), departureAt: departure.toISOString(), arrivalAt: arrival.toISOString(), durationMinutes: Math.round((arrival.getTime() - departure.getTime()) / 60000) }
  if (editingId.value && tripHasBookings.value && !window.confirm(`Reschedule ${schedule.code}? Account holders will receive a notification. Contact walk-in passengers directly.`)) return
  busy.value = 'trip'; formError.value = ''; error.value = ''; notice.value = ''
  try {
    if (!editingId.value) {
      const result = await adminCreateSailing(dc, { ...schedule, originPortId: tripForm.originPortId, destinationPortId: tripForm.destinationPortId, vesselId: tripForm.vesselId, regularFare: tripForm.regularFare, studentFare: tripForm.studentFare, seniorFare: tripForm.seniorFare, childFare: tripForm.childFare, pwdFare: tripForm.pwdFare })
      notice.value = `${result.data.sailing_insert.code} created.`
    } else if (tripHasBookings.value) {
      const result = await adminRescheduleSailing(dc, schedule)
      if (!result.data.sailing_update) throw new Error('The sailing was not updated.')
      notice.value = `${schedule.code} rescheduled. ${result.data.notified} account(s) notified.`
    } else {
      const result = await adminUpdateUnbookedSailing(dc, { ...schedule, originPortId: tripForm.originPortId, destinationPortId: tripForm.destinationPortId, vesselId: tripForm.vesselId, regularFare: tripForm.regularFare, studentFare: tripForm.studentFare, seniorFare: tripForm.seniorFare, childFare: tripForm.childFare, pwdFare: tripForm.pwdFare })
      if (!result.data.sailing_update) throw new Error('The sailing was not updated.')
      notice.value = `${schedule.code} updated.`
    }
    modal.value = ''
    await loadData()
  } catch (cause) { formError.value = dataConnectRequestError(cause, 'Could not save this trip.') }
  finally { busy.value = '' }
}
const sailingStatuses = ['SCHEDULED', 'BOARDING', 'DELAYED', 'COMPLETED']
async function changeSailingStatus(s: AdminSailingsData['sailings'][number], event: Event) {
  const dc = staffDataConnect
  if (!dc) return
  const select = event.target as HTMLSelectElement
  const status = select.value
  if (status === s.status) return
  if (!window.confirm(`Set ${s.code} to ${status}? Account holders with active bookings will receive a notification. Contact walk-in passengers directly.`)) { select.value = s.status; return }
  busy.value = s.code; error.value = ''; notice.value = ''
  try {
    const result = await adminUpdateSailingStatus(dc, { code: s.code, status })
    if (!result.data.sailing_update) throw new Error('The trip was not updated.')
    const refreshed = await adminSailings(dc,{fetchPolicy:'SERVER_ONLY'})
    sailings.value = refreshed.data.sailings
    notice.value = `${s.code} status changed to ${status}. ${result.data.notified ?? 0} account(s) notified.`
  } catch (e) {
    select.value = s.status
    error.value = dataConnectRequestError(e, 'Could not update the trip.')
  } finally { busy.value = '' }
}
async function processTicket(p: AdminPassengerRecordsData['bookingPassengers'][number], action: 'check-in' | 'boarding') {
  const dc = staffDataConnect
  if (!dc || busy.value) return
  const reason = ticketActionBlockReason(p, action)
  if (reason) { error.value = reason; return }
  if (!window.confirm(`${action === 'check-in' ? 'Check in' : 'Board'} ${p.fullName} for ${p.booking.sailing.code}?`)) return
  busy.value = p.id; error.value = ''; notice.value = ''
  try {
    if (action === 'check-in') await checkInTicket(dc, { passengerId: p.id })
    else await boardTicket(dc, { passengerId: p.id })
    await loadData()
    notice.value = `${p.fullName} ${action === 'check-in' ? 'checked in' : 'boarded'} for ${p.booking.sailing.code}.`
  } catch (cause) {
    const message = ticketRequestError(cause, 'The ticket or sailing has changed. Refresh and check the ticket, payment, and sailing status before trying again.')
    await loadData()
    error.value = message
  } finally { busy.value = '' }
}
async function generatePassword() {
  if (busy.value) return
  if (!functions) { formError.value = 'The account service is unavailable.'; return }
  busy.value = 'password'; formError.value = ''
  try {
    const result = await httpsCallable<null, { password: string }>(functions, 'generateTemporaryPassword')(null)
    if (typeof result.data.password !== 'string' || result.data.password.length < 8) throw new Error('Could not generate a password. Try again.')
    userForm.password = result.data.password
  } catch (e) { formError.value = accountRequestError(e, 'Could not generate a password. Try again.') }
  finally { busy.value = '' }
}
async function saveUser() {
  if (busy.value) return
  if (!functions) { formError.value = 'The account service is unavailable.'; return }
  busy.value = 'user'; formError.value = ''
  const account = { ...userForm }
  try {
    const result = await httpsCallable<typeof userForm, { email: string; role: string }>(functions, 'createManagedUser')(account)
    createdAccount.value = { email: result.data.email, role: result.data.role, password: account.password }
    await loadData()
  } catch (e) { formError.value = accountRequestError(e, 'Could not create account. Try again.') }
  finally { busy.value = '' }
}
async function copyPassword() { if (createdAccount.value) await navigator.clipboard.writeText(createdAccount.value.password) }

const filterOptions = computed(() => ({ bookings: ['AWAITING PAYMENT', 'PAID', 'CANCELLED'], passengers: ['PAYMENT PENDING', 'ISSUED', 'CHECKED_IN', 'BOARDED', 'CANCELLED'], trips: sailingStatuses, 'check-in': ['ISSUED', 'CHECKED_IN', 'BOARDED'], boarding: ['ISSUED', 'CHECKED_IN', 'BOARDED'], users: ['PASSENGER', 'TICKETING', 'BOARDING', 'ADMIN'] } as Record<string, string[]>)[section.value] || [])
const columns = computed(() => ({ bookings: ['Reference', 'Account', 'Route', 'Departure', 'Passengers', 'Total', 'Status'], passengers: ['Passenger', 'Type', 'Booking', 'Sailing', 'Account', 'Ticket'], trips: ['Trip', 'Route', 'Vessel', 'Departure', 'Booked', 'Status'], ports: ['Code', 'Port', 'Location', 'Status'], vessels: ['Code', 'Vessel', 'Capacity', 'Status'], 'check-in': ['Passenger', 'Booking', 'Sailing', 'Departure', 'Ticket'], boarding: ['Passenger', 'Booking', 'Sailing', 'Checked in', 'Ticket', 'Sailing status'], manifest: ['Passenger', 'Sex', 'Type', 'Booking', 'Sailing', 'Ticket', 'Boarded at'], users: ['Name', 'Email', 'Role', 'Created'] } as Record<string, string[]>)[section.value] || [])
const hasRowAction = computed(() => ['bookings', 'trips', 'ports', 'vessels', 'check-in', 'boarding'].includes(section.value))
type Row = { key: string; cells: (string | number)[]; source: any; statusIndex?: number }
const rows = computed<Row[]>(() => {
  let output: Row[] = []
  if (section.value === 'bookings') output = bookings.value.map(b => ({ key: b.reference, source: b, statusIndex: 6, cells: [b.reference, b.owner.fullName, `${b.sailing.origin.name} → ${b.sailing.destination.name}`, dateTime(b.sailing.departureAt), b.passengerCount, `PHP ${b.total.toLocaleString()}`, b.status === 'CANCELLED' ? 'CANCELLED' : b.paymentStatus === 'PAID' ? 'PAID' : 'AWAITING PAYMENT'] }))
  if (section.value === 'passengers' || ['check-in', 'boarding', 'manifest'].includes(section.value)) output = passengers.value.filter(p => (p.booking.status === 'CONFIRMED' && p.booking.paymentStatus === 'PAID') || section.value === 'passengers').filter(p => sailingFilter.value === 'ALL' || p.booking.sailing.code === sailingFilter.value).map(p => ({ key: p.id, source: p, statusIndex: section.value === 'manifest' ? 5 : section.value === 'passengers' ? 5 : 4, cells: section.value === 'manifest' ? [p.fullName, p.sex || '—', p.passengerType, p.booking.reference, p.booking.sailing.code, p.ticketStatus, p.boardedAt ? dateTime(p.boardedAt) : '—'] : section.value === 'passengers' ? [p.fullName, p.passengerType, p.booking.reference, p.booking.sailing.code, p.booking.owner.fullName, p.booking.status === 'CANCELLED' ? 'CANCELLED' : p.booking.paymentStatus === 'PAID' ? p.ticketStatus : 'PAYMENT PENDING'] : [p.fullName, p.booking.reference, p.booking.sailing.code, section.value === 'check-in' ? dateTime(p.booking.sailing.departureAt) : p.checkedInAt ? dateTime(p.checkedInAt) : '—', p.ticketStatus].concat(section.value === 'boarding' ? [p.booking.sailing.status] : []) }))
  if (section.value === 'trips') output = sailings.value.map(s => ({ key: s.code, source: s, statusIndex: 5, cells: [s.code, routeLabel(s), s.vessel.name, dateTime(s.departureAt), `${s.vessel.passengerCapacity - s.availableSeats} / ${s.vessel.passengerCapacity}`, s.status] }))
  if (section.value === 'ports') output = ports.value.map(p => ({ key: p.id, source: p, statusIndex: 3, cells: [p.code, p.name, `${p.city}${p.region ? `, ${p.region}` : ''}`, p.isActive ? 'ACTIVE' : 'INACTIVE'] }))
  if (section.value === 'vessels') output = vessels.value.map(v => ({ key: v.id, source: v, statusIndex: 3, cells: [v.code, v.name, v.passengerCapacity, v.isActive ? 'ACTIVE' : 'INACTIVE'] }))
  if (section.value === 'users') output = users.value.map(u => ({ key: u.uid, source: u, cells: [u.fullName, u.email, u.role, dateTime(u.createdAt)] }))
  const q = search.value.toLowerCase(); return output.filter(r => (statusFilter.value === 'ALL' || (section.value === 'users' ? r.source.role : section.value === 'bookings' ? r.cells[6] : section.value === 'passengers' ? r.cells[5] : section.value === 'trips' ? r.source.status : r.source.ticketStatus) === statusFilter.value) && (!q || r.cells.join(' ').toLowerCase().includes(q)))
})
</script>

<style scoped>
.fare-settings-panel { width: 100%; }
.fare-vessel-picker { display: grid; grid-template-columns: minmax(0, 1fr) minmax(220px, 340px); gap: 24px; align-items: center; padding: 24px 26px; margin-bottom: 22px; }
.fare-vessel-picker h2 { margin: 7px 0; font-size: 18px; }
.fare-vessel-picker p:last-child { margin: 0; color: var(--muted); font-size: 12px; line-height: 1.6; }
.fare-vessel-picker select { width: 100%; min-height: 46px; padding: 10px 12px; border: 1px solid var(--line); border-radius: 10px; color: var(--ink); background: var(--surface-soft); font: inherit; font-size: 13px; }
.fare-vessel-picker select:focus-visible { outline: 2px solid var(--ocean); outline-offset: 2px; }
.fare-config-status { display: inline-block; margin-top: 10px; padding: 4px 8px; border-radius: 6px; color: var(--muted); background: var(--surface-soft); font-size: 10px; font-weight: 700; }
.fare-config-status.configured { color: var(--ocean); background: var(--light-blue); }
.fare-vessel-note { margin: -6px 0 20px; color: var(--muted); font-size: 12px; line-height: 1.6; }
.fare-vessel-note a { color: var(--ocean); }
@media (max-width: 600px) { .fare-vessel-picker { grid-template-columns: 1fr; gap: 16px; padding: 20px; } }
.fare-settings-panel fieldset { border: 0; padding: 0; margin: 0; min-width: 0; }
.modal-body form > fieldset { display: grid; gap: 16px; border: 0; padding: 0; margin: 0; min-width: 0; }
.workspace > .topbar { background: var(--surface); }
.admin-breadcrumbs { display: flex; align-items: center; gap: 8px; min-width: 0; color: var(--muted); font-size: 12px; }
.admin-breadcrumbs > ion-icon { flex: none; color: var(--ocean); font-size: 14px; }
.admin-breadcrumbs > strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ink); }
.admin-profile-chip { display: flex; align-items: center; gap: 9px; flex: none; margin-left: auto; padding: 4px 12px 4px 4px; border: 1px solid var(--line); border-radius: 999px; background: var(--surface-soft); color: var(--ink); }
.admin-profile-icon { display: grid; place-items: center; flex: none; width: 32px; height: 32px; border: 1px solid var(--line); border-radius: 10px; background: var(--light-blue); color: var(--ocean); }
.admin-profile-icon ion-icon { font-size: 17px; }
.admin-profile-copy { display: grid; gap: 2px; }
.topbar .admin-profile-copy strong { max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; }
.admin-profile-copy small { color: var(--muted); font-size: 9px; }
@media (max-width: 540px) { .admin-breadcrumbs > span, .admin-breadcrumbs > ion-icon { display: none; } .topbar { gap: 10px; } .topbar .admin-breadcrumbs > strong { font-size: 12px; } .topbar .admin-profile-copy strong { max-width: 95px; font-size: 10px; } .admin-profile-copy small { font-size: 8px; } .admin-profile-chip { padding-right: 9px; gap: 7px; } }
.fare-layout { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(280px, 1fr); gap: 22px; align-items: start; }
.fare-editor { display: grid; gap: 22px; min-width: 0; }
.fare-card { padding: 26px; }
.fare-card-heading { display: flex; align-items: center; gap: 13px; margin-bottom: 24px; }
.fare-card-icon { display: grid; place-items: center; flex: 0 0 42px; height: 42px; border-radius: 12px; background: var(--light-blue); color: var(--ocean); font-size: 21px; }
.fare-card h2, .fare-preview-heading h2 { margin: 0; font-size: 18px; letter-spacing: -.02em; }
.fare-card-heading p, .fare-preview-heading > p:last-child { margin: 6px 0 0; color: var(--muted); font-size: 12px; line-height: 1.5; }
.fare-settings-panel label { display: block; margin-bottom: 8px; font-size: 12px; font-weight: 700; }
.fare-input { display: flex; align-items: center; gap: 10px; min-width: 0; border: 1px solid var(--line); border-radius: 10px; background: var(--surface-soft); transition: border-color .15s, box-shadow .15s; }
.fare-input:focus-within { border-color: var(--ocean); box-shadow: 0 0 0 3px var(--light-blue); }
.fare-input > span { padding-right: 14px; color: var(--muted); font-size: 13px; font-weight: 700; }
.fare-input input { width: 100%; min-width: 0; min-height: 46px; padding: 12px 14px; border: 0; border-radius: 10px; outline: none; background: transparent; color: var(--ink); font: inherit; font-size: 15px; font-weight: 700; }
.fare-input input:focus-visible { outline: 2px solid var(--ocean); outline-offset: -3px; }
.fare-base-input > span { padding: 0 0 0 16px; color: var(--ocean); }
.fare-base-input input { min-height: 60px; font-size: 25px; }
.fare-hint { margin: 10px 0 0; color: var(--muted); font-size: 11px; line-height: 1.6; }
.fare-discount-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 22px 18px; }
.fare-discount-field small { display: block; margin-top: 8px; color: var(--muted); font-size: 11px; line-height: 1.5; }
.fare-preview-card { padding: 26px; }
.fare-preview-heading { margin-bottom: 22px; }
.fare-preview-heading .eyebrow { margin-bottom: 8px; }
.fare-preview { display: grid; }
.fare-preview > div { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 17px 0; border-bottom: 1px solid var(--line); }
.fare-preview > div:last-child { border-bottom: 0; }
.fare-preview span { font-size: 13px; font-weight: 700; }
.fare-preview span small { display: block; margin-top: 5px; color: var(--muted); font-size: 11px; font-weight: 400; }
.fare-preview strong { flex-shrink: 0; font-size: 16px; font-variant-numeric: tabular-nums; }
.fare-preview > .fare-preview-regular { margin: 0 -10px 3px; padding: 16px 10px; border: 0; border-radius: 10px; background: var(--light-blue); }
.fare-preview-regular strong { color: var(--ocean); font-size: 20px; }
.fare-preview-note { display: flex; align-items: start; gap: 9px; margin: 18px 0 0; padding-top: 18px; border-top: 1px solid var(--line); color: var(--muted); font-size: 11px; line-height: 1.6; }
.fare-preview-note ion-icon { flex-shrink: 0; margin-top: 2px; font-size: 16px; color: var(--ocean); }
.fare-save-bar { display: flex; align-items: center; justify-content: space-between; gap: 20px; margin-top: 22px; padding: 20px 26px; }
.fare-save-bar strong { font-size: 13px; }
.fare-save-bar p { margin: 5px 0 0; color: var(--muted); font-size: 11px; line-height: 1.5; }
.fare-save-bar .primary { flex-shrink: 0; min-height: 44px; }
.fare-settings-panel fieldset:disabled .fare-input { opacity: .6; }
@media (min-width: 951px) and (max-width: 1150px), (max-width: 760px) { .fare-layout { grid-template-columns: 1fr; } }
@media (max-width: 480px) { .fare-card, .fare-preview-card { padding: 20px; } .fare-card-heading { align-items: start; } .fare-discount-grid { gap: 18px 12px; } .fare-save-bar { align-items: stretch; flex-direction: column; padding: 20px; gap: 16px; } .fare-save-bar .primary { width: 100%; } }
input[readonly] { opacity: .8; }

.shell{min-height:100vh;display:flex;background:var(--cloud,#f5f7fa);color:var(--ink,#172033)}.sidebar{position:sticky;top:0;width:238px;min-width:238px;height:100vh;padding:24px 14px;display:flex;flex-direction:column;background:#0b2134;border-right:1px solid #28445b}.sidebar :deep(.brand-copy strong),.sidebar :deep(.brand-copy b){color:white}.sidebar nav{overflow-y:auto;scrollbar-width:thin;scrollbar-color:#41617a transparent;flex:1;margin-top:24px}.nav-group{display:grid;gap:3px;margin:0 0 18px}.nav-group>span{margin:0 10px 7px;color:#85abc2;font-size:10px;font-weight:800;letter-spacing:.12em}.nav-group a,.logout{display:flex;align-items:center;gap:10px;padding:11px 12px;border:0;border-radius:9px;background:transparent;color:#b8cfe0;font-size:13px;text-decoration:none;text-align:left;cursor:pointer}.nav-group a:hover,.nav-group a.active{background:#174266;color:#fff}.nav-group ion-icon,.logout ion-icon{font-size:18px}.logout{width:100%;margin-top:10px;border-top:1px solid #28445b;border-radius:0}.workspace{flex:1;min-width:0}.topbar{height:72px;display:flex;align-items:center;gap:15px;padding:0 32px;border-bottom:1px solid var(--line,#26394d)}.topbar strong{font-size:13px}.topbar strong span{color:var(--muted,#9db2c5);font-weight:500}.menu-button{display:none}.content{max-width:1400px;margin:auto;padding:34px 32px 70px}.heading{display:flex;justify-content:space-between;align-items:end;gap:20px;margin-bottom:26px}.heading h1{margin:5px 0;font-size:30px}.heading p:last-child{margin:0;color:var(--muted,#9db2c5);font-size:13px}.eyebrow{margin:0;color:var(--ocean,#1565c0);font-size:10px;font-weight:800;letter-spacing:.13em}.heading-actions{display:flex;gap:9px}.primary,.secondary{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:38px;padding:0 15px;border:1px solid #4aaaf0;border-radius:9px;background:#50a9eb;color:#071a29;font:inherit;font-size:12px;font-weight:800;cursor:pointer}.secondary{background:transparent;color:var(--ocean,#1565c0);border-color:var(--ocean,#1565c0)}.primary:disabled,.secondary:disabled{opacity:.5;cursor:wait}.metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-bottom:20px}.metrics article,.panel{border:1px solid var(--line,#2c455c);border-radius:15px;background:var(--surface,#142539)}.metrics article{display:grid;gap:8px;padding:22px}.metrics small,.metrics span,.flow small{color:var(--muted,#9db2c5);font-size:11px}.metrics strong{font-size:27px}.dashboard-grid{display:grid;grid-template-columns:minmax(0,2fr) minmax(270px,1fr);gap:18px}.panel{min-width:0;overflow:hidden}.panel-head{display:flex;align-items:center;justify-content:space-between;gap:15px;padding:22px 22px 14px}.panel-head h2,.flow h2{margin:5px 0 0;font-size:19px}.panel-head a,.count{color:var(--ocean,#1565c0);font-size:12px;text-decoration:none}.flow{padding:22px}.flow-row{display:flex;justify-content:space-between;margin-top:22px;color:var(--muted,#9db2c5);font-size:13px}.flow-row strong{color:var(--ink,#fff)}.progress{height:9px;margin:25px 0 10px;border-radius:9px;background:#274258;overflow:hidden}.progress i{display:block;height:100%;background:#51afe9}.toolbar{display:flex;gap:10px;margin-bottom:15px}.toolbar input,.toolbar select,td select,.modal-body input,.modal-body select{min-height:39px;padding:0 12px;border:1px solid var(--line,#35536a);border-radius:8px;background:var(--surface,#142539);color:var(--ink,#fff);font:inherit;font-size:12px}.toolbar input{flex:1;min-width:180px}.toolbar select{max-width:300px}.table-wrap{overflow-x:auto}table{width:100%;border-collapse:collapse;white-space:nowrap}th,td{padding:13px 19px;border-bottom:1px solid var(--line,#2a4155);font-size:12px;text-align:left}th{color:var(--muted,#9db2c5);font-size:10px;text-transform:uppercase;letter-spacing:.08em}tbody tr:last-child td{border-bottom:0}td{color:var(--ink,#fff)}td strong{color:var(--ink,#172033)}.status{display:inline-block;padding:5px 8px;border-radius:8px;background:#164262;color:#8dd1fb;font-size:11px;font-weight:750}.empty{text-align:center;color:var(--muted,#9db2c5);padding:28px}.table-foot{margin:0;padding:14px 20px;border-top:1px solid var(--line,#2a4155);color:var(--muted,#9db2c5);font-size:11px}.text-action{padding:6px 10px;border:1px solid #407399;border-radius:7px;background:transparent;color:var(--ocean,#1565c0);font:inherit;font-size:11px;cursor:pointer}.text-action.danger{color:#ff9e9e;border-color:#7a4850}.text-action:disabled{opacity:.4;cursor:not-allowed}.alert,.notice{margin:0 0 18px;padding:12px 14px;border-radius:9px;background:#542e3a;color:#ffd5dc;font-size:12px}.notice{background:#164d44;color:#b9f4df}.report-metrics{margin-bottom:20px}.scrim{display:none}.modal-body{width:min(94vw,580px);max-height:86vh;overflow-y:auto;margin:7vh auto;padding:24px;border:1px solid #35536a;border-radius:16px;background:#142539;color:#fff}.modal-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}.modal-head h2{margin:0;font-size:21px}.modal-head button{border:0;background:transparent;color:#fff;font-size:22px;cursor:pointer}.modal-body form{display:grid;gap:13px}.modal-body label{display:grid;gap:6px;font-size:12px;font-weight:700}.modal-body input,.modal-body select{width:100%}.modal-body .primary{margin-top:5px}.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.fares{grid-template-columns:repeat(3,1fr)}.form-note{margin:0;color:#aad0e8;font-size:12px}.checkbox{display:flex!important;align-items:center}.checkbox input{width:auto}.copy-row{display:flex;gap:8px}.copy-row>*:first-child{flex:1;min-width:0}.copy-row button{border:1px solid #4f82a8;border-radius:7px;background:#234763;color:#d7f0ff;cursor:pointer}.created{display:grid;gap:12px}.created p{margin:0;color:#bed3e0}.created code{padding:10px;border:1px solid #3c607d;border-radius:8px;word-break:break-all}@media(max-width:950px){.sidebar{position:fixed;z-index:20;left:0;transform:translateX(-100%);transition:transform .2s}.sidebar.open{transform:none}.scrim{display:block;position:fixed;z-index:19;inset:0;border:0;background:#0009}.menu-button{display:grid;place-items:center;width:36px;height:36px;border:1px solid #35536a;border-radius:8px;background:transparent;color:#fff;font-size:20px}.dashboard-grid{grid-template-columns:1fr}.metrics{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:600px){.topbar{height:62px;padding:0 16px}.account{display:none}.content{padding:24px 14px 60px}.heading{align-items:start;flex-direction:column}.heading h1{font-size:25px}.heading-actions{width:100%}.heading-actions button{flex:1}.metrics{gap:9px}.metrics article{padding:15px}.metrics strong{font-size:23px}.toolbar{flex-wrap:wrap}.toolbar input{flex-basis:100%}.toolbar select{flex:1;min-width:0}.panel-head{padding:18px 15px 12px}.form-grid,.fares{grid-template-columns:1fr 1fr}.modal-body{margin:3vh auto;max-height:94vh;padding:18px}}
.trip-row-actions{display:flex;align-items:center;gap:8px}.trip-row-actions select{min-width:112px}.trip-edit-note{margin:0;padding:11px 12px;border:1px solid var(--line);border-radius:9px;background:var(--surface-soft);color:var(--ink);font-size:12px;line-height:1.5}.modal-body input[readonly]{opacity:.75;cursor:default}
.trip-modal { --width: min(940px, calc(100vw - 40px)); --height: auto; --max-height: calc(100dvh - 48px); --border-radius: 20px; --background: var(--surface); --box-shadow: 0 24px 80px #0004; }
.modal-body.trip-dialog { display: flex; flex-direction: column; width: 100%; max-height: calc(100dvh - 48px); margin: 0; padding: 0; overflow: hidden; border: 0; border-radius: 0; background: var(--surface); color: var(--ink); }
.trip-dialog .modal-head { flex-shrink: 0; margin: 0; padding: 24px 28px; border-bottom: 1px solid var(--line); }
.trip-modal-title { display: flex; align-items: center; gap: 14px; }
.trip-title-icon { display: grid; place-items: center; width: 46px; height: 46px; flex-shrink: 0; border-radius: 13px; background: var(--light-blue); color: var(--ocean); font-size: 25px; }
.trip-modal-title .eyebrow { margin-bottom: 6px; font-size: 9px; }
.trip-dialog .modal-head h2 { font-size: 22px; letter-spacing: -.03em; }
.trip-subtitle { margin: 6px 0 0; color: var(--muted); font-size: 12px; line-height: 1.5; }
.trip-dialog .modal-head > button { display: grid; place-items: center; width: 34px; height: 34px; flex-shrink: 0; border-radius: 9px; color: var(--muted); background: var(--surface-soft); }
.trip-dialog .modal-head > button:hover { color: var(--ink); background: var(--light-blue); }
.trip-dialog > .alert { flex-shrink: 0; margin: 16px 28px 0; }
.trip-dialog .trip-form { display: flex; flex-direction: column; gap: 0; min-height: 0; overflow: hidden; }
.trip-scroll { min-height: 0; padding: 24px 28px; overflow-y: auto; scrollbar-width: thin; }
.trip-code-banner { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 6px 16px; margin-bottom: 22px; padding: 15px 18px; border: 1px solid var(--line); border-radius: 12px; background: var(--surface-soft); }
.trip-dialog .trip-code-banner label { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; color: var(--muted); font-size: 11px; }
.trip-dialog .trip-code-banner input { width: 180px; min-height: 26px; padding: 0; border: 0; background: transparent; color: var(--ink); opacity: 1; font-size: 13px; font-weight: 800; letter-spacing: .025em; }
.trip-code-badge { padding: 5px 8px; border-radius: 6px; background: var(--light-blue); color: var(--ocean); font-size: 10px; font-weight: 700; }
.trip-code-banner > p { grid-column: 1 / -1; margin: 0; color: var(--muted); font-size: 11px; line-height: 1.5; }
.trip-callout { display: flex; align-items: start; gap: 12px; padding: 14px 16px; margin-bottom: 20px; border: 1px solid var(--line); border-radius: 12px; background: var(--light-blue); }
.trip-callout > ion-icon { flex-shrink: 0; color: var(--ocean); font-size: 19px; margin-top: 1px; }
.trip-callout strong { font-size: 12px; }
.trip-callout p { margin: 4px 0 0; color: var(--muted); font-size: 11px; line-height: 1.6; }
.trip-grid { display: grid; grid-template-columns: minmax(0, 1.55fr) minmax(240px, 1fr); gap: 20px; align-items: start; }
.trip-details { display: grid; gap: 20px; min-width: 0; }
.trip-section { display: grid; gap: 17px; min-width: 0; padding: 20px; border: 1px solid var(--line); border-radius: 13px; }
.trip-section-heading { display: flex; align-items: center; gap: 10px; }
.trip-section-heading > span { display: grid; place-items: center; width: 34px; height: 34px; flex-shrink: 0; border-radius: 9px; background: var(--light-blue); color: var(--ocean); font-size: 18px; }
.trip-section-heading h3 { margin: 0; font-size: 14px; letter-spacing: -.02em; }
.trip-section-heading p { margin: 4px 0 0; color: var(--muted); font-size: 10px; line-height: 1.5; }
.trip-lock-badge { display: inline-flex; align-items: center; gap: 4px; margin-left: auto; color: var(--muted); font-size: 9px; }
.trip-dialog label { color: var(--ink); font-size: 11px; gap: 8px; }
.trip-dialog select, .trip-dialog input { min-width: 0; min-height: 44px; padding: 10px 11px; border: 1px solid var(--line); background: var(--surface-soft); color: var(--ink); font-size: 12px; color-scheme: light; }
.trip-dialog input:focus-visible, .trip-dialog select:focus-visible, .trip-dialog button:focus-visible { outline: 2px solid var(--ocean); outline-offset: 2px; }
.trip-dialog input:disabled, .trip-dialog select:disabled { opacity: .65; cursor: not-allowed; }
.trip-dialog input[readonly] { opacity: 1; }
.trip-field-hint { display: flex; align-items: start; gap: 6px; margin: 0; color: var(--muted); font-size: 10px; line-height: 1.6; }
.trip-field-hint ion-icon { flex-shrink: 0; margin-top: 1px; color: var(--ocean); font-size: 14px; }
.trip-fare-section { background: var(--surface-soft); }
.trip-fare-values { display: grid; gap: 12px; }
.trip-dialog .trip-regular-fare { padding: 14px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); color: var(--muted); }
.trip-dialog .trip-regular-fare input { min-height: 36px; padding: 4px 0; border: 0; border-radius: 4px; background: transparent; color: var(--ocean); font-size: 27px; font-weight: 800; }
.trip-discount-fares { display: grid; }
.trip-dialog .trip-discount-fares label { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--line); }
.trip-discount-fares label:last-child { border-bottom: 0; }
.trip-discount-fares label > span { display: grid; gap: 4px; }
.trip-discount-fares small { color: var(--muted); font-size: 9px; font-weight: 500; }
.trip-dialog .trip-discount-fares input { width: 110px; min-height: 30px; padding: 4px 0; border: 0; background: transparent; text-align: right; font-size: 15px; font-weight: 700; }
.trip-discount-fares input::-webkit-inner-spin-button { appearance: none; margin: 0; }
.trip-discount-fares input { -moz-appearance: textfield; }
.trip-fares-empty { display: grid; justify-items: center; gap: 10px; padding: 28px 10px; text-align: center; }
.trip-fares-empty ion-icon { color: var(--ocean); font-size: 30px; }
.trip-fares-empty strong { font-size: 12px; }
.trip-fares-empty p { margin: 0; color: var(--muted); font-size: 11px; line-height: 1.6; }
.trip-fare-warning { margin: 0; padding: 11px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface); color: var(--muted); font-size: 11px; line-height: 1.6; }
.trip-fare-warning a { color: var(--ocean); }
.trip-form-footer { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-shrink: 0; padding: 18px 28px; border-top: 1px solid var(--line); background: var(--surface); }
.trip-form-footer > span { display: flex; align-items: center; gap: 7px; color: var(--muted); font-size: 11px; }
.trip-form-footer > span ion-icon { font-size: 16px; color: var(--ocean); }
.trip-form-footer > div { display: flex; gap: 9px; }
.trip-dialog .trip-form-footer button { min-height: 42px; margin: 0; padding: 0 18px; }
:global(:root[data-theme='dark'] .trip-dialog input), :global(:root[data-theme='dark'] .trip-dialog select) { color-scheme: dark; }
@media (max-width: 740px) { .trip-grid { grid-template-columns: 1fr; } .trip-dialog .modal-head { padding: 20px; } .trip-scroll { padding: 20px; } .trip-form-footer { padding: 16px 20px; } .trip-form-footer > span { display: none; } .trip-form-footer > div { width: 100%; } .trip-form-footer button { flex: 1; } }
@media (max-width: 480px) { .trip-modal { --width: calc(100vw - 16px); --max-height: calc(100dvh - 24px); --border-radius: 14px; } .modal-body.trip-dialog { max-height: calc(100dvh - 24px); } .trip-title-icon { display: none; } .trip-dialog .modal-head h2 { font-size: 20px; } .trip-code-banner { padding: 12px; gap: 8px; } .trip-code-badge { font-size: 9px; } .trip-dialog .trip-code-banner label { gap: 4px; } .trip-dialog .trip-code-banner input { width: 158px; font-size: 12px; } .trip-section { padding: 16px; } .trip-dialog .form-grid { grid-template-columns: 1fr; } }
.boarding-help { display: flex; align-items: start; gap: 10px; margin: 0 0 18px; padding: 14px 16px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); color: var(--muted); font-size: 12px; line-height: 1.6; }
.boarding-help > ion-icon { flex-shrink: 0; margin-top: 2px; color: var(--ocean); font-size: 18px; }
.boarding-help a { color: var(--ocean); }
.boarding-row-action { display: flex; align-items: center; }
.boarding-row-action .text-action { display: inline-flex; align-items: center; justify-content: center; min-width: 70px; min-height: 32px; }
</style>
