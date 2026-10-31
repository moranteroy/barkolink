<template>
  <ion-page>
    <ion-content ref="settingsScroller" :fullscreen="true">
      <div :class="{ 'admin-account-shell design-workspace': isAdmin }">
        <button v-if="isAdmin && adminMenuOpen" class="admin-settings-scrim" aria-label="Close menu" @click="adminMenuOpen = false"></button>
        <AdminSidebar v-if="isAdmin" :menu-open="adminMenuOpen" section="account-settings" @navigate="adminMenuOpen = false" />
        <div :class="{ 'admin-account-workspace': isAdmin }">
          <AdminWorkspaceHeader v-if="isAdmin" :menu-open="adminMenuOpen" section="account-settings" @open-menu="adminMenuOpen = true" />
      <main class="settings-page" :class="{ 'workplace-settings': !isPassenger }">
        <PassengerHeader v-if="isPassenger" />
        <header v-else-if="!isAdmin" class="settings-header">
          <router-link
            :to="backPath"
            class="back"
            :aria-label="
              isAdmin
                ? 'Back to admin dashboard'
                : isStaff
                  ? 'Back to staff workspace'
                  : 'Back to home'
            "
            ><BackIcon /><span>{{ isAdmin ? 'Back to dashboard' : 'Back to workspace' }}</span></router-link>
          <BrandMark />
          <span class="page-mode"
            ><AppIcon :icon="settingsOutline" /> Account settings</span
          >
        </header>
        <section class="settings-layout">
          <nav class="settings-nav" aria-label="Settings sections">
            <p class="kicker">SETTINGS</p>
            <a
              :href="`${settingsPath}/appearance`"
              :class="{ active: route.path === `${settingsPath}/appearance` }"
              :aria-current="
                route.path === `${settingsPath}/appearance` ? 'page' : undefined
              "
              @click="navigateSection($event, `${settingsPath}/appearance`)"
              ><AppIcon :icon="contrastOutline" />Appearance</a
            >
            <a
              :href="`${settingsPath}/profile`"
              :class="{ active: route.path === `${settingsPath}/profile` }"
              :aria-current="
                route.path === `${settingsPath}/profile` ? 'page' : undefined
              "
              @click="navigateSection($event, `${settingsPath}/profile`)"
              ><AppIcon :icon="personOutline" />Personal information</a
            >
            <a
              :href="`${settingsPath}/password`"
              :class="{ active: route.path === `${settingsPath}/password` }"
              :aria-current="
                route.path === `${settingsPath}/password` ? 'page' : undefined
              "
              @click="navigateSection($event, `${settingsPath}/password`)"
              ><AppIcon :icon="shieldCheckmarkOutline" />{{ isAdmin ? 'Security' : 'Password' }}</a
            >
            <a
              v-if="isPassenger"
              href="/notifications"
              @click="navigateSection($event, '/notifications')"
              ><AppIcon :icon="notificationsOutline" />Notifications</a
            >
          </nav>
          <section class="settings-content">
            <p v-if="isPassenger" class="kicker">ACCOUNT PREFERENCES</p>
            <h1>{{ sectionTitle }}</h1>
            <p class="intro">
              Manage your account details, password, and appearance.
            </p>
            <p v-if="loadError" class="notice error" role="alert">
              {{ loadError }}
              <button
                v-if="!profileLoaded"
                type="button"
                :disabled="profileLoading"
                @click="loadProfile"
              >
                Retry loading
              </button>
            </p>
            <p v-if="successMessage" class="notice success" role="status">
              {{ successMessage }}
            </p>

            <article v-if="showProfile" id="personal-info" class="setting-card">
              <p v-if="isPassenger" class="kicker">PERSONAL INFORMATION</p>
              <h2>Profile details</h2>
              <p class="card-intro">
                Keep your name and contact number up to date.
              </p>
              <p v-if="profileLoading" role="status">
                Loading your saved details...
              </p>
              <router-link v-if="isPassenger" to="/profile" class="profile-back"
                ><BackIcon /> Back to my profile</router-link
              >
              <form class="setting-form" @submit.prevent="saveProfile">
                <fieldset
                  :disabled="profileLoading || !profileLoaded || savingProfile"
                >
                  <legend class="sr-only">Personal information</legend>
                  <label class="name-field"
                    >Full name<input
                      v-model.trim="profile.name"
                      autocomplete="name"
                      required
                      maxlength="120"
                  /></label>
                  <label
                    >Email address<input
                      v-model="profile.email"
                      type="email"
                      autocomplete="email"
                      readonly
                    /><small
                      >Your sign-in email cannot be changed here.</small
                    ></label
                  >
                  <label
                    >Mobile number<input
                      v-model.trim="profile.phone"
                      type="tel"
                      autocomplete="tel"
                      placeholder="09XX XXX XXXX"
                      maxlength="30"
                  /></label>
                  <div class="profile-actions">
                    <ion-button
                      class="primary"
                      type="submit"
                      :disabled="
                        savingProfile ||
                        savingPassword ||
                        !profileLoaded ||
                        !profileDirty
                      "
                      >{{
                        savingProfile ? "Saving…" : "Save profile"
                      }}</ion-button
                    ><button
                      type="button"
                      class="discard"
                      :disabled="savingProfile || !profileDirty"
                      @click="discardProfile"
                    >
                      Discard changes
                    </button>
                  </div>
                </fieldset>
                <p class="profile-hint">
                  {{
                    profileDirty
                      ? "You have unsaved changes."
                      : profileLoaded
                        ? "Your saved details are up to date."
                        : "Load your profile before editing."
                  }}
                </p>
              </form>
            </article>

            <TwoFactorSettings ref="mfaSettingsRef" v-if="isAdmin && showPassword" />
            <article v-if="showPassword" id="password" class="setting-card">
              <p v-if="isPassenger" class="kicker">SECURITY</p>
              <h2>Change password</h2>
              <p class="card-intro">
                Enter your current password to confirm this change.
              </p>
              <form class="setting-form" @submit.prevent="changePassword">
                <label
                  class="current-password-field">Current password<input
                    v-model="password.current"
                    :disabled="savingPassword"
                    :type="showPasswords ? 'text' : 'password'"
                    autocomplete="current-password"
                    required
                /></label>
                <label
                  >New password<input
                    v-model="password.next"
                    :disabled="savingPassword"
                    :type="showPasswords ? 'text' : 'password'"
                    autocomplete="new-password"
                    minlength="8"
                    required
                /></label>
                <label
                  >Confirm new password<input
                    v-model="password.confirm"
                    :disabled="savingPassword"
                    :type="showPasswords ? 'text' : 'password'"
                    autocomplete="new-password"
                    minlength="8"
                    required
                /></label>
                <label class="password-toggle"
                  ><input v-model="showPasswords" type="checkbox" /> Show
                  passwords</label
                ><ion-button
                  class="primary"
                  type="submit"
                  :disabled="savingPassword || savingProfile"
                  >{{
                    savingPassword ? "Updating…" : "Update password"
                  }}</ion-button
                >
              </form>
            </article>

            <article
              v-if="showAppearance"
              id="appearance"
              class="setting-card appearance-card"
            >
              <p v-if="isPassenger" class="kicker">APPEARANCE</p>
              <h2>Color theme</h2>
              <p class="card-intro">
                Choose how BarkoLink looks on this device.
              </p>
              <ThemeSwitcher />
              <AppearancePreview />
              <div class="mode-note">
                <AppIcon :icon="informationCircleOutline" /> System mode
                follows your device preference automatically.
              </div>
            </article>
          </section>
        </section>
      </main>
      <PassengerBottomNav v-if="isPassenger" />
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { notifyError, notifySuccess, notifyValidationError } from '@/composables/toast';
import BackIcon from "@/components/ui/icon/BackIcon.vue";
import { useUnsavedChanges } from "../../composables/unsavedChanges";
import { validatedProfile } from "../../data/profileValidation";
import { databaseRequestError } from "../../data/databaseErrors";
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
} from "vue";
import {
  PasswordAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  syncAccountProfileName,
} from "../../services/auth";
import { useRoute } from "vue-router";
import { IonButton, IonContent, IonPage, onIonViewDidEnter, onIonViewWillEnter, useIonRouter } from "@ionic/vue";
import AppIcon from "@/components/ui/icon/AppIcon.vue";
import { contrastOutline, informationCircleOutline, notificationsOutline, personOutline, settingsOutline, shieldCheckmarkOutline } from "ionicons/icons";
import BrandMark from "../../components/shared/BrandMark.vue";
import AdminSidebar from '../../components/admin/AdminSidebar.vue';
import AdminWorkspaceHeader from '../../components/admin/AdminWorkspaceHeader.vue';
import PassengerHeader from "../../components/passenger/PassengerHeader.vue";
import PassengerBottomNav from "../../components/passenger/PassengerBottomNav.vue";
import ThemeSwitcher from "../../components/shared/ThemeSwitcher.vue";
import TwoFactorSettings from "../../components/shared/TwoFactorSettings.vue";
import AppearancePreview from "../../components/shared/AppearancePreview.vue";
import { myProfile, updateMyProfile } from "../../services/database/passenger";
import { auth, database } from "../../services/session";

