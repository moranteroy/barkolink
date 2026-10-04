<template>
  <ion-page>
    <ion-content ref="settingsScroller" :fullscreen="true">
      <main class="settings-page">
        <PassengerHeader v-if="isPassenger" :name="profile.name" />
        <header v-else class="settings-header">
          <router-link :to="backPath" class="back" :aria-label="isAdmin ? 'Back to admin dashboard' : isStaff ? 'Back to staff workspace' : 'Back to home'"><ion-icon :icon="arrowBackOutline" /></router-link>
          <BrandMark />
          <span class="page-mode"><ion-icon :icon="settingsOutline" /> Account settings</span>
        </header>
        <section class="settings-layout">
          <nav class="settings-nav" aria-label="Settings sections">
            <p class="kicker">SETTINGS</p>
            <a :href="isPassenger ? '/settings/appearance' : settingsPath" @click="navigateSection($event, isPassenger ? '/settings/appearance' : settingsPath)"><ion-icon :icon="contrastOutline" />Appearance</a>
            <a v-if="isPassenger" href="/settings/profile" @click="navigateSection($event, '/settings/profile')"><ion-icon :icon="personOutline" />Personal information</a>
            <a v-if="isPassenger" href="/settings/password" @click="navigateSection($event, '/settings/password')"><ion-icon :icon="shieldCheckmarkOutline" />Password</a>
            <a v-if="isPassenger" href="/notifications" @click="navigateSection($event, '/notifications')"><ion-icon :icon="notificationsOutline" />Notifications</a>
          </nav>
          <section class="settings-content">
            <p class="kicker">ACCOUNT PREFERENCES</p>
            <h1>Make BarkoLink yours.</h1>
            <p class="intro">Manage your account details, password, and appearance.</p>
            <p v-if="loadError" class="notice error" role="alert">{{ loadError }}</p>
            <p v-if="successMessage" class="notice success" role="status">{{ successMessage }}</p>

            <article v-if="isPassenger" id="personal-info" class="setting-card">
              <p class="kicker">PERSONAL INFORMATION</p><h2>Profile details</h2>
              <p class="card-intro">Keep your name and contact number up to date.</p>
              <form class="setting-form" @submit.prevent="saveProfile">
                <label>Full name<input v-model.trim="profile.name" autocomplete="name" required maxlength="100" /></label>
                <label>Email address<input v-model="profile.email" type="email" autocomplete="email" readonly /></label>
                <label>Mobile number<input v-model.trim="profile.phone" type="tel" autocomplete="tel" placeholder="09XX XXX XXXX" maxlength="30" /></label>
                <ion-button class="primary" type="submit" :disabled="savingProfile">{{ savingProfile ? 'Saving…' : 'Save profile' }}</ion-button>
              </form>
            </article>

            <article v-if="isPassenger" id="password" class="setting-card">
              <p class="kicker">SECURITY</p><h2>Change password</h2>
              <p class="card-intro">Enter your current password to confirm this change.</p>
              <form class="setting-form" @submit.prevent="changePassword">
                <label>Current password<input v-model="password.current" type="password" autocomplete="current-password" required /></label>
                <label>New password<input v-model="password.next" type="password" autocomplete="new-password" minlength="8" required /></label>
                <label>Confirm new password<input v-model="password.confirm" type="password" autocomplete="new-password" minlength="8" required /></label>
                <ion-button class="primary" type="submit" :disabled="savingPassword">{{ savingPassword ? 'Updating…' : 'Update password' }}</ion-button>
              </form>
            </article>

            <article id="appearance" class="setting-card appearance-card">
              <p class="kicker">APPEARANCE</p><h2>Color theme</h2>
              <p class="card-intro">Choose how BarkoLink looks on this device.</p>
              <ThemeSwitcher />
              <div class="mode-note"><ion-icon :icon="informationCircleOutline" /> System mode follows your device preference automatically.</div>
            </article>
          </section>
        </section>
      </main>
      <PassengerBottomNav v-if="isPassenger" />
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { dataConnectRequestError } from '../data/dataConnectErrors'
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword, updateProfile } from 'firebase/auth'
import { useRoute } from 'vue-router'
import { IonButton, IonContent, IonIcon, IonPage, onIonViewDidEnter, useIonRouter } from '@ionic/vue'
import { arrowBackOutline, contrastOutline, informationCircleOutline, notificationsOutline, personOutline, settingsOutline, shieldCheckmarkOutline } from 'ionicons/icons'
import BrandMark from '../../components/BrandMark.vue'
import PassengerHeader from '../../components/PassengerHeader.vue'
import PassengerBottomNav from '../../components/PassengerBottomNav.vue'
import ThemeSwitcher from '../../components/ThemeSwitcher.vue'
import { myProfile, updateMyProfile } from '../dataconnect-generated/passenger'
import { auth, dataConnect } from '../services/firebase'

