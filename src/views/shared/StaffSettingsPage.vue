<template>
  <ion-page>
    <ion-content :fullscreen="true">
      <div class="staff-settings-shell design-workspace">
        <button v-if="menuOpen" class="settings-scrim" aria-label="Close navigation" @click="menuOpen = false"></button>
        <aside class="staff-sidebar" :class="{ 'mobile-open': menuOpen }"><BrandMark /><StaffNavigation :role="role === 'boarding' ? 'boarding' : 'ticketing'" @navigate="menuOpen = false" /></aside>
        <section class="staff-settings-main">
          <StaffWorkspaceHeader :role="role" navigation :menu-open="menuOpen" @toggle-menu="menuOpen = !menuOpen" />
          <main class="staff-settings-page">

        <section class="page-heading">
          <div>
            <h1>Account settings</h1>
            <p>Keep your contact details and sign-in preferences up to date.</p>
          </div>
          <router-link class="settings-back" :to="workspacePath"><BackIcon /> Back to workspace</router-link>
        </section>

        <div class="settings-layout">
          <nav class="settings-nav" aria-label="Staff settings sections">
            <p class="nav-title">PREFERENCES</p>
            <a
              v-for="item in sections"
              :key="item.path"
              :href="item.path"
              :class="{ active: section === item.section }"
              :aria-current="section === item.section ? 'page' : undefined"
              @click="navigateSection($event, item.path)"
              ><AppIcon :icon="item.icon" /><span>{{ item.label }}</span
              ></a>
          </nav>

          <section class="settings-card" :class="{ 'account-section': section === 'account' }">
            <template v-if="section === 'account'">
              <div class="card-heading">
                <div>
                  <h2>Profile details</h2>
                  <p>Information linked to your staff account.</p>
                </div>
                <AppIcon :icon="personOutline" />
              </div>
              <div class="account-overview">
              <div class="identity-card">
                <span class="avatar">{{ initials }}</span>
                <div>
                  <strong>{{ displayName }}</strong
                  ><span>{{ roleLabel }}</span>
                </div>
              </div>
              <p v-if="profileLoading" class="feedback">Loading profile…</p>
              <p v-if="profileError" class="feedback error" role="alert">
                {{ profileError }}
              </p>
              <button
                v-if="profileError"
                type="button"
                :disabled="profileLoading"
                @click="loadProfile"
              >
                Retry loading
              </button>
              <div class="detail-grid">
                <div class="detail">
                  <span>Email address</span
                  ><strong>{{
                    profile?.email || auth?.currentUser?.email || "Unavailable"
                  }}</strong>
                </div>
                <div class="detail">
                  <span>Staff role</span><strong>{{ roleLabel }}</strong>
                </div>
              </div>
              </div>
              <form class="phone-form" @submit.prevent="savePhone">
                <div>
                  <h3>Contact number</h3>
                  <p>Staff can use this number to reach you about a shift.</p>
                </div>
                <label for="staff-phone">Mobile number</label>
                <div class="phone-actions">
                  <input
                    id="staff-phone"
                    v-model.trim="phone"
                    type="tel"
                    inputmode="tel"
                    autocomplete="tel"
                    maxlength="30"
                    placeholder="09XX XXX XXXX"
                    :disabled="profileLoading || savingPhone || !profile"
                  /><button data-slot="button" data-variant="default" data-size="default"
                    type="submit"
                    :disabled="
                      savingPhone ||
                      profileLoading ||
                      !profile ||
                      phone.trim() === (profile.phone || '')
                    "
                  >
                    {{ savingPhone ? "Saving…" : "Save number" }}
                  </button>
                </div>
                <button
                  v-if="phoneDirty" class="discard-phone"
                  type="button"
                  :disabled="savingPhone"
                  @click="discardPhone"
                >
                  Discard changes
                </button>
                <p
                  v-if="phoneMessage"
                  :class="['feedback', phoneMessageType]"
                  :role="phoneMessageType === 'error' ? 'alert' : 'status'"
                >
                  {{ phoneMessage }}
                </p>
              </form>
            </template>

            <template v-else-if="section === 'security'">
              <TwoFactorSettings ref="mfaSettingsRef" />
              <div class="card-heading">
                <div>
                  <h2>Change password</h2>
                  <p>
                    Confirm your current password before choosing a new one.
                  </p>
                </div>
                <AppIcon :icon="shieldCheckmarkOutline" />
              </div>
              <form class="password-form" @submit.prevent="changePassword">
                <label
                  class="current-password-field">Current password<input
                    v-model="password.current"
                    :type="showPasswords ? 'text' : 'password'"
                    :disabled="savingPassword"
                    autocomplete="current-password"
                    required
                /></label>
                <label
                  >New password<input
                    v-model="password.next"
                    :type="showPasswords ? 'text' : 'password'"
                    :disabled="savingPassword"
                    autocomplete="new-password"
                    minlength="8"
                    required
                /></label>
                <label
                  >Confirm new password<input
                    v-model="password.confirm"
                    :type="showPasswords ? 'text' : 'password'"
                    :disabled="savingPassword"
                    autocomplete="new-password"
                    minlength="8"
                    required
                /></label>
                <label class="password-toggle"
                  ><input v-model="showPasswords" type="checkbox" />Show
                  passwords</label
                >
                <p
                  v-if="passwordMessage"
                  :class="['feedback', passwordMessageType]"
                  :role="passwordMessageType === 'error' ? 'alert' : 'status'"
                >
                  {{ passwordMessage }}
                </p>
                <button data-slot="button" data-variant="default" data-size="default" type="submit" :disabled="savingPassword">
                  {{ savingPassword ? "Updating…" : "Update password" }}
                </button>
              </form>
            </template>

            <template v-else>
              <div class="card-heading">
                <div>
                  <h2>Color theme</h2>
                  <p>Choose how BarkoLink looks on this device.</p>
                </div>
                <AppIcon :icon="contrastOutline" />
              </div>
              <div class="theme-card">
                <ThemeSwitcher />
                <AppearancePreview />
                <p>System mode follows your device preference.</p>
              </div>
            </template>
          </section>
        </div>
      </main>
        </section>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { notifyError, notifySuccess } from '@/composables/toast';