const route = useRoute();
const mfaSettingsRef=ref<InstanceType<typeof TwoFactorSettings>|null>(null);
const ionRouter = useIonRouter();
const adminMenuOpen = ref(false);
const isAdmin = computed(() => route.path.startsWith("/admin"));
const isStaff = computed(() => route.path.startsWith("/staff/"));
const isPassenger = computed(() => !isAdmin.value && !isStaff.value);
const backPath = computed(() =>
  isAdmin.value
    ? "/admin"
    : isStaff.value
      ? `/staff/${route.params.role}`
      : "/home",
);
const settingsPath = computed(() =>
  isAdmin.value
    ? "/admin/settings"
    : isStaff.value
      ? `/staff/${route.params.role}/settings`
      : "/settings",
);
const settingsScroller = ref<InstanceType<typeof IonContent> | null>(null);
const profile = reactive({ name: "", email: "", phone: "" });
const password = reactive({ current: "", next: "", confirm: "" });
const loadError = ref("");
const successMessage = ref("");
const savingProfile = ref(false);
const savingPassword = ref(false),
  showPasswords = ref(false);
const profileLoading = ref(false),
  profileLoaded = ref(false);
const savedProfile = ref({ name: "", email: "", phone: "" });
const profileDirty = computed(
  () =>
    profile.name !== savedProfile.value.name ||
    profile.phone !== savedProfile.value.phone,
);
useUnsavedChanges(() => (profileLoaded.value && profileDirty.value) || !!(password.current || password.next || password.confirm));
const sectionTitle = computed(() =>
  route.path === `${settingsPath.value}/profile`
    ? "Personal information"
    : route.path === `${settingsPath.value}/password`
      ? "Password & security"
      : route.path === `${settingsPath.value}/appearance`
        ? "Appearance"
        : "Make BarkoLink yours.",
);
const showProfile = computed(() =>
  [settingsPath.value, `${settingsPath.value}/profile`].includes(route.path),
);
const showPassword = computed(() =>
  [settingsPath.value, `${settingsPath.value}/password`].includes(route.path),
);
const showAppearance = computed(() =>
  [settingsPath.value, `${settingsPath.value}/appearance`].includes(route.path),
);
let profileRequest = 0;
function discardProfile() {
  Object.assign(profile, savedProfile.value);
  loadError.value = "";
  successMessage.value = "";
}

