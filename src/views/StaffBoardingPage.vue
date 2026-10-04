<template>
  <ion-page>
    <ion-content ref="contentRef" :fullscreen="true">
      <div class="boarding-shell">
        <button v-if="menuOpen" class="scrim" aria-label="Close navigation" @click="menuOpen = false"></button>
        <aside id="boarding-sidebar" class="sidebar" :class="{ open: menuOpen }">
          <BrandMark />
          <nav aria-label="Boarding navigation">
            <p class="nav-caption">MY WORKSPACE</p>
            <button type="button" :class="{ active: activeSection === 'overview' }" :aria-current="activeSection === 'overview' ? 'location' : undefined" @click="scrollToSection('overview')"><ion-icon :icon="gridOutline" aria-hidden="true" />Overview</button>
            <button type="button" :class="{ active: activeSection === 'manifest' }" :aria-current="activeSection === 'manifest' ? 'location' : undefined" @click="scrollToSection('manifest')"><ion-icon :icon="peopleOutline" aria-hidden="true" />Passenger manifest</button>
            <button type="button" :class="{ active: activeSection === 'activity' }" :aria-current="activeSection === 'activity' ? 'location' : undefined" @click="scrollToSection('activity')"><ion-icon :icon="timeOutline" aria-hidden="true" />Gate activity</button>
            <p class="nav-caption">QUICK ACCESS</p>
            <router-link to="/staff/boarding/settings/account" @click="menuOpen = false"><ion-icon :icon="settingsOutline" aria-hidden="true" />Settings</router-link>
          </nav>
          <button class="logout" type="button" :disabled="busy" @click="logout"><ion-icon :icon="logOutOutline" aria-hidden="true" />Log out</button>
        </aside>

        <div class="main-column">
          <header class="topbar">
            <button class="menu-button" type="button" :aria-expanded="menuOpen" aria-controls="boarding-sidebar" aria-label="Toggle navigation" @click="menuOpen = !menuOpen"><ion-icon :icon="menuOpen ? closeOutline : menuOutline" /></button>
            <div class="breadcrumb">Staff workspace <ion-icon :icon="chevronForwardOutline" /> <strong>Boarding</strong></div>
            <div class="staff-chip" :title="staffName"><span><ion-icon :icon="scanOutline" aria-hidden="true" /></span><div><strong>{{ staffName }}</strong><small>Boarding staff</small></div></div>
          </header>

          <main id="overview" class="content">
            <div class="page-heading">
              <div><p class="eyebrow">BOARDING WORKSPACE</p><h1>Boarding desk</h1><p>Check in passengers and manage boarding for your sailing.</p></div>
              <div class="heading-actions"><button class="secondary-button" type="button" :disabled="loading || busy" @click="loadData"><ion-icon :icon="refreshOutline" />Refresh</button><button class="primary-button" type="button" :disabled="!selectedSailingCode || loading || busy" @click="openScanner"><ion-icon :icon="scanOutline" />Find ticket</button></div>
            </div>

            <div v-if="error" class="notice error" role="alert"><ion-icon :icon="alertCircleOutline" /><span>{{ error }}</span><button type="button" @click="error = ''" aria-label="Dismiss error"><ion-icon :icon="closeOutline" /></button></div>
            <div v-if="success" class="notice success" role="status"><ion-icon :icon="checkmarkCircleOutline" /><span>{{ success }}</span><button type="button" @click="success = ''" aria-label="Dismiss message"><ion-icon :icon="closeOutline" /></button></div>

            <section class="sailing-card" aria-label="Selected sailing">
              <div class="sailing-copy"><span class="sailing-icon"><ion-icon :icon="boatOutline" /></span><div><p class="eyebrow">SELECTED SAILING</p><h2 v-if="selectedSailing">{{ selectedSailing.origin.name }} <ion-icon :icon="arrowForwardOutline" /> {{ selectedSailing.destination.name }}</h2><h2 v-else>No available sailing</h2><p v-if="selectedSailing">{{ selectedSailing.vessel.name }} · {{ formatDate(selectedSailing.departureAt) }}</p><p v-else>Scheduled and boarding sailings appear here.</p></div></div>
              <div class="sailing-control"><label for="boarding-sailing">Sailing</label><select id="boarding-sailing" v-model="selectedSailingCode" :disabled="loading || busy || !sailings.length"><option v-for="sailing in sailings" :key="sailing.code" :value="sailing.code">{{ sailing.code }} · {{ sailing.origin.name }} to {{ sailing.destination.name }}</option></select><span v-if="selectedSailing" class="sailing-status" :class="selectedSailing.status.toLowerCase()">{{ selectedSailing.status }}</span></div>
            </section>

            <div v-if="selectedSailing" class="boarding-progress"><span>Boarding progress <strong>{{ boardedCount }} / {{ passengers.length }}</strong></span><div class="progress-track" role="progressbar" aria-label="Passengers boarded" :aria-valuenow="boardingPercent" aria-valuemin="0" aria-valuemax="100"><i :style="{ width: `${boardingPercent}%` }"></i></div><strong>{{ boardingPercent }}%</strong></div>

            <div v-if="selectedSailing && selectedSailing.status !== 'BOARDING'" class="gate-note"><ion-icon :icon="informationCircleOutline" /><span>Check-in is open. Boarding starts when the administrator sets this sailing to BOARDING.</span></div>

            <section class="stats" aria-label="Boarding totals">
              <article><span class="stat-icon blue"><ion-icon :icon="ticketOutline" /></span><div><small>VALID TICKETS</small><strong>{{ passengers.length }}</strong><p>Paid passenger tickets</p></div></article>
              <article><span class="stat-icon neutral"><ion-icon :icon="peopleOutline" /></span><div><small>AWAITING CHECK-IN</small><strong>{{ issuedCount }}</strong><p>Issued passenger tickets</p></div></article>
              <article><span class="stat-icon amber"><ion-icon :icon="scanOutline" /></span><div><small>CHECKED IN</small><strong>{{ checkedInCount }}</strong><p>Waiting to board</p></div></article>
              <article><span class="stat-icon green"><ion-icon :icon="checkmarkCircleOutline" /></span><div><small>BOARDED</small><strong>{{ boardedCount }}</strong><p>Recorded on this sailing</p></div></article>
            </section>

            <div class="workspace-grid">
              <section id="manifest" class="panel manifest-panel">
                <div class="panel-heading"><div><p class="eyebrow">PASSENGER MANIFEST</p><h2>Tickets for this sailing</h2><p>Select a passenger to review their ticket.</p></div><span class="count-pill">{{ filteredPassengers.length }} shown</span></div>
                <div class="manifest-tools"><label class="search-field"><ion-icon :icon="searchOutline" /><input v-model.trim="search" type="search" placeholder="Search name, reference, or ticket code" aria-label="Search manifest" /></label><div class="status-tabs" role="group" aria-label="Filter ticket status"><button v-for="tab in tabs" :key="tab.value" type="button" :class="{ active: statusFilter === tab.value }" :aria-pressed="statusFilter === tab.value" @click="statusFilter = tab.value">{{ tab.label }}</button></div></div>
                <div v-if="loading" class="empty-state">Loading boarding records…</div>
                <div v-else-if="!selectedSailingCode" class="empty-state">No sailing is available for the boarding desk.</div>
                <div v-else-if="!filteredPassengers.length" class="empty-state">{{ search || statusFilter !== 'ALL' ? 'No tickets match this search or filter.' : 'No paid tickets found for this sailing.' }}</div>
                <div v-else class="passenger-list"><button v-for="person in filteredPassengers" :key="person.id" class="passenger-row" :class="{ selected: selectedPassengerId === person.id }" :aria-pressed="selectedPassengerId === person.id" :disabled="busy || loading" type="button" @click="selectPassenger(person)"><span class="avatar">{{ initials(person.name) }}</span><span class="passenger-main"><strong>{{ person.name }}</strong><small>{{ person.reference }} · {{ person.type }}</small></span><span class="ticket-status" :class="person.status.toLowerCase().replace('_', '-')">{{ statusLabel(person.status) }}</span><ion-icon :icon="chevronForwardOutline" /></button></div>
              </section>

              <aside class="panel review-panel" aria-label="Ticket review">
                <template v-if="selectedPassenger"><div class="panel-heading"><div><p class="eyebrow">TICKET REVIEW</p><h2>Passenger details</h2></div><span class="review-icon"><ion-icon :icon="ticketOutline" /></span></div><div class="review-identity"><span class="avatar large">{{ initials(selectedPassenger.name) }}</span><div><strong>{{ selectedPassenger.name }}</strong><small>{{ selectedPassenger.type }} passenger</small></div></div><dl class="details"><div><dt>Booking reference</dt><dd>{{ selectedPassenger.reference }}</dd></div><div><dt>Ticket code</dt><dd class="code">{{ selectedPassenger.ticketCode }}</dd></div><div><dt>Status</dt><dd><span class="ticket-status" :class="selectedPassenger.status.toLowerCase().replace('_', '-')">{{ statusLabel(selectedPassenger.status) }}</span></dd></div><div v-if="selectedPassenger.checkedInAt"><dt>Checked in</dt><dd>{{ formatDate(selectedPassenger.checkedInAt) }}</dd></div><div v-if="selectedPassenger.boardedAt"><dt>Boarded</dt><dd>{{ formatDate(selectedPassenger.boardedAt) }}</dd></div></dl><p class="review-help">{{ actionHint }}</p><button v-if="selectedPassenger.status === 'ISSUED' || selectedPassenger.status === 'CHECKED_IN'" class="primary-button review-action" type="button" :disabled="busy || loading || (selectedPassenger.status === 'CHECKED_IN' && selectedSailing?.status !== 'BOARDING')" @click="updateSelectedTicket"><ion-icon :icon="selectedPassenger.status === 'ISSUED' ? scanOutline : boatOutline" />{{ busy ? 'Saving…' : selectedPassenger.status === 'ISSUED' ? 'Check in passenger' : 'Mark as boarded' }}</button><div v-else class="complete-note"><ion-icon :icon="checkmarkCircleOutline" /> No further action needed</div></template>
                <template v-else><div class="review-placeholder"><span><ion-icon :icon="ticketOutline" /></span><h2>Review a ticket</h2><p>Choose a passenger from the manifest or scan their QR code. The ticket status changes only after you confirm the action here.</p><button class="secondary-button" type="button" :disabled="!selectedSailingCode || loading || busy" @click="openScanner"><ion-icon :icon="scanOutline" /> Find ticket</button></div></template>
              </aside>
            </div>

            <section id="activity" class="panel activity-panel"><div class="panel-heading"><div><p class="eyebrow">AUDIT TRAIL</p><h2>Recent gate activity</h2></div><span class="count-pill">{{ events.length }} records</span></div><div v-if="!events.length" class="empty-state">No check-ins or boarding events recorded for this sailing.</div><div v-else class="activity-list"><article v-for="event in events" :key="event.id"><span class="activity-icon"><ion-icon :icon="event.eventType === 'BOARDED' ? boatOutline : scanOutline" /></span><div><strong>{{ event.passenger.fullName }} {{ event.eventType === 'BOARDED' ? 'boarded' : 'checked in' }}</strong><p>{{ event.passenger.booking.reference }}</p></div><time :datetime="event.createdAt">{{ formatDate(event.createdAt) }}</time></article></div></section>
          </main>
        </div>
      </div>

      <ion-modal :is-open="scannerOpen" @didDismiss="closeScanner"><div class="scanner-modal"><button class="modal-close" type="button" aria-label="Close ticket search" @click="closeScanner"><ion-icon :icon="closeOutline" /></button><span class="scanner-icon"><ion-icon :icon="scanOutline" /></span><p class="eyebrow">GATE TICKET LOOKUP</p><h2>Find a passenger ticket</h2><p>Scan the QR code or enter the ticket code. You can review the record before changing its status.</p><video ref="scannerVideo" class="scanner-video" :class="{ visible: cameraActive }" autoplay playsinline muted></video><button class="secondary-button camera-button" type="button" @click="startCamera"><ion-icon :icon="cameraOutline" /> Scan QR with camera</button><p v-if="scanError" class="scan-error" role="alert">{{ scanError }}</p><form @submit.prevent="findTicket"><label for="ticket-code">Ticket code</label><input id="ticket-code" v-model.trim="ticketLookup" autocomplete="off" placeholder="Enter or paste ticket code" /><button class="primary-button" type="submit" :disabled="!ticketLookup">Find ticket</button></form></div></ion-modal>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { dataConnectRequestError } from '../data/dataConnectErrors'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { IonContent, IonIcon, IonModal, IonPage, onIonViewWillEnter, onIonViewWillLeave } from '@ionic/vue'
