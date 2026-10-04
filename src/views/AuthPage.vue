<template>
  <ion-page>
    <ion-content :fullscreen="true">
      <main class="auth-page">
        <section class="auth-art">
          <RouterLink class="brand-link" to="/"><BrandMark /></RouterLink>
          <div class="art-copy"><p class="kicker">TRAVEL SMARTER. SAIL EASIER.</p><h1>Your next<br><em>journey</em> starts here.</h1><p>Book ferry trips, keep your ticket close, and move through every port with confidence.</p></div>
          <div class="auth-benefits"><span><ion-icon :icon="searchOutline" /> Simple trip search</span><span><ion-icon :icon="ticketOutline" /> Tickets in one place</span></div>
          <div class="sea-lines"><i></i><i></i><i></i></div><div class="art-boat" aria-hidden="true"><span></span><b></b><i></i></div>
        </section>

        <section class="auth-form">
          <div class="form-inner">
            <RouterLink class="mobile-back" to="/" aria-label="Back to home"><ion-icon :icon="arrowBackOutline" aria-hidden="true" /></RouterLink>
            <div class="form-heading"><p class="kicker">BARKOLINK PASSENGER</p><h1>{{ isRegister ? 'Create your account' : 'Welcome back' }}</h1><p>{{ isRegister ? 'Create your account to book trips and access your tickets.' : 'Sign in to manage your trips and tickets.' }}</p></div>
            <form @submit.prevent="submit">
              <label v-if="isRegister" for="full-name">Full name<input id="full-name" v-model.trim="fullName" autocomplete="name" name="name" placeholder="Juan Dela Cruz" required></label>
              <label for="email">Email address<input id="email" v-model.trim="email" autocomplete="email" name="email" type="email" placeholder="juan@example.com" required></label>
              <label for="password">Password<div class="password-field"><input id="password" v-model="password" :autocomplete="isRegister ? 'new-password' : 'current-password'" name="password" :type="showPassword ? 'text' : 'password'" :placeholder="isRegister ? 'At least 8 characters' : 'Enter your password'" :minlength="isRegister ? 8 : 6" required><button class="visibility-button" type="button" :aria-label="showPassword ? 'Hide password' : 'Show password'" @click="showPassword = !showPassword"><ion-icon :icon="showPassword ? eyeOffOutline : eyeOutline" /></button></div></label>
              <label v-if="isRegister" for="confirm-password">Confirm password<input id="confirm-password" v-model="confirmPassword" autocomplete="new-password" name="confirm-password" type="password" placeholder="Re-enter your password" minlength="8" required></label>
              <p v-if="errorMessage" class="form-message" role="alert">{{ errorMessage }}</p>
              <div v-if="!isRegister" class="form-options"><label class="check" for="remember"><input id="remember" v-model="remember" type="checkbox"><span>Remember me</span></label><button class="text-button" type="button" @click="resetPassword">Send reset link</button></div>
              <p v-if="recoveryMessage" class="recovery-note" role="status">{{ recoveryMessage }}</p>
              <label v-if="isRegister" class="check terms" for="terms"><input id="terms" v-model="acceptedTerms" type="checkbox" required><span>I agree to the prototype’s Terms and Privacy Policy.</span></label>
              <ion-button type="submit" expand="block" class="submit-button">{{ isRegister ? 'Create account' : 'Sign in' }} <ion-icon slot="end" :icon="arrowForwardOutline" /></ion-button>
            </form>
            <p class="switch-copy">{{ isRegister ? 'Already have an account?' : "Don't have an account?" }} <RouterLink :to="isRegister ? '/login' : '/register'">{{ isRegister ? 'Sign in' : 'Create account' }}</RouterLink></p>
            <div class="prototype-box"><span class="prototype-icon"><ion-icon :icon="codeSlashOutline" /></span><div><strong>Secure account</strong><p>Your sign-in is handled by Firebase Authentication.</p></div></div>
          </div>
        </section>
      </main>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { IonButton, IonContent, IonIcon, IonPage } from '@ionic/vue'