async function loadProfile() {
  if (
    profileLoading.value ||
    savingProfile.value ||
    (profileLoaded.value && profileDirty.value)
  )
    return;
  const user = auth?.currentUser,
    request = ++profileRequest;
  profileLoading.value = true;
  profileLoaded.value = false;
  loadError.value = "";
  try {
    if (!database || !user)
      throw new Error("Your account is unavailable. Please sign in again.");
    const result = await myProfile(database, { fetchPolicy: "SERVER_ONLY" });
    if (request !== profileRequest || auth?.currentUser?.uid !== user.uid)
      return;
    if (!result.data.user) throw new Error("Your profile could not be found.");
    Object.assign(profile, {
      name: result.data.user.fullName,
      email: result.data.user.email,
      phone: result.data.user.phone || "",
    });
    savedProfile.value = { ...profile };
    profileLoaded.value = true;
  } catch (cause) {
    if (request === profileRequest)
      loadError.value = databaseRequestError(
        cause,
        "Could not load your profile.",
      );
  } finally {
    if (request === profileRequest) profileLoading.value = false;
  }
}
onMounted(loadProfile);
onIonViewWillEnter(() => {
  void mfaSettingsRef.value?.refresh();
  adminMenuOpen.value = false;
  password.current = "";
  password.next = "";
  password.confirm = "";
  showPasswords.value = false;
  void loadProfile();
});
onBeforeUnmount(() => {
  profileRequest++;
  password.current = "";
  password.next = "";
  password.confirm = "";
});