const route = useRoute()
const ionRouter = useIonRouter()
const isAdmin = computed(() => route.path.startsWith('/admin'))
const isStaff = computed(() => route.path.startsWith('/staff/'))
const isPassenger = computed(() => !isAdmin.value && !isStaff.value)
const backPath = computed(() => isAdmin.value ? '/admin' : isStaff.value ? `/staff/${route.params.role}` : '/home')
const settingsPath = computed(() => isAdmin.value ? '/admin/settings' : isStaff.value ? `/staff/${route.params.role}/settings` : '/settings')
const settingsScroller = ref<InstanceType<typeof IonContent> | null>(null)
const profile = reactive({ name: '', email: '', phone: '' })
const password = reactive({ current: '', next: '', confirm: '' })
const loadError = ref('')
const successMessage = ref('')
const savingProfile = ref(false)
const savingPassword = ref(false)

onMounted(async () => {
  if (isPassenger.value && dataConnect) {
  try {
    const result = await myProfile(dataConnect, { fetchPolicy: 'SERVER_ONLY' })
    profile.name = result.data.user?.fullName || auth?.currentUser?.displayName || ''
    profile.email = result.data.user?.email || auth?.currentUser?.email || ''
    profile.phone = result.data.user?.phone || ''
  } catch (error) {
    loadError.value = dataConnectRequestError(error, 'Could not load your profile.')
  }
  } else if (isPassenger.value && !dataConnect) {
    loadError.value = 'Firebase is not configured.'
  }
})

onIonViewDidEnter(() => { void scrollToRouteSection() })

function navigateSection(event: MouseEvent, path: string) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  event.preventDefault()
  if (route.path === path) { void scrollToRouteSection(); return }
  ionRouter.navigate(path, 'root', 'push')
}

async function scrollToRouteSection() {
  const section = route.path === '/settings/profile' ? 'personal-info' : route.path === '/settings/password' ? 'password' : route.path === '/settings/appearance' ? 'appearance' : null
  if (!section) return
  await nextTick()
  await new Promise(resolve => requestAnimationFrame(() => resolve(undefined)))
  await scrollToSection(section)
}

async function scrollToSection(id: string) {
  const content = settingsScroller.value?.$el as HTMLIonContentElement | undefined
  const target = content?.querySelector<HTMLElement>(`#${id}`)
  if (!content || !target) return
  const scrollElement = await content.getScrollElement()
  const top = target.getBoundingClientRect().top - scrollElement.getBoundingClientRect().top + scrollElement.scrollTop - 12
  await content.scrollToPoint(0, Math.max(0, top), 250)
}

async function saveProfile() {
  loadError.value = ''; successMessage.value = ''
  if (!dataConnect || !auth?.currentUser) { loadError.value = 'Your account is not available. Please sign in again.'; return }
  savingProfile.value = true
  try {
    await updateMyProfile(dataConnect, { fullName: profile.name, phone: profile.phone || null })
    await updateProfile(auth.currentUser, { displayName: profile.name })
    successMessage.value = 'Your profile has been updated.'
  } catch (error) {
    loadError.value = dataConnectRequestError(error, 'Could not update your profile.')
  } finally { savingProfile.value = false }
}

async function changePassword() {
  loadError.value = ''; successMessage.value = ''
  const user = auth?.currentUser
  if (!user?.email) { loadError.value = 'Your account is not available. Please sign in again.'; return }
  if (password.next !== password.confirm) { loadError.value = 'The new passwords do not match.'; return }
  if (password.next.length < 8) { loadError.value = 'Use at least 8 characters for your new password.'; return }
  savingPassword.value = true
  try {
    const credential = EmailAuthProvider.credential(user.email, password.current)
    await reauthenticateWithCredential(user, credential)
    await updatePassword(user, password.next)
    password.current = ''; password.next = ''; password.confirm = ''
    successMessage.value = 'Your password has been changed.'
  } catch (error) {
    const code = (error as { code?: string }).code
    loadError.value = code === 'auth/wrong-password' || code === 'auth/invalid-credential'
      ? 'Your current password is incorrect.'
      : dataConnectRequestError(error, 'Could not change your password.')
  } finally { savingPassword.value = false }
}
</script>