import { alertCircleOutline, arrowForwardOutline, boatOutline, cameraOutline, checkmarkCircleOutline, chevronForwardOutline, closeOutline, gridOutline, informationCircleOutline, logOutOutline, menuOutline, peopleOutline, refreshOutline, scanOutline, searchOutline, settingsOutline, ticketOutline, timeOutline } from 'ionicons/icons'
import { signOut } from 'firebase/auth'
import jsQR from 'jsqr'
import BrandMark from '../../components/BrandMark.vue'
import { clearSessionViews } from '../composables/sessionViews'
import { boardingActivity, boardingManifest, boardingSailings, boardTicket, checkInTicket, type BoardingActivityData, type BoardingManifestData, type BoardingSailingsData } from '../dataconnect-generated/staff'
import { auth, staffDataConnect } from '../services/firebase'

type Sailing = BoardingSailingsData['sailings'][number]
type Ticket = BoardingManifestData['bookings'][number]['bookingPassengers_on_booking'][number]
type Passenger = { id: Ticket['id']; name: string; type: string; ticketCode: string; reference: string; status: string; checkedInAt?: string | null; boardedAt?: string | null }
type Event = BoardingActivityData['boardingEvents'][number]
const router = useRouter()
const contentRef = ref<InstanceType<typeof IonContent> | null>(null)
const activeSection = ref('overview')
const sailings = ref<Sailing[]>([])
const selectedSailingCode = ref('')
const passengers = ref<Passenger[]>([])
const events = ref<Event[]>([])
const selectedPassengerId = ref<Ticket['id'] | null>(null)
const search = ref('')
const statusFilter = ref('ALL')
const tabs = [{ label: 'All', value: 'ALL' }, { label: 'Issued', value: 'ISSUED' }, { label: 'Checked in', value: 'CHECKED_IN' }, { label: 'Boarded', value: 'BOARDED' }]
const loading = ref(false)
const busy = ref(false)
const error = ref('')
const success = ref('')
const menuOpen = ref(false)
const scannerOpen = ref(false)
const scannerVideo = ref<HTMLVideoElement | null>(null)
const cameraActive = ref(false)
const ticketLookup = ref('')
const scanError = ref('')
let cameraStream: MediaStream | null = null
let scanFrame = 0
let requestNumber = 0