import { arrowBackOutline, arrowForwardOutline, codeSlashOutline, eyeOffOutline, eyeOutline, searchOutline, ticketOutline } from 'ionicons/icons'
import { createUserWithEmailAndPassword, sendPasswordResetEmail, signInWithEmailAndPassword, updateProfile } from 'firebase/auth'
import BrandMark from '../../components/BrandMark.vue'
import { createMyProfile, myProfile } from '../dataconnect-generated/passenger'
import { dataConnect, requireAuth } from '../services/firebase'
import { resolveAccountRole, roleDestination } from '../data/sessionRole'
import { dataConnectRequestError } from '../data/dataConnectErrors'

const route = useRoute()
const router = useRouter()
const isRegister = computed(() => route.path === '/register')
const fullName = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const acceptedTerms = ref(false)
const remember = ref(true)
const showPassword = ref(false)
const errorMessage = ref(String(route.query.sessionError || ''))
const recoveryMessage = ref('')

watch(() => route.fullPath, () => {
  errorMessage.value = String(route.query.sessionError || '')
  recoveryMessage.value = ''
})

async function resetPassword() {
  errorMessage.value = ''
  recoveryMessage.value = ''
  if (!email.value.trim()) { errorMessage.value = 'Enter your email address first.'; return }
  try { await sendPasswordResetEmail(requireAuth(), email.value.trim()); recoveryMessage.value = 'Password reset instructions were sent to your email.' }
  catch (error) { errorMessage.value = (error as {message?:string}).message || 'Could not send password reset email.' }
}

async function submit() {
  errorMessage.value = ''
  if (isRegister.value && password.value !== confirmPassword.value) {
    errorMessage.value = 'Passwords do not match. Please check and try again.'
    return
  }
  let stage: 'authentication' | 'profile' | 'navigation' = 'authentication'
  let createdAuthAccount = false
  try {
    const auth = requireAuth()
    if (!dataConnect) throw new Error('Firebase Data Connect is not configured.')
    let defaultDestination = '/home'
    if (isRegister.value) {
      const credential = await createUserWithEmailAndPassword(auth, email.value, password.value)
      createdAuthAccount = true
      stage = 'profile'
      await updateProfile(credential.user, { displayName: fullName.value })
      await createMyProfile(dataConnect, { email: credential.user.email || email.value, fullName: fullName.value })
    } else {
      const credential = await signInWithEmailAndPassword(auth, email.value, password.value)
      const token = await credential.user.getIdTokenResult(true)
      const claimedRole = token.claims.role ? resolveAccountRole(token.claims.role) : null
      if (claimedRole && claimedRole !== 'PASSENGER') {
        defaultDestination = roleDestination(claimedRole)
      } else {
        stage = 'profile'
        const profile = await myProfile(dataConnect, { fetchPolicy: 'SERVER_ONLY' })
        if (!profile.data.user) {
          await createMyProfile(dataConnect, {
            email: credential.user.email || email.value,
            fullName: credential.user.displayName || email.value.split('@')[0],
          })
        } else {
          defaultDestination = roleDestination(resolveAccountRole(token.claims.role, profile.data.user.role))
        }
      }
    }
    stage = 'navigation'
    // A completed sign-in starts a new navigation stack. Ionic treats replace as
    // a root transition, so the passenger frame can resize before /home renders.
    await router.replace(String(route.query.redirect || defaultDestination))
  } catch (error) {
    const code = (error as { code?: string }).code
    const message = (error as { message?: string }).message
    const errors: Record<string, string> = {
      'auth/email-already-in-use': 'An account already uses this email. Sign in instead.',
      'auth/invalid-credential': 'That email and password do not match an account.',
      'auth/invalid-email': 'Enter a valid email address.',
      'auth/weak-password': 'Choose a stronger password with at least 8 characters.',
      'auth/network-request-failed': 'Could not reach Firebase. Check your internet connection and try again.',
    }
    errorMessage.value = (code && errors[code]) || dataConnectRequestError(error, '') || (message?.includes('Firebase is not configured')
      ? 'Firebase is not configured yet. Add the Web app settings to .env.local to enable sign in.'
      : createdAuthAccount && stage === 'profile'
        ? 'Your account was created, but the passenger profile could not be saved. Sign in to finish setup.'
        : stage === 'profile'
          ? 'Firebase sign-in succeeded, but your passenger profile could not be loaded. Please try again.'
          : stage === 'navigation'
            ? 'Sign-in succeeded, but the destination page could not be opened. Please try again.'
            : 'We could not complete sign in. Please check your email and password.')
  }
}
</script>