<style scoped>
.settings-page{max-width:1060px;margin:0 auto;padding:28px 34px 110px}.settings-header{display:flex;align-items:center;justify-content:space-between}.back{display:grid;place-items:center;width:40px;height:40px;border:1px solid var(--line);border-radius:10px;background:var(--surface);color:var(--ink);font-size:19px;text-decoration:none}.page-mode{display:flex;align-items:center;gap:7px;color:var(--muted);font-size:11px}.page-mode ion-icon{color:var(--ocean);font-size:16px}.settings-layout{display:grid;grid-template-columns:230px minmax(0,1fr);gap:36px;margin-top:44px}.settings-nav{position:sticky;top:20px;display:grid;align-content:start;gap:5px;height:max-content;padding:16px 11px;border:1px solid var(--line);border-radius:14px;background:var(--surface)}.settings-nav .kicker{margin:0 10px 10px}.settings-nav a,.settings-nav button{display:flex;align-items:center;gap:10px;min-height:40px;padding:10px;border:0;border-radius:8px;background:transparent;color:var(--muted);font:inherit;font-size:11px;text-align:left;text-decoration:none;cursor:pointer}.settings-nav a:hover,.settings-nav button:hover{background:var(--light-blue);color:var(--ocean)}.settings-nav ion-icon{flex:none;font-size:17px}.kicker{margin:0;color:var(--ocean);font-size:10px;font-weight:800;letter-spacing:.11em}.settings-content{min-width:0}.settings-content h1{margin:8px 0 7px;font-size:31px;letter-spacing:-1px}.intro,.card-intro{margin:0;color:var(--muted);font-size:13px;line-height:1.55}.setting-card{margin-top:20px;padding:22px;border:1px solid var(--line);border-radius:16px;background:var(--surface);scroll-margin-top:18px}.setting-card h2{margin:6px 0}.card-intro{font-size:11px}.setting-form{display:grid;gap:13px;margin-top:18px}.setting-form label{display:grid;gap:6px;color:var(--ink);font-size:11px;font-weight:700}.setting-form input{width:100%;height:43px;padding:0 12px;border:1px solid var(--line);border-radius:9px;background:var(--surface-soft);color:var(--ink);font:inherit;font-size:12px}.setting-form input:focus{outline:2px solid color-mix(in srgb,var(--ocean) 35%,transparent)}.setting-form input[readonly]{opacity:.7}.primary{--background:var(--ocean);--box-shadow:none;--border-radius:9px;justify-self:start;height:42px;margin-top:3px;text-transform:none;font-weight:800}.appearance-card :deep(.theme-switcher){position:static;margin-top:18px;width:max-content}.mode-note{display:flex;align-items:center;gap:7px;margin-top:16px;padding-top:13px;border-top:1px solid var(--line);color:var(--muted);font-size:10px}.mode-note ion-icon{color:var(--ocean);font-size:15px}.notice{margin:14px 0 0;padding:11px 13px;border-radius:9px;font-size:11px}.notice.error{background:#fff0ee;color:#a53e35}.notice.success{background:#e9f8f1;color:#16734b}
@container passenger (max-width:700px){.settings-page{padding:20px 16px 112px}.settings-layout{display:block;margin-top:30px}.settings-nav{position:static;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));overflow:visible;gap:5px;margin-bottom:18px;padding:10px}.settings-nav .kicker{display:block;grid-column:1/-1;margin:2px 5px 4px}.settings-nav a,.settings-nav button{width:100%;min-width:0;min-height:42px;justify-content:flex-start;padding:8px;font-size:10px;white-space:normal}.settings-content h1{font-size:27px}.setting-card{padding:17px}.setting-form{gap:12px}.setting-form .primary{width:100%}.appearance-card :deep(.theme-switcher){width:100%;justify-content:center}}
</style>