onIonViewDidEnter(() => {
  if (isPassenger.value) void scrollToRouteSection();
});

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
  adminMenuOpen.value = false;
  if (route.path === path) {
    if (isPassenger.value) void scrollToRouteSection();
    return;
  }
  ionRouter.navigate(path, "root", "push");
}

async function scrollToRouteSection() {
  const section =
    route.path === `${settingsPath.value}/profile`
      ? "personal-info"
      : route.path === `${settingsPath.value}/password`
        ? "password"
        : route.path === "/settings/appearance"
          ? "appearance"
          : null;
  if (!section) return;
  await nextTick();
  await new Promise((resolve) =>
    requestAnimationFrame(() => resolve(undefined)),
  );
  await scrollToSection(section);
}

async function scrollToSection(id: string) {
  const content = settingsScroller.value?.$el as
    | HTMLIonContentElement
    | undefined;
  const target = content?.querySelector<HTMLElement>(`#${id}`);
  if (!content || !target) return;
  const scrollElement = await content.getScrollElement();
  const top =
    target.getBoundingClientRect().top -
    scrollElement.getBoundingClientRect().top +
    scrollElement.scrollTop -
    12;
  await content.scrollToPoint(0, Math.max(0, top), 250);
}

async function saveProfile() {
  if (
    savingProfile.value ||
    savingPassword.value ||
    profileLoading.value ||
    !profileLoaded.value ||
    !profileDirty.value
  )
    return;
  loadError.value = "";
  successMessage.value = "";
  const user = auth?.currentUser;
  if (!database || !user) {
    loadError.value = "Your account is not available. Please sign in again.";
    return;
  }
  let values: ReturnType<typeof validatedProfile>;
  try {
    values = validatedProfile(profile.name, profile.phone);
  } catch (cause) {
    notifyValidationError((cause as Error).message);
    return;
  }
  savingProfile.value = true;
  try {
    await updateMyProfile(database, values);
    if (auth?.currentUser?.uid !== user.uid) return;
    Object.assign(profile, {
      name: values.fullName,
      phone: values.phone || "",
    });
    savedProfile.value = { ...profile };
    syncAccountProfileName(user.uid, values.fullName);
    notifySuccess("Your profile has been updated.");
  } catch (cause) {
    notifyError(databaseRequestError(
      cause,
      "Could not update your profile. Your changes are kept so you can retry.",
    ));
  } finally {
    savingProfile.value = false;
  }
}

async function changePassword() {
  if (savingPassword.value || savingProfile.value) return;
  loadError.value = "";
  successMessage.value = "";
  const user = auth?.currentUser;
  if (!user?.email) {
    loadError.value = "Your account is not available. Please sign in again.";
    return;
  }
  if (password.next !== password.confirm) {
    loadError.value = "The new passwords do not match.";
    return;
  }
  if (password.next === password.current) {
    loadError.value =
      "Choose a new password different from your current password.";
    return;
  }
  if (password.next.length < 8) {
    loadError.value = "Use at least 8 characters for your new password.";
    return;
  }
  savingPassword.value = true;
  try {
    const newPassword = password.next;
    const credential = PasswordAuthProvider.credential(
      user.email,
      password.current,
    );
    await reauthenticateWithCredential(user, credential);
    await updatePassword(user, newPassword);
    password.current = "";
    password.next = "";
    password.confirm = "";
    notifySuccess("Your password has been changed.");
  } catch (error) {
    const code = (error as { code?: string }).code;
    notifyError(code === "auth/wrong-password" ||
      code === "auth/invalid-credential" ||
      code === "invalid_credentials"
        ? "Your current password is incorrect."
        : databaseRequestError(error, "Could not change your password."));
  } finally {
    savingPassword.value = false;
  }
}
</script>