const staffName = computed(() => auth?.currentUser?.displayName || auth?.currentUser?.email?.split('@')[0] || 'Boarding staff')
const selectedSailing = computed(() => sailings.value.find(item => item.code === selectedSailingCode.value))
const selectedPassenger = computed(() => passengers.value.find(item => item.id === selectedPassengerId.value))
const checkedInCount = computed(() => passengers.value.filter(item => item.status === 'CHECKED_IN').length)
const boardedCount = computed(() => passengers.value.filter(item => item.status === 'BOARDED').length)
const issuedCount = computed(() => passengers.value.filter(item => item.status === 'ISSUED').length)
const boardingPercent = computed(() => passengers.value.length ? Math.round(boardedCount.value / passengers.value.length * 100) : 0)
const filteredPassengers = computed(() => passengers.value.filter(item => {
  const matchesStatus = statusFilter.value === 'ALL' || item.status === statusFilter.value
  const term = search.value.toLowerCase()
  return matchesStatus && `${item.name} ${item.reference} ${item.ticketCode}`.toLowerCase().includes(term)
}))
const actionHint = computed(() => {
  if (!selectedPassenger.value) return ''
  if (selectedPassenger.value.status === 'ISSUED') return 'Confirm the passenger and ticket before checking in. This records their arrival at the gate.'
  if (selectedPassenger.value.status === 'CHECKED_IN') return selectedSailing.value?.status === 'BOARDING' ? 'Confirm the passenger is boarding this vessel before recording it.' : 'Boarding is available when the sailing status changes to BOARDING.'
  if (selectedPassenger.value.status === 'BOARDED') return 'This passenger has already boarded. The record is complete.'
  return 'This ticket cannot be processed at the gate.'
})