import BackIcon from "@/components/ui/icon/BackIcon.vue";
import BrandMark from "../../components/shared/BrandMark.vue";
import StaffNavigation from "../../components/staff/StaffNavigation.vue";
import StaffWorkspaceHeader from "../../components/staff/StaffWorkspaceHeader.vue";
import { useUnsavedChanges } from "../../composables/unsavedChanges";
import { validatedProfile } from "../../data/profileValidation";
import { databaseRequestError } from "../../data/databaseErrors";
import { computed, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import { useRoute } from "vue-router";
import {
  PasswordAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from "../../services/auth";
import { IonContent, IonPage, onIonViewWillEnter, useIonRouter } from "@ionic/vue";
import AppIcon from "@/components/ui/icon/AppIcon.vue";
import { contrastOutline, personOutline, shieldCheckmarkOutline } from "ionicons/icons";
import ThemeSwitcher from "../../components/shared/ThemeSwitcher.vue";
import TwoFactorSettings from "../../components/shared/TwoFactorSettings.vue";
import AppearancePreview from "../../components/shared/AppearancePreview.vue";
import { myProfile, updateMyProfile } from "../../services/database/passenger";
import { auth, database } from "../../services/session";

type StaffProfile = {
  fullName: string;
  email: string;
  phone?: string | null;
  role: string;
};
const route = useRoute();
const mfaSettingsRef=ref<InstanceType<typeof TwoFactorSettings>|null>(null);
const ionRouter = useIonRouter();
const menuOpen = ref(false);
const role = computed(() => String(route.params.role));
const section = computed(() => String(route.params.section || "account"));
const workspacePath = computed(() => `/staff/${role.value}`);
const roleLabel = computed(() =>
  role.value === "boarding" ? "Boarding staff" : "Ticketing staff",
);
const profile = ref<StaffProfile | null>(null);
const profileLoading = ref(false);
const profileError = ref("");
const phone = ref("");
const phoneDirty = computed(() => phone.value !== (profile.value?.phone || ""));
const showPasswords = ref(false);
let profileRequest = 0;
function discardPhone() {
  phone.value = profile.value?.phone || "";
  phoneMessage.value = "";
}
function clearPasswords() {
  password.current = "";
  password.next = "";
  password.confirm = "";
  showPasswords.value = false;
}
const savingPhone = ref(false);
const phoneMessage = ref("");
const phoneMessageType = ref<"error" | "success">("error");
const displayName = computed(
  () =>
    profile.value?.fullName ||
    auth?.currentUser?.displayName ||
    auth?.currentUser?.email?.split("@")[0] ||
    "Staff member",
);
const initials = computed(() =>
  displayName.value
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase(),
);
const sections = computed(() => [
  {
    section: "account",
    label: "Account",
    icon: personOutline,
    path: `${workspacePath.value}/settings/account`,
  },
  {
    section: "security",
    label: "Security",
    icon: shieldCheckmarkOutline,
    path: `${workspacePath.value}/settings/security`,
  },
  {
    section: "appearance",
    label: "Appearance",
    icon: contrastOutline,
    path: `${workspacePath.value}/settings/appearance`,
  },
]);
const password = reactive({ current: "", next: "", confirm: "" });
useUnsavedChanges(() => (!!profile.value && phoneDirty.value) || !!(password.current || password.next || password.confirm));
const savingPassword = ref(false);
const passwordMessage = ref("");
const passwordMessageType = ref<"error" | "success">("error");

onMounted(() => {
  if (section.value === "account") void loadProfile();
});
onIonViewWillEnter(() => {
  void mfaSettingsRef.value?.refresh();
  clearPasswords();
  if (section.value === "account") void loadProfile();
});
onBeforeUnmount(() => {
  profileRequest++;
  clearPasswords();
});

async function loadProfile() {
  if (
    profileLoading.value ||
    savingPhone.value ||
    (profile.value && phoneDirty.value)
  )
    return;
  const request = ++profileRequest;
  const uid = auth?.currentUser?.uid;
  if (!database) {
    profileError.value = "Profile service is unavailable.";
    return;
  }
  profileLoading.value = true;
  profileError.value = "";
  try {
    const result = await myProfile(database, { fetchPolicy: "SERVER_ONLY" });
    if (request !== profileRequest || uid !== auth?.currentUser?.uid) return;
    profile.value = result.data.user ?? null;
    if (!profile.value) {
      profileError.value = "Staff profile was not found.";
      return;
    }
    phone.value = profile.value.phone || "";
  } catch (error) {
    profileError.value = notifyError(databaseRequestError(
      error,
      "Could not load staff profile.",
    ));
  } finally {
    if (request === profileRequest) profileLoading.value = false;
  }
}

async function savePhone() {
  if (
    !database ||
    !profile.value ||
    profileLoading.value ||
    savingPhone.value ||
    !phoneDirty.value
  )
    return;
  savingPhone.value = true;
  phoneMessage.value = "";
  try {
    const values = validatedProfile(profile.value.fullName, phone.value);
    await updateMyProfile(database, values);
    profile.value = { ...profile.value, phone: values.phone };
    phone.value = values.phone || "";
    phoneMessageType.value = "success";
    notifySuccess("Contact number saved.");
  } catch (error) {
    phoneMessageType.value = "error";
    phoneMessage.value = notifyError(databaseRequestError(
      error,
      "Could not save contact number.",
    ));
  } finally {
    savingPhone.value = false;
  }
}

function navigateSection(event: MouseEvent, path: string) {
  if (
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  )
    return;
  event.preventDefault();
  if (route.path !== path) ionRouter.navigate(path, "root", "push");
}

async function changePassword() {
  if (savingPassword.value) return;
  passwordMessageType.value = "error";
  passwordMessage.value = "";
  const currentUser = auth?.currentUser;
  if (!currentUser?.email) {
    passwordMessage.value = "Your staff account is unavailable. Sign in again.";
    return;
  }
  if (password.next !== password.confirm) {
    passwordMessage.value = "New passwords do not match.";
    return;
  }
  if (password.next.length < 8) {
    passwordMessage.value = "Use at least 8 characters for your new password.";
    return;
  }
  if (password.next === password.current) {
    passwordMessage.value =
      "Choose a password different from your current password.";
    return;
  }
  savingPassword.value = true;
  const newPassword = password.next;
  try {
    await reauthenticateWithCredential(
      currentUser,
      PasswordAuthProvider.credential(currentUser.email, password.current),
    );
    await updatePassword(currentUser, newPassword);
    password.current = "";
    password.next = "";
    password.confirm = "";
    passwordMessageType.value = "success";
    notifySuccess("Password updated.");
  } catch (error) {
    passwordMessageType.value = "error";
    const code = (error as { code?: string }).code;
    passwordMessage.value =
      notifyError(code === "auth/invalid-credential" ||
      code === "auth/wrong-password" ||
      code === "invalid_credentials"
        ? "Current password is incorrect."
        : databaseRequestError(error, "Could not update password."));
  } finally {
    savingPassword.value = false;
  }
}
</script>

<style scoped>
.staff-settings-shell { min-height: 100dvh; background: var(--cloud); color: var(--ink); }
.staff-sidebar { position: fixed; inset: 0 auto 0 0; width: 235px; display: flex; flex-direction: column; padding: 26px 16px; z-index: 20; }
.staff-sidebar :deep(.brand-copy strong), .staff-sidebar :deep(.brand-copy b) { color: white; }
.staff-sidebar :deep(.brand-copy small) { color: #8eb8cc; }
.staff-sidebar :deep(.staff-navigation) { flex: 1; min-height: 0; overflow-y: auto; margin-top: 22px; }
.staff-settings-main { margin-left: 235px; min-width: 0; }
.settings-scrim { display: none; }
.staff-settings-page { max-width: 1040px; margin: 0 auto; padding: 24px 28px 32px; }
.page-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 22px; }
.page-heading h1 { margin: 0 0 6px; font-size: 27px; font-weight: 650; letter-spacing: -.035em; }
.page-heading p, .card-heading p, .phone-form p, .theme-card p { margin: 0; color: var(--muted); font-size: 13px; line-height: 1.55; }
.settings-back { display: inline-flex; align-items: center; gap: 7px; flex-shrink: 0; min-height: 40px; padding: 8px 10px; color: var(--muted); font-size: 12px; text-decoration: none; border-radius: 8px; }
.settings-back:hover { background: var(--light-blue); color: var(--ocean); }
.settings-back .app-icon { font-size: 17px; }
.settings-layout { display: grid; grid-template-columns: minmax(0, 1fr); gap: 20px; }
.settings-nav { display: flex; width: fit-content; max-width: 100%; gap: 4px; padding: 4px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface-soft); }
.nav-title { display: none; }
.settings-nav a { display: flex; align-items: center; justify-content: center; gap: 8px; min-height: 42px; padding: 10px 16px; border: 1px solid transparent; border-radius: 8px; color: var(--muted); font-size: 13px; font-weight: 500; text-decoration: none; }
.settings-nav a .app-icon { flex: none; font-size: 17px; }
.settings-nav a.active { border-color: var(--line); background: var(--surface); color: var(--ocean); box-shadow: var(--card-shadow); }
.settings-nav a:hover { color: var(--ocean); }
.settings-card { min-width: 0; padding: 24px; border: 1px solid var(--line); border-radius: 14px; background: var(--surface); box-shadow: var(--card-shadow); }
.settings-card.account-section { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 22px 28px; }
.card-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-bottom: 18px; margin-bottom: 22px; border-bottom: 1px solid var(--line); }
.account-section > .card-heading { grid-column: 1 / -1; margin-bottom: 0; }
.card-heading h2 { margin: 0 0 6px; font-size: 17px; font-weight: 600; letter-spacing: -.02em; }
.card-heading > .app-icon { flex: none; width: 34px; height: 34px; padding: 8px; border-radius: 9px; background: var(--light-blue); color: var(--ocean); }
.account-overview { min-width: 0; }
.identity-card { display: flex; align-items: center; gap: 12px; margin-bottom: 18px; }
.avatar { display: grid; place-items: center; flex: none; width: 44px; height: 44px; border: 1px solid var(--line); border-radius: 12px; background: var(--light-blue); color: var(--ocean); font-size: 14px; font-weight: 600; }
.identity-card strong { display: block; overflow-wrap: anywhere; font-size: 14px; font-weight: 600; }
.identity-card div span { display: block; margin-top: 4px; color: var(--muted); font-size: 12px; }
.detail-grid { display: grid; gap: 16px; }
.detail { min-width: 0; }
.detail span { display: block; color: var(--muted); font-size: 12px; }
.detail strong { display: block; margin-top: 6px; font-size: 13px; font-weight: 400; overflow-wrap: anywhere; }
.phone-form { display: grid; align-content: start; align-self: start; gap: 12px; padding-left: 28px; border-left: 1px solid var(--line); }
.phone-form h3 { margin: 0 0 6px; font-size: 14px; font-weight: 600; }
.phone-form label, .password-form label { color: var(--ink); font-size: 13px; font-weight: 500; }
.phone-actions { display: flex; flex-direction: column; align-items: flex-start; gap: 16px; }
.phone-actions input, .password-form input { width: 100%; min-width: 0; height: 44px; padding: 0 12px; border: 1px solid var(--line); border-radius: 9px; background: var(--surface-soft); color: var(--ink); font: inherit; font-size: 14px; font-weight: 400; }
.phone-actions input:focus-visible, .password-form input:focus-visible, a:focus-visible, button:focus-visible { outline: 2px solid var(--ocean); outline-offset: 3px; }
.discard-phone { justify-self: start; min-height: 42px; padding: 10px 14px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); color: var(--ink); font: inherit; font-size: 13px; cursor: pointer; }
.password-form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
.password-form label { display: grid; gap: 8px; min-width: 0; }
.current-password-field, .password-toggle, .password-form > button, .password-form > .feedback { grid-column: 1 / -1; }
.current-password-field { max-width: calc(50% - 9px); }
.password-form > button { justify-self: start; }
.password-toggle { display: flex !important; align-items: center; gap: 8px; }
.password-toggle input { width: 18px; height: 18px; }
.feedback { margin: 0; color: var(--muted); font-size: 12px; line-height: 1.6; overflow-wrap: anywhere; }
.feedback.error { color: var(--danger, #ce4758); }
.feedback.success { color: var(--teal); }
.theme-card :deep(.theme-switcher) { position: static; box-shadow: none; }
.theme-card > p { margin-top: 14px; font-size: 12px; }
@media (max-width: 1100px) {
  .settings-card.account-section { grid-template-columns: minmax(0, 1fr); }
  .phone-form { padding: 20px 0 0; border-left: 0; border-top: 1px solid var(--line); }
  .phone-actions { flex-direction: row; align-items: center; gap: 10px; }
  .phone-actions input { flex: 1; }
  .phone-actions button { flex-shrink: 0; }
}
@media (max-width: 800px) {
  .staff-settings-main { margin-left: 0; }
  .staff-sidebar { display: none; }
  .staff-sidebar.mobile-open { display: flex; width: min(84vw, 300px); z-index: 31; box-shadow: 12px 0 36px #020b1880; }
  .settings-scrim { position: fixed; inset: 0; display: block; width: 100%; height: 100%; z-index: 30; border: 0; background: #061222a8; }
  .staff-settings-page { padding: 20px 16px 28px; }
}
@media (max-width: 600px) {
  .page-heading { flex-wrap: wrap; gap: 8px; margin-bottom: 18px; }
  .page-heading h1 { font-size: 24px; }
  .settings-back { padding-left: 0; }
  .settings-nav { width: 100%; }
  .settings-nav a { flex: 1; min-width: 0; padding: 8px; gap: 6px; font-size: 12px; }
  .settings-card { padding: 18px; }
  .settings-card.account-section { gap: 20px; }
  .password-form { grid-template-columns: minmax(0, 1fr); gap: 16px; }
  .current-password-field { max-width: none; }
  .phone-actions { flex-direction: column; align-items: stretch; }
  .phone-actions input { flex: auto; }
  .theme-card :deep(.theme-switcher) { width: 100%; }
}
</style>