<style scoped>
.settings-page {
  max-width: 1060px;
  margin: 0 auto;
  padding: 28px 34px 110px;
}
.settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.back {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface);
  color: var(--ink);
  font-size: 19px;
  text-decoration: none;
}
.page-mode {
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--muted);
  font-size: var(--text-caption);
}
.page-mode .app-icon {
  color: var(--ocean);
  font-size: 16px;
}
.settings-layout {
  display: grid;
  grid-template-columns: 230px minmax(0, 1fr);
  gap: 36px;
  margin-top: 44px;
}
.settings-nav {
  position: sticky;
  top: 20px;
  display: grid;
  align-content: start;
  gap: 5px;
  height: max-content;
  padding: 16px 11px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--surface);
}
.settings-nav .kicker {
  margin: 0 10px 10px;
}
.settings-nav a,
.settings-nav button {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 40px;
  padding: 10px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--muted);
  font: inherit;
  font-size: var(--text-caption);
  text-align: left;
  text-decoration: none;
  cursor: pointer;
}
.settings-nav a:hover,
.settings-nav button:hover {
  background: var(--light-blue);
  color: var(--ocean);
}
.settings-nav .app-icon {
  flex: none;
  font-size: 17px;
}
.kicker {
  margin: 0;
  color: var(--ocean);
  font-size: var(--text-caption);
  font-weight: 800;
  letter-spacing: 0.11em;
}
.settings-content {
  min-width: 0;
}
.settings-content h1 {
  margin: 8px 0 7px;
  font-size: 31px;
  letter-spacing: -1px;
}
.intro,
.card-intro {
  margin: 0;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.55;
}
.setting-card {
  margin-top: 20px;
  padding: 22px;
  border: 1px solid var(--line);
  border-radius: 16px;
  background: var(--surface);
  scroll-margin-top: 18px;
}
.setting-card h2 {
  margin: 6px 0;
}
.card-intro {
  font-size: var(--text-caption);
}
.setting-form {
  display: grid;
  gap: 13px;
  margin-top: 18px;
}
.setting-form label {
  display: grid;
  gap: 6px;
  color: var(--ink);
  font-size: var(--text-caption);
  font-weight: 700;
}
.setting-form input {
  width: 100%;
  height: 43px;
  padding: 0 12px;
  border: 1px solid var(--line);
  border-radius: 9px;
  background: var(--surface-soft);
  color: var(--ink);
  font: inherit;
  font-size: var(--text-label);
  font-weight: 400;
}
.setting-form input:focus {
  outline: 2px solid color-mix(in srgb, var(--ocean) 35%, transparent);
}
.setting-form input[readonly] {
  opacity: 0.7;
}
.primary {
  --background: var(--action);
  --box-shadow: none;
  --border-radius: var(--button-radius);
  justify-self: start;
  height: 42px;
  margin-top: 3px;
  text-transform: none;
  font-weight: 800;
}
.appearance-card :deep(.theme-switcher) {
  position: static;
  margin-top: 18px;
  width: max-content;
}
.mode-note {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-top: 16px;
  padding-top: 13px;
  border-top: 1px solid var(--line);
  color: var(--muted);
  font-size: var(--text-caption);
}
.mode-note .app-icon {
  color: var(--ocean);
  font-size: 15px;
}
.notice {
  margin: 14px 0 0;
  padding: 11px 13px;
  border-radius: 9px;
  font-size: var(--text-caption);
}
.notice.error {
  background: #fff0ee;
  color: #a53e35;
}
.notice.success {
  background: #e9f8f1;
  color: #16734b;
}
@container passenger (max-width:700px) {
  .settings-page {
    padding: 20px 16px 112px;
  }
  .settings-layout {
    display: block;
    margin-top: 30px;
  }
  .settings-nav {
    position: static;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    overflow: visible;
    gap: 5px;
    margin-bottom: 18px;
    padding: 10px;
  }
  .settings-nav .kicker {
    display: block;
    grid-column: 1/-1;
    margin: 2px 5px 4px;
  }
  .settings-nav a,
  .settings-nav button {
    width: 100%;
    min-width: 0;
    min-height: 42px;
    justify-content: flex-start;
    padding: 8px;
    font-size: var(--text-caption);
    white-space: normal;
  }
  .settings-content h1 {
    font-size: 27px;
  }
  .setting-card {
    padding: 17px;
  }
  .setting-form {
    gap: 12px;
  }
  .setting-form .primary {
    width: 100%;
  }
  .appearance-card :deep(.theme-switcher) {
    width: 100%;
    justify-content: center;
  }
}
.setting-form fieldset {
  display: grid;
  gap: 13px;
  border: 0;
  padding: 0;
  margin: 0;
  min-width: 0;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
}
.profile-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.discard {
  padding: 11px 14px;
  border: 1px solid var(--line);
  border-radius: 9px;
  background: var(--surface);
  color: var(--ocean);
  font-weight: 700;
  cursor: pointer;
}
.discard:disabled {
  opacity: 0.5;
}
.profile-back {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  margin-top: 12px;
  color: var(--ocean);
  font-size: var(--text-label);
  text-decoration: none;
}
.profile-back .app-icon { font-size: 19px; flex: none; }
.profile-hint,
.setting-form small {
  font-size: var(--text-caption);
  color: var(--muted);
  font-weight: 400;
}
.password-toggle {
  display: flex !important;
  align-items: center;
  gap: 8px !important;
}
.password-toggle input {
  width: 18px;
  height: 18px;
}
.notice button {
  border: 0;
  background: transparent;
  color: var(--ocean);
  font-weight: 700;
  cursor: pointer;
}
.settings-nav a.active {
  background: var(--light-blue);
  color: var(--ocean);
}
@media (max-width: 700px) {
  .settings-page {
    padding: 20px 16px 80px;
  }
  .settings-layout {
    grid-template-columns: 1fr;
    gap: 18px;
    margin-top: 26px;
  }
  .settings-nav {
    position: static;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .settings-nav .kicker {
    grid-column: 1/-1;
  }
  .setting-card {
    padding: 17px;
  }
  .page-mode {
    display: none;
  }
}
</style>

<style scoped>
.admin-account-shell { display: flex; min-height: 100dvh; background: var(--cloud); color: var(--ink); }
.admin-account-workspace { flex: 1; min-width: 0; }
.admin-account-workspace .settings-page { max-width: 1100px; width: 100%; margin-inline: auto; padding: 24px 32px 32px; }
.admin-account-workspace .settings-layout { margin-top: 0; }
.admin-settings-scrim { display: none; }
@media (max-width: 950px) {
  .admin-settings-scrim { display: block; position: fixed; z-index: 19; inset: 0; width: 100%; height: 100%; border: 0; background: #0009; }
}
@media (max-width: 700px) {
  .admin-account-workspace .settings-page { padding: 20px 16px 28px; }
}
.workplace-settings { max-width: 1000px; padding: 24px 32px 32px; color: var(--ink); }
.workplace-settings .settings-header { position: relative; min-height: 52px; padding-bottom: 20px; border-bottom: 1px solid var(--line); }
.workplace-settings .settings-header > :deep(.brand-mark) { position: absolute; left: 50%; transform: translateX(-50%); }
.workplace-settings .back { display: inline-flex; width: auto; height: 40px; gap: 8px; padding: 0 10px; border: 0; background: transparent; color: var(--muted); font-size: 13px; }
.back span { display: none; }
.workplace-settings .back span { display: inline; }
.workplace-settings .back:hover { color: var(--ocean); background: var(--light-blue); }
.workplace-settings .page-mode { padding: 7px 10px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface); font-size: 12px; }
.workplace-settings .settings-layout { display: flex; flex-direction: column; gap: 22px; margin-top: 22px; }
.workplace-settings .settings-nav { position: static; display: flex; flex-wrap: wrap; gap: 4px; width: fit-content; max-width: 100%; height: auto; padding: 4px; border-radius: 10px; background: var(--surface-soft); }
.workplace-settings .settings-nav .kicker { display: none; }
.workplace-settings .settings-nav a { min-height: 42px; padding: 10px 16px; border: 1px solid transparent; font-size: 13px; font-weight: 500; }
.workplace-settings .settings-nav a.active { border-color: var(--line); background: var(--surface); color: var(--ocean); box-shadow: var(--card-shadow); }
.workplace-settings .settings-content h1 { margin: 0 0 6px; font-size: 27px; font-weight: 650; letter-spacing: -.035em; }
.workplace-settings .intro { font-size: 13px; }
.workplace-settings .setting-card { margin-top: 20px; padding: 24px; border-radius: 14px; box-shadow: var(--card-shadow); }
.workplace-settings .setting-card h2 { margin: 0 0 6px; font-size: 17px; font-weight: 600; letter-spacing: -.02em; }
.workplace-settings .card-intro { font-size: 13px; }
.workplace-settings .setting-form { gap: 14px; margin-top: 22px; }
.workplace-settings .setting-form fieldset { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
.workplace-settings .name-field, .workplace-settings .profile-actions { grid-column: 1 / -1; }
.workplace-settings .setting-form label { align-content: start; font-size: 13px; font-weight: 500; gap: 8px; min-width: 0; }
.workplace-settings .setting-form input { height: 44px; font-size: 14px; font-weight: 400; background: var(--surface-soft); }
.workplace-settings .setting-form input[readonly] { opacity: 1; color: var(--muted); }
.workplace-settings .setting-form small { font-size: 12px; line-height: 1.5; }
.workplace-settings .profile-actions { gap: 10px; margin-top: 2px; padding-top: 18px; border-top: 1px solid var(--line); }
.workplace-settings .primary { min-height: 42px; height: 42px; margin: 0; font-size: 13px; font-weight: 600; }
.workplace-settings .discard { min-height: 42px; padding: 10px 14px; color: var(--ink); font: inherit; font-size: 13px; font-weight: 500; }
.workplace-settings .discard:disabled { cursor: default; }
.workplace-settings .profile-hint { margin: 0; font-size: 12px; font-weight: 400; }
.workplace-settings #password .setting-form { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
.workplace-settings .current-password-field, .workplace-settings .password-toggle, .workplace-settings #password .primary { grid-column: 1 / -1; }
.workplace-settings .current-password-field { max-width: calc(50% - 9px); }
.workplace-settings .password-toggle input { height: 18px; width: 18px; }
.workplace-settings .notice { border: 1px solid var(--line); background: var(--surface); color: var(--ink); }
.workplace-settings .notice.error { border-left: 3px solid #d65a66; }
.workplace-settings .notice.success { border-left: 3px solid #2e9b78; }
.workplace-settings a:focus-visible, .workplace-settings button:focus-visible { outline: 2px solid var(--ocean); outline-offset: 3px; }
@media (min-width: 901px) {
  .workplace-settings .setting-form fieldset { grid-template-columns: 1fr 1.25fr 1fr; }
  .workplace-settings .name-field { grid-column: auto; }
}
@media (max-width: 700px) {
  .workplace-settings { padding: 16px 16px 28px; }
  .workplace-settings .settings-header { padding-bottom: 14px; }
  .workplace-settings .settings-header > :deep(.brand-mark) { position: static; transform: none; }
  .workplace-settings .page-mode { display: none; }
  .workplace-settings .back { padding-left: 0; }
  .workplace-settings .back span { display: none; }
  .workplace-settings .settings-layout { gap: 20px; margin-top: 16px; }
  .workplace-settings .settings-nav { width: 100%; flex-wrap: nowrap; }
  .workplace-settings .settings-nav a { flex: 1; min-width: 0; justify-content: center; gap: 6px; padding: 8px; font-size: 12px; line-height: 1.4; }
  .workplace-settings .settings-content h1 { font-size: 24px; }
  .workplace-settings .setting-card { padding: 18px; }
  .workplace-settings .setting-form fieldset, .workplace-settings #password .setting-form { grid-template-columns: 1fr; gap: 16px; }
  .workplace-settings .current-password-field { max-width: none; }
  .workplace-settings .profile-actions { flex-wrap: nowrap; gap: 8px; }
  .workplace-settings .profile-actions > * { flex: 1; min-width: 0; }
}
</style>