function initials(name: string) { return name.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase() }
function statusLabel(status: string) { return status === 'CHECKED_IN' ? 'Checked in' : status === 'ISSUED' ? 'Issued' : status === 'BOARDED' ? 'Boarded' : status.replace(/_/g, ' ') }
function formatDate(value: string) { return new Date(value).toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' }) }
function selectPassenger(person: Passenger) { selectedPassengerId.value = person.id; error.value = ''; success.value = '' }
async function scrollToSection(section: 'overview' | 'manifest' | 'activity') {
  activeSection.value = section
  menuOpen.value = false
  await nextTick()
  const content = contentRef.value?.$el
  const target = document.getElementById(section)
  if (!content || !target) return
  const scroll = await content.getScrollElement()
  const top = target.getBoundingClientRect().top - scroll.getBoundingClientRect().top + scroll.scrollTop - 18
  await content.scrollToPoint(0, Math.max(0, top), 300)
}

async function loadData() {
  const request = ++requestNumber
  if (!staffDataConnect) { error.value = 'Firebase is not configured.'; return }
  loading.value = true
  error.value = ''
  try {
    const result = await boardingSailings(staffDataConnect, { fetchPolicy: 'SERVER_ONLY' })
    if (request !== requestNumber) return
    sailings.value = result.data.sailings.filter(item => item.status === 'BOARDING' || new Date(item.departureAt) > new Date())
    if (!sailings.value.some(item => item.code === selectedSailingCode.value)) selectedSailingCode.value = sailings.value[0]?.code || ''
    const code = selectedSailingCode.value
    if (!code) { passengers.value = []; events.value = []; selectedPassengerId.value = null; return }
    const [manifest, activity] = await Promise.all([
      boardingManifest(staffDataConnect, { sailingCode: code }, { fetchPolicy: 'SERVER_ONLY' }),
      boardingActivity(staffDataConnect, { sailingCode: code }, { fetchPolicy: 'SERVER_ONLY' }),
    ])
    if (request !== requestNumber || code !== selectedSailingCode.value) return
    passengers.value = manifest.data.bookings.flatMap(booking => booking.bookingPassengers_on_booking.map(ticket => ({
      id: ticket.id, name: ticket.fullName, type: ticket.passengerType, ticketCode: ticket.ticketCode,
      reference: booking.reference, status: ticket.ticketStatus, checkedInAt: ticket.checkedInAt, boardedAt: ticket.boardedAt,
    })))
    events.value = activity.data.boardingEvents
    if (!passengers.value.some(item => item.id === selectedPassengerId.value)) selectedPassengerId.value = null
  } catch (cause) {
    if (request === requestNumber) { error.value = dataConnectRequestError(cause, 'Could not load boarding records.'); passengers.value = []; events.value = [] }
  } finally { if (request === requestNumber) loading.value = false }
}

watch(selectedSailingCode, (code, previous) => {
  if (code === previous || !previous) return
  selectedPassengerId.value = null
  search.value = ''
  statusFilter.value = 'ALL'
  void loadData()
})
onIonViewWillEnter(() => { void loadData() })
onIonViewWillLeave(() => { ++requestNumber; stopCamera(); scannerOpen.value = false })
onBeforeUnmount(() => { ++requestNumber; stopCamera() })

async function updateSelectedTicket() {
  const person = selectedPassenger.value
  if (!person || !staffDataConnect || busy.value) return
  if (person.status !== 'ISSUED' && person.status !== 'CHECKED_IN') return
  if (person.status === 'CHECKED_IN' && selectedSailing.value?.status !== 'BOARDING') return
  const action = person.status === 'ISSUED' ? 'check in' : 'mark as boarded'
  if (!window.confirm(`Confirm ${action} for ${person.name} (${person.reference})?`)) return
  busy.value = true
  error.value = ''
  success.value = ''
  try {
    if (person.status === 'ISSUED') await checkInTicket(staffDataConnect, { passengerId: person.id })
    else await boardTicket(staffDataConnect, { passengerId: person.id })
    await loadData()
    success.value = `${person.name} ${person.status === 'ISSUED' ? 'checked in' : 'marked as boarded'}.`
  } catch (cause) { error.value = dataConnectRequestError(cause, 'Could not update this ticket. Refresh and try again.') }
  finally { busy.value = false }
}

function openScanner() { ticketLookup.value = ''; scanError.value = ''; scannerOpen.value = true }
function closeScanner() { stopCamera(); scannerOpen.value = false; scanError.value = '' }
function findTicket() {
  const code = ticketLookup.value.trim().toLowerCase()
  const person = passengers.value.find(item => item.ticketCode.toLowerCase() === code)
  if (!person) { scanError.value = 'Ticket not found on this sailing. Check the code and selected sailing.'; return }
  selectedPassengerId.value = person.id
  statusFilter.value = 'ALL'
  search.value = ''
  closeScanner()
  document.getElementById('manifest')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
function stopCamera() { if (scanFrame) cancelAnimationFrame(scanFrame); scanFrame = 0; cameraStream?.getTracks().forEach(track => track.stop()); cameraStream = null; cameraActive.value = false; if (scannerVideo.value) scannerVideo.value.srcObject = null }
async function startCamera() {
  scanError.value = ''
  if (!navigator.mediaDevices?.getUserMedia) { scanError.value = 'Camera access is unavailable. Open this page on localhost or HTTPS, or enter the ticket code.'; return }
  try {
    stopCamera()
    await nextTick()
    cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
    if (!scannerOpen.value || !scannerVideo.value) { stopCamera(); return }
    scannerVideo.value.srcObject = cameraStream
    cameraActive.value = true
    await nextTick()
    await scannerVideo.value.play()
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) throw new Error('Could not initialize QR scanner.')
    let lastScan = 0
    const scan = (timestamp: number) => {
      if (!cameraStream || !scannerVideo.value) return
      if (timestamp - lastScan >= 100 && scannerVideo.value.videoWidth > 0) {
        lastScan = timestamp
        const video = scannerVideo.value
        const scale = Math.min(1, 720 / video.videoWidth)
        canvas.width = Math.round(video.videoWidth * scale)
        canvas.height = Math.round(video.videoHeight * scale)
        context.drawImage(video, 0, 0, canvas.width, canvas.height)
        const frame = context.getImageData(0, 0, canvas.width, canvas.height)
        const code = jsQR(frame.data, frame.width, frame.height)
        if (code?.data) { ticketLookup.value = code.data; stopCamera(); findTicket(); return }
      }
      scanFrame = requestAnimationFrame(scan)
    }
    scanFrame = requestAnimationFrame(scan)
  } catch (cause) {
    stopCamera()
    const cameraError = cause as DOMException
    scanError.value = cameraError.name === 'NotAllowedError' ? 'Camera permission was denied. Allow camera access in your browser and try again.' : cameraError.name === 'NotFoundError' ? 'No camera was found on this device. Enter the ticket code instead.' : cameraError.message || 'Could not start camera. Enter the ticket code instead.'
  }
}
async function logout() { if (auth) await signOut(auth); clearSessionViews(); await router.replace('/login') }
</script>

<style scoped>
.boarding-shell{min-height:100%;display:flex;background:var(--cloud);color:var(--ink)}
.sidebar{position:fixed;inset:0 auto 0 0;width:235px;min-width:235px;height:100dvh;display:flex;flex-direction:column;padding:26px 16px;background:var(--deep);color:#fff;z-index:20}
.sidebar :deep(.brand-copy strong),.sidebar :deep(.brand-copy b){color:#fff}.sidebar :deep(.brand-copy small){color:#8eb8cc}.sidebar :deep(.brand-symbol){background:var(--ocean)}
.nav-caption{margin:20px 10px 8px;color:#7896a9;font-size:10px;font-weight:800;letter-spacing:.1em}.sidebar nav{display:flex;flex-direction:column;gap:4px;flex:1;min-height:0;margin-top:28px;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:#36516a transparent}.sidebar nav .nav-caption:first-child{margin-top:0}.sidebar nav a,.sidebar nav button,.logout{display:flex;align-items:center;gap:11px;width:100%;padding:11px 12px;border:0;border-radius:9px;background:transparent;color:#aec5d3;text-decoration:none;text-align:left;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer}.sidebar nav a ion-icon,.sidebar nav button ion-icon,.logout ion-icon{font-size:18px}.sidebar nav a.active,.sidebar nav a:hover,.sidebar nav button.active,.sidebar nav button:hover,.logout:hover{background:#14355a;color:#fff}.sidebar nav a.active,.sidebar nav button.active{box-shadow:inset 3px 0 0 var(--primary)}.logout{margin-top:16px;flex:none;border-top:1px solid #ffffff20;border-radius:0}
.main-column{min-width:0;flex:1;width:calc(100% - 235px);margin-left:235px}.topbar{height:73px;display:flex;align-items:center;padding:0 36px;border-bottom:1px solid var(--line);background:var(--surface)}.breadcrumb{display:flex;align-items:center;gap:8px;color:var(--muted);font-size:12px}.breadcrumb ion-icon{color:var(--ocean)}.breadcrumb strong{color:var(--ink)}.staff-chip{display:flex;align-items:center;gap:9px;margin-left:auto;padding:4px 12px 4px 4px;border:1px solid var(--line);border-radius:999px;background:var(--surface-soft)}.staff-chip>span{display:grid;place-items:center;width:33px;height:33px;border-radius:10px;background:var(--light-blue);color:var(--ocean);font-size:18px}.staff-chip div{display:grid;gap:2px}.staff-chip strong{font-size:11px}.staff-chip small{color:var(--muted);font-size:9px}.menu-button,.scrim{display:none}
.content{max-width:1500px;margin:auto;padding:38px 36px 55px}.page-heading{display:flex;align-items:end;justify-content:space-between;gap:20px;margin-bottom:25px}.eyebrow{margin:0;color:var(--ocean);font-size:10px;font-weight:800;letter-spacing:.11em}.page-heading h1{margin:7px 0 5px;font-size:30px;letter-spacing:-.035em}.page-heading p:last-child{margin:0;color:var(--muted);font-size:13px}.heading-actions{display:flex;gap:9px}.primary-button,.secondary-button{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:41px;padding:0 16px;border:1px solid transparent;border-radius:9px;font:800 12px inherit;cursor:pointer;white-space:nowrap}.primary-button{background:var(--ocean);color:#fff}.primary-button:hover{filter:brightness(1.08)}.secondary-button{border-color:var(--line);background:var(--surface);color:var(--ocean)}.secondary-button:hover{background:var(--light-blue)}button:disabled{opacity:.5;cursor:not-allowed}.primary-button ion-icon,.secondary-button ion-icon{font-size:17px}
.notice{display:flex;align-items:center;gap:9px;margin-bottom:17px;padding:11px 13px;border:1px solid;border-radius:10px;font-size:12px}.notice ion-icon{flex:none;font-size:18px}.notice span{flex:1}.notice button{border:0;background:transparent;color:inherit;cursor:pointer}.notice.error{border-color:#efb8b8;background:#fff0f0;color:#a52e39}.notice.success{border-color:#8bcdb1;background:#eaf8f1;color:#146f53}
.sailing-card,.stats article,.panel{border:1px solid var(--line);border-radius:16px;background:var(--surface);box-shadow:0 8px 24px #0b1f3a0a}.sailing-card{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:19px 22px;background:linear-gradient(112deg,var(--surface),var(--surface-soft))}.sailing-copy{display:flex;align-items:center;gap:15px;min-width:0}.sailing-icon{display:grid;place-items:center;flex:none;width:48px;height:48px;border-radius:13px;background:var(--light-blue);color:var(--ocean);font-size:24px}.sailing-copy h2{display:flex;align-items:center;gap:8px;margin:6px 0 3px;font-size:19px}.sailing-copy h2 ion-icon{color:var(--ocean);font-size:16px}.sailing-copy p:last-child{margin:0;color:var(--muted);font-size:11px}.sailing-control{display:flex;align-items:center;gap:10px;max-width:48%}.sailing-control label{color:var(--muted);font-size:11px;font-weight:700}.sailing-control select{max-width:300px;min-height:40px;padding:0 10px;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--ink);font:600 11px inherit}.sailing-status,.ticket-status{display:inline-flex;align-items:center;width:max-content;padding:6px 8px;border-radius:6px;background:#e8f0f7;color:#35627a;font-size:10px;font-weight:800;white-space:nowrap}.sailing-status.boarding,.ticket-status.boarded{background:#e3f6ed;color:#147854}.ticket-status.checked-in{background:#e6f1fa;color:#176c9e}.gate-note{display:flex;align-items:center;gap:9px;margin:13px 0 0;padding:11px 13px;border:1px solid #d8e5ec;border-radius:10px;background:var(--surface-soft);color:var(--muted);font-size:11px}.gate-note ion-icon{flex:none;color:var(--ocean);font-size:17px}
.stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin:18px 0}.stats article{display:flex;align-items:center;gap:14px;min-height:95px;padding:16px}.stat-icon{display:grid;place-items:center;flex:none;width:44px;height:44px;border-radius:12px;font-size:21px}.stat-icon.blue{background:var(--light-blue);color:var(--ocean)}.stat-icon.amber{background:#fff1d2;color:#a97406}.stat-icon.green{background:#def7f0;color:#078a72}.stats small,.stats strong{display:block}.stats small{color:var(--muted);font-size:10px;font-weight:800;letter-spacing:.04em}.stats strong{margin:4px 0;font-size:26px;line-height:1}.stats p{margin:0;color:var(--muted);font-size:10px}
.workspace-grid{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(310px,.8fr);gap:18px;align-items:start}.panel{min-width:0;padding:21px}.panel-heading{display:flex;align-items:start;justify-content:space-between;gap:10px}.panel-heading h2{margin:6px 0 3px;font-size:19px}.panel-heading p:last-child{margin:0;color:var(--muted);font-size:11px}.count-pill{padding:6px 9px;border-radius:999px;background:var(--light-blue);color:var(--ocean);font-size:10px;font-weight:800;white-space:nowrap}.manifest-tools{display:grid;gap:12px;margin:20px 0 16px}.search-field{display:flex;align-items:center;gap:8px;min-width:170px;flex:1;padding:0 11px;border:1px solid var(--line);border-radius:9px;background:var(--surface-soft);color:var(--muted)}.search-field input{width:100%;height:39px;border:0;outline:0;background:transparent;color:var(--ink);font:500 11px inherit}.search-field ion-icon{font-size:17px}.status-tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:3px;padding:3px;border:1px solid var(--line);border-radius:9px;background:var(--surface-soft)}.status-tabs button{min-height:30px;padding:0 8px;border:0;border-radius:6px;background:transparent;color:var(--muted);font-family:inherit;font-size:10px;font-weight:700;cursor:pointer;white-space:nowrap}.status-tabs button.active{background:var(--surface);color:var(--ocean);box-shadow:0 1px 5px #0b1f3a19}.passenger-list{max-height:460px;overflow:auto}.passenger-row{display:flex;align-items:center;gap:11px;width:100%;min-height:67px;padding:10px 8px;border:0;border-top:1px solid var(--line);background:transparent;color:var(--ink);text-align:left;cursor:pointer}.passenger-row:hover,.passenger-row.selected{background:var(--surface-soft)}.passenger-row.selected{box-shadow:inset 3px 0 0 var(--ocean)}.avatar{display:grid;place-items:center;flex:none;width:37px;height:37px;border-radius:50%;background:var(--light-blue);color:var(--ocean);font-size:11px;font-weight:800}.passenger-main{display:grid;gap:4px;min-width:0;flex:1}.passenger-main strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}.passenger-main small{overflow:hidden;color:var(--muted);font-size:10px;text-overflow:ellipsis;white-space:nowrap}.passenger-row>ion-icon{color:var(--muted);font-size:16px}.empty-state{padding:30px 12px;color:var(--muted);text-align:center;font-size:12px}
.review-icon{display:grid;place-items:center;width:35px;height:35px;border-radius:9px;background:var(--light-blue);color:var(--ocean);font-size:18px}.review-identity{display:flex;align-items:center;gap:11px;margin:19px 0;padding:16px;border:1px solid var(--line);border-radius:11px;background:var(--surface-soft)}.avatar.large{width:43px;height:43px}.review-identity div{display:grid;gap:4px}.review-identity strong{font-size:13px}.review-identity small{color:var(--muted);font-size:10px}.details{margin:0}.details>div{display:flex;justify-content:space-between;gap:15px;padding:11px 0;border-bottom:1px solid var(--line)}.details dt{color:var(--muted);font-size:11px}.details dd{max-width:62%;margin:0;text-align:right;font-size:11px;font-weight:700;overflow-wrap:anywhere}.details dd.code{color:var(--ocean);font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:10px}.review-help{margin:18px 0 13px;color:var(--muted);font-size:11px;line-height:1.6}.review-action{width:100%}.complete-note{display:flex;align-items:center;justify-content:center;gap:7px;padding:11px;border-radius:9px;background:#e3f6ed;color:#147854;font-size:11px;font-weight:800}.review-placeholder{display:grid;justify-items:center;padding:31px 12px;text-align:center}.review-placeholder>span{display:grid;place-items:center;width:57px;height:57px;border-radius:14px;background:var(--light-blue);color:var(--ocean);font-size:27px}.review-placeholder h2{margin:15px 0 4px;font-size:18px}.review-placeholder p{max-width:280px;margin:0 0 18px;color:var(--muted);font-size:11px;line-height:1.6}
.activity-panel{margin-top:18px}.activity-list article{display:flex;align-items:center;gap:11px;padding:12px 0;border-top:1px solid var(--line)}.activity-list article:first-child{margin-top:17px}.activity-icon{display:grid;place-items:center;flex:none;width:35px;height:35px;border-radius:9px;background:var(--light-blue);color:var(--ocean);font-size:17px}.activity-list article>div{flex:1;min-width:0}.activity-list strong{font-size:11px}.activity-list p{margin:3px 0 0;color:var(--muted);font-size:10px}.activity-list time{color:var(--muted);font-size:10px;white-space:nowrap}
.scanner-modal{position:relative;width:min(92vw,430px);max-height:calc(100vh - 40px);overflow:auto;margin:max(35px,9vh) auto 0;padding:28px;border-radius:17px;background:var(--surface);color:var(--ink);box-shadow:0 18px 60px #0004}.modal-close{position:absolute;top:16px;right:16px;border:0;background:transparent;color:var(--muted);font-size:21px;cursor:pointer}.scanner-icon{display:grid;place-items:center;width:49px;height:49px;margin-bottom:18px;border-radius:12px;background:var(--light-blue);color:var(--ocean);font-size:24px}.scanner-modal h2{margin:6px 0;font-size:22px}.scanner-modal>p:not(.eyebrow):not(.scan-error){color:var(--muted);font-size:12px;line-height:1.6}.scanner-video{display:block;width:100%;max-height:210px;margin:13px 0;border-radius:10px;background:#101c29}.scanner-video:not([src]){min-height:80px}.camera-button{width:100%}.scan-error{color:#af3a43;font-size:11px}.scanner-modal form{display:grid;gap:8px;margin-top:17px}.scanner-modal form label{font-size:11px;font-weight:800}.scanner-modal form input{min-height:42px;padding:0 12px;border:1px solid var(--line);border-radius:9px;background:var(--surface-soft);color:var(--ink);font:600 12px inherit}.scanner-modal form .primary-button{margin-top:6px}
@media(max-width:1150px){.workspace-grid{grid-template-columns:minmax(0,1fr)}.manifest-tools{flex-wrap:wrap}.status-tabs{max-width:100%;overflow:auto}.sailing-card{align-items:flex-start;flex-direction:column}.sailing-control{max-width:100%;width:100%;justify-content:space-between}.sailing-control select{flex:1;max-width:none}}
@media(max-width:800px){.main-column{width:100%;margin-left:0}.sidebar{display:none}.sidebar.open{position:fixed;inset:0 auto 0 0;display:flex;width:min(84vw,300px);height:100dvh;box-shadow:12px 0 36px #020b1880;z-index:31}.scrim{position:fixed;inset:0;display:block;width:100%;border:0;background:#061222a8;z-index:30}.menu-button{display:grid;place-items:center;width:36px;height:36px;margin-right:10px;border:1px solid var(--line);border-radius:9px;background:var(--surface);color:var(--ink);font-size:19px}.topbar{padding:0 16px}.content{padding:26px 16px 45px}.page-heading{align-items:start;flex-direction:column}.stats{grid-template-columns:repeat(2,minmax(0,1fr))}.stats article{display:block}.stat-icon{margin-bottom:10px}}
@media(max-width:580px){.page-heading h1{font-size:26px}.heading-actions{width:100%}.heading-actions button{flex:1}.sailing-copy h2{font-size:16px}.sailing-control{flex-wrap:wrap}.sailing-control select{min-width:100%}.sailing-status{margin-left:auto}.stats{gap:7px}.stats article{min-height:0;padding:12px}.stat-icon{width:34px;height:34px;font-size:17px}.stats small{font-size:8px}.stats strong{font-size:21px}.stats p{font-size:9px}.panel{padding:16px}.manifest-tools{display:grid}.status-tabs{width:100%;max-width:100%}.activity-list time{font-size:9px}.staff-chip div{display:none}.breadcrumb{font-size:11px}}
.scanner-video{display:none}.scanner-video.visible{display:block}
.sidebar nav a,.logout,.primary-button,.secondary-button,.sailing-control select,.search-field input,.status-tabs button,.scanner-modal form input{font-family:inherit}
.sidebar nav a,.logout,.primary-button,.secondary-button{font-size:12px;font-weight:800}
.sailing-control select,.search-field input,.scanner-modal form input{font-size:11px;font-weight:600}
.status-tabs button{font-size:10px;font-weight:700}
.sidebar nav a,.sidebar nav button,.logout{min-height:39px;padding:10px;font-size:11px;font-weight:600;transition:background-color .16s ease,color .16s ease}
.sidebar .nav-caption{font-size:9px;font-weight:800;letter-spacing:.12em}
.sidebar nav a ion-icon,.sidebar nav button ion-icon{flex:none;font-size:17px}
.sidebar nav::-webkit-scrollbar{width:5px}.sidebar nav::-webkit-scrollbar-thumb{border-radius:8px;background:#36516a}
.topbar{gap:14px}.breadcrumb{min-width:0}.breadcrumb strong{white-space:nowrap}.staff-chip{flex:none}.staff-chip>span{border:1px solid var(--line);width:32px;height:32px}.staff-chip strong{max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.content{padding-top:32px}.page-heading h1{font-size:28px;letter-spacing:-.7px}.page-heading>div>p:last-child{line-height:1.6}
.sailing-card{padding:22px;align-items:center}.sailing-control{display:grid;grid-template-columns:minmax(180px,1fr) auto;gap:8px 12px;min-width:270px;max-width:44%}.sailing-control label{grid-column:1/-1;font-size:10px}.sailing-control select{width:100%;max-width:none;min-width:0}.sailing-copy{flex:1}.sailing-copy h2{flex-wrap:wrap;line-height:1.4}.sailing-copy p:last-child{line-height:1.6}.sailing-status{padding:7px 9px}
.boarding-progress{display:flex;align-items:center;gap:18px;margin:14px 2px 0;font-size:11px;color:var(--muted)}.boarding-progress>span{display:flex;gap:12px;white-space:nowrap}.boarding-progress strong{color:var(--ink);font-size:11px}.progress-track{flex:1;height:6px;border-radius:8px;overflow:hidden;background:var(--line)}.progress-track i{display:block;height:100%;background:var(--ocean);border-radius:inherit;transition:width .2s ease}
.stats article{padding:18px 16px;gap:12px}.stats strong{font-size:27px}.stats small{font-size:9px}.stat-icon{width:39px;height:39px;font-size:19px}.stat-icon.neutral{background:var(--surface-soft);color:var(--muted);border:1px solid var(--line)}
.workspace-grid{grid-template-columns:minmax(0,1.4fr) minmax(300px,.85fr);gap:20px}.panel-heading .eyebrow{font-size:9px}.panel-heading h2{font-size:18px;margin:7px 0}.panel-heading p:last-child{line-height:1.6}.review-panel{position:sticky;top:20px}.review-help{padding:12px;border:1px solid var(--line);border-radius:9px;background:var(--surface-soft)}
.search-field{min-width:0}.search-field:focus-within{border-color:var(--ocean)}.search-field input{height:42px;font-size:12px}.status-tabs button{min-height:34px;font-size:11px}.status-tabs button.active{background:var(--light-blue);box-shadow:none}.passenger-list{max-height:520px;scrollbar-width:thin;scrollbar-color:var(--line) transparent}.passenger-row{min-height:72px;padding:12px 10px;border-radius:8px}.passenger-row.selected{background:var(--light-blue)}.passenger-row:disabled{opacity:.7}.passenger-row .ticket-status{font-size:9px}.review-identity strong{overflow-wrap:anywhere}
.activity-list strong{display:block;line-height:1.5}.activity-list time{text-align:right}.gate-note{border-color:var(--line);line-height:1.6}.scanner-modal{max-height:calc(100dvh - 40px)}
button:focus-visible,a:focus-visible,select:focus-visible,input:focus-visible{outline:2px solid var(--ocean);outline-offset:3px}
@media(max-width:1200px){.stats article{gap:10px}.stats p{line-height:1.5}.stat-icon{width:34px;height:34px}.sailing-card{align-items:flex-start;flex-direction:column}.sailing-control{width:100%;max-width:none;min-width:0;grid-template-columns:minmax(0,1fr) auto}.workspace-grid{grid-template-columns:minmax(0,1fr)}.review-panel{position:static}.review-placeholder{padding:24px 12px}}
@media(max-width:800px){.content{padding:24px 18px 40px}.topbar{padding:0 18px}.menu-button{flex:none;margin-right:0}.stats{grid-template-columns:repeat(2,minmax(0,1fr))}.stats article{display:flex}.stat-icon{margin:0}.page-heading{margin-bottom:20px}.stats article{padding:16px}.boarding-progress{gap:10px}}
@media(max-width:580px){.sailing-card{padding:17px}.sailing-icon{width:40px;height:40px;font-size:21px}.sailing-copy{gap:10px}.sailing-copy h2{font-size:17px}.sailing-control select{min-width:0}.staff-chip{padding:3px;border:0;background:transparent}.staff-chip div{display:none}.heading-actions{gap:9px}.heading-actions button{padding:0 12px;min-height:42px}.stats article{align-items:flex-start;padding:14px 12px;gap:9px}.stats strong{font-size:24px}.stats small{font-size:8px}.stat-icon{width:30px;height:30px;font-size:16px}.boarding-progress>span{font-size:10px;gap:8px}.boarding-progress{flex-wrap:wrap}.progress-track{min-width:90px}.passenger-row{gap:8px;padding:12px 6px}.passenger-main strong{font-size:11px}.passenger-main small{font-size:9px}.ticket-status{font-size:9px}.activity-list article{flex-wrap:wrap}.activity-list time{width:100%;padding-left:46px;text-align:left}.scanner-modal{margin:20px auto;padding:22px}.status-tabs button{font-size:10px;padding:0 5px}}
:global(:root[data-theme='dark']) .stat-icon.amber{background:#3b2e17;color:#edbd5e}
:global(:root[data-theme='dark']) .stat-icon.green,:global(:root[data-theme='dark']) .sailing-status.boarding,:global(:root[data-theme='dark']) .ticket-status.boarded,:global(:root[data-theme='dark']) .complete-note{background:#12342f;color:#57c6aa}
:global(:root[data-theme='dark']) .notice.error{background:#3a1d24;border-color:#7c3944;color:#ffb4bd}
:global(:root[data-theme='dark']) .notice.success{background:#12342f;border-color:#30715e;color:#57c6aa}
</style>