<style scoped>
.auth-page{display:grid;grid-template-columns:minmax(360px,.9fr) 1.1fr;min-height:100vh;background:var(--cloud);color:var(--ink)}.auth-art{position:relative;min-height:100vh;overflow:hidden;padding:34px 8%;background:var(--deep);color:#fff}.brand-link{display:inline-flex;text-decoration:none}.auth-art :deep(.brand-mark){color:#fff}.auth-art :deep(.brand-copy strong),.auth-art :deep(.brand-copy b){color:#fff}.auth-art :deep(.brand-copy small){color:#a3c8dd}.auth-art :deep(.brand-symbol){background:var(--ocean)}.art-copy{position:relative;z-index:2;margin-top:clamp(105px,22vh,230px);max-width:390px}.kicker{margin:0;color:var(--primary);font-size:10px;font-weight:900;letter-spacing:.12em}.art-copy h1{margin:12px 0;font-size:clamp(43px,5vw,60px);line-height:.98;letter-spacing:-.055em}.art-copy em{color:#7cc4e5;font-style:normal}.art-copy>p:last-child{max-width:305px;color:#b3c5d6;font-size:14px;line-height:1.7}.auth-benefits{position:relative;z-index:2;display:grid;gap:13px;margin-top:32px;color:#c3d3df;font-size:11px;font-weight:700}.auth-benefits span{display:flex;align-items:center;gap:9px}.auth-benefits ion-icon{color:#7cc4e5;font-size:17px}.sea-lines{position:absolute;right:-80px;bottom:13%;width:500px;opacity:.25}.sea-lines i{display:block;height:28px;border-top:2px solid #7cc4e5;border-radius:50%;transform:rotate(-8deg);margin:-1px}.art-boat{position:absolute;right:13%;bottom:17%;width:210px;height:90px}.art-boat:before{content:'';position:absolute;bottom:0;width:195px;height:32px;border-radius:0 0 80px 80px;background:#f5f8fb;transform:skew(-20deg)}.art-boat span{position:absolute;bottom:31px;left:75px;width:58px;height:28px;background:#cde7f4;border-radius:5px 5px 0 0}.art-boat i{position:absolute;bottom:58px;left:100px;width:2px;height:36px;background:#cde7f4}.art-boat b{position:absolute;bottom:68px;left:102px;border-style:solid;border-width:8px 0 8px 23px;border-color:transparent transparent transparent #7cc4e5}.auth-form{display:grid;place-items:center;padding:36px clamp(24px,5vw,72px);background:var(--cloud)}.form-inner{width:min(100%,440px);padding:34px;border:1px solid var(--line);border-radius:20px;background:var(--surface);box-shadow:0 18px 48px rgba(8,24,45,.08)}.mobile-back{display:none}.form-heading{margin-bottom:25px}.form-heading h1{margin:9px 0 6px;font-size:34px;letter-spacing:-.045em}.form-heading>p:last-child{margin:0;color:var(--muted);font-size:13px;line-height:1.55}form{display:grid;gap:16px}form>label:not(.check){display:grid;gap:7px;color:var(--ink);font-size:11px;font-weight:800}input:not([type=checkbox]){width:100%;height:48px;padding:0 14px;border:1px solid var(--line);border-radius:10px;outline:none;background:var(--surface-soft);color:var(--ink);font:inherit;font-size:13px}input::placeholder{color:var(--muted);opacity:.8}input:focus{border-color:var(--ocean);box-shadow:0 0 0 3px color-mix(in srgb,var(--ocean) 16%,transparent)}.password-field{position:relative}.password-field input{padding-right:47px}.visibility-button{position:absolute;top:0;right:3px;display:grid;place-items:center;width:42px;height:48px;border:0;background:transparent;color:var(--muted);font-size:18px;cursor:pointer}.form-options{display:flex;align-items:center;justify-content:space-between;gap:10px}.check{display:flex!important;align-items:center;gap:8px!important;color:var(--muted)!important;font-size:11px!important;font-weight:600!important}.check input{width:15px;height:15px;margin:0;accent-color:var(--ocean)}.text-button{padding:0;border:0;background:transparent;color:var(--ocean);font:inherit;font-size:10px;font-weight:800;cursor:pointer}.terms{align-items:flex-start!important;line-height:1.5}.terms input{flex:0 0 auto;margin-top:1px}.submit-button{--background:var(--ocean);--color:#fff;--box-shadow:none;--border-radius:10px;height:49px;margin:3px 0 0;text-transform:none;font-weight:800}.form-message{margin:-4px 0;color:#d04f4f;font-size:11px;font-weight:700}.recovery-note{margin:-5px 0 0;padding:10px 12px;border:1px solid var(--line);border-radius:9px;background:var(--surface);color:var(--muted);font-size:10px;line-height:1.5}.switch-copy{margin:21px 0 22px;text-align:center;color:var(--muted);font-size:12px}.switch-copy a{color:var(--ocean);font-weight:800;text-decoration:none}.prototype-box{display:grid;grid-template-columns:36px 1fr auto;align-items:center;gap:10px;padding:12px;border:1px solid var(--line);border-radius:12px;background:var(--surface)}.prototype-icon{display:grid;place-items:center;width:34px;height:34px;border-radius:10px;background:var(--light-blue);color:var(--ocean);font-size:17px}.prototype-box strong{font-size:10px}.prototype-box p{margin:3px 0 0;color:var(--muted);font-size:9px}.prototype-box>a{display:flex;align-items:center;gap:4px;color:var(--ocean);font-size:9px;font-weight:800;text-decoration:none;white-space:nowrap}
@media(max-width:760px){.auth-page{display:block}.auth-art{min-height:220px;min-height:0;padding:20px 24px 23px}.auth-art .brand-copy small{display:none}.art-copy{margin-top:29px}.art-copy h1{margin:8px 0;font-size:34px}.art-copy>p:last-child,.auth-benefits,.sea-lines,.art-boat{display:none}.auth-form{min-height:calc(100vh - 220px);padding:25px 24px 38px}.form-inner{max-width:480px;padding:28px 24px;border-radius:17px}.mobile-back{display:grid;place-items:center;width:38px;height:38px;margin-bottom:19px;border:1px solid var(--line);border-radius:10px;background:var(--surface);color:var(--ink);font-size:18px;text-decoration:none}.form-heading{margin-bottom:23px}.form-heading h1{font-size:29px}.prototype-box{grid-template-columns:34px 1fr auto}}
@media(max-width:390px){.auth-art{padding:18px 19px 20px}.auth-form{padding:20px 15px 32px}.form-inner{padding:24px 18px}.form-heading h1{font-size:26px}.prototype-box{grid-template-columns:32px 1fr}.prototype-box>a{grid-column:2;justify-self:start}.form-options{align-items:flex-start}.text-button{text-align:right}}
</style>
