<template>
  <ion-page>
    <ion-content ref="settingsScroller" :fullscreen="true">
      <main class="settings-page">
        <PassengerHeader v-if="isPassenger" :name="profile.name" />
        <header v-else class="settings-header">
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
            ><ion-icon :icon="arrowBackOutline"
          /></router-link>
          <BrandMark />
          <span class="page-mode"
            ><ion-icon :icon="settingsOutline" /> Account settings</span
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
              ><ion-icon :icon="contrastOutline" />Appearance</a
            >
            <a
              :href="`${settingsPath}/profile`"
              :class="{ active: route.path === `${settingsPath}/profile` }"
              :aria-current="
                route.path === `${settingsPath}/profile` ? 'page' : undefined
              "
              @click="navigateSection($event, `${settingsPath}/profile`)"
              ><ion-icon :icon="personOutline" />Personal information</a
            >
            <a
              :href="`${settingsPath}/password`"
              :class="{ active: route.path === `${settingsPath}/password` }"
              :aria-current="
                route.path === `${settingsPath}/password` ? 'page' : undefined
              "
              @click="navigateSection($event, `${settingsPath}/password`)"
              ><ion-icon :icon="shieldCheckmarkOutline" />Password</a
            >
            <a
              v-if="isPassenger"
              href="/notifications"
              @click="navigateSection($event, '/notifications')"
              ><ion-icon :icon="notificationsOutline" />Notifications</a
            >
          </nav>
          <section class="settings-content">
            <p class="kicker">ACCOUNT PREFERENCES</p>
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
              <p class="kicker">PERSONAL INFORMATION</p>
              <h2>Profile details</h2>
              <p class="card-intro">
                Keep your name and contact number up to date.
              </p>
              <p v-if="profileLoading" role="status">
                Loading your saved details...
              </p>
              <router-link v-if="isPassenger" to="/profile" class="profile-back"
                >Back to my profile</router-link
              >
              <form class="setting-form" @submit.prevent="saveProfile">
                <fieldset
                  :disabled="profileLoading || !profileLoaded || savingProfile"
                >
                  <legend class="sr-only">Personal information</legend>
                  <label
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
                      >Your sign-in email is managed by your account.</small
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

            <article v-if="showPassword" id="password" class="setting-card">
              <p class="kicker">SECURITY</p>
              <h2>Change password</h2>
              <p class="card-intro">
                Enter your current password to confirm this change.
              </p>
              <form class="setting-form" @submit.prevent="changePassword">
                <label
                  >Current password<input
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
              <p class="kicker">APPEARANCE</p>
              <h2>Color theme</h2>
              <p class="card-intro">
                Choose how BarkoLink looks on this device.
              </p>
              <ThemeSwitcher />
              <AppearancePreview />
              <div class="mode-note">
                <ion-icon :icon="informationCircleOutline" /> System mode
                follows your device preference automatically.
              </div>
            </article>
          </section>
        </section>
      </main>
      <PassengerBottomNav v-if="isPassenger" />
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
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
import {
  IonButton,
  IonContent,
  IonIcon,
  IonPage,
  onIonViewDidEnter,
  onIonViewWillEnter,
  useIonRouter,
} from "@ionic/vue";
import {
  arrowBackOutline,
  contrastOutline,
  informationCircleOutline,
  notificationsOutline,
  personOutline,
  settingsOutline,
  shieldCheckmarkOutline,
} from "ionicons/icons";
import BrandMark from "../../components/shared/BrandMark.vue";
import PassengerHeader from "../../components/passenger/PassengerHeader.vue";
import PassengerBottomNav from "../../components/passenger/PassengerBottomNav.vue";
import ThemeSwitcher from "../../components/shared/ThemeSwitcher.vue";
import AppearancePreview from "../../components/shared/AppearancePreview.vue";
import { myProfile, updateMyProfile } from "../../services/database/passenger";
import { auth, database } from "../../services/session";

const route = useRoute();
const ionRouter = useIonRouter();
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
  void scrollToRouteSection();
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
  if (route.path === path) {
    void scrollToRouteSection();
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
    loadError.value = (cause as Error).message;
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
    successMessage.value = "Your profile has been updated.";
  } catch (cause) {
    loadError.value = databaseRequestError(
      cause,
      "Could not update your profile. Your changes are kept so you can retry.",
    );
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
    successMessage.value = "Your password has been changed.";
  } catch (error) {
    const code = (error as { code?: string }).code;
    loadError.value =
      code === "auth/wrong-password" ||
      code === "auth/invalid-credential" ||
      code === "invalid_credentials"
        ? "Your current password is incorrect."
        : databaseRequestError(error, "Could not change your password.");
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
  font-size: 11px;
}
.page-mode ion-icon {
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
  font-size: 11px;
  text-align: left;
  text-decoration: none;
  cursor: pointer;
}
.settings-nav a:hover,
.settings-nav button:hover {
  background: var(--light-blue);
  color: var(--ocean);
}
.settings-nav ion-icon {
  flex: none;
  font-size: 17px;
}
.kicker {
  margin: 0;
  color: var(--ocean);
  font-size: 10px;
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
  font-size: 11px;
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
  font-size: 11px;
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
  font-size: 12px;
}
.setting-form input:focus {
  outline: 2px solid color-mix(in srgb, var(--ocean) 35%, transparent);
}
.setting-form input[readonly] {
  opacity: 0.7;
}
.primary {
  --background: var(--ocean);
  --box-shadow: none;
  --border-radius: 9px;
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
  font-size: 10px;
}
.mode-note ion-icon {
  color: var(--ocean);
  font-size: 15px;
}
.notice {
  margin: 14px 0 0;
  padding: 11px 13px;
  border-radius: 9px;
  font-size: 11px;
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
    font-size: 10px;
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
  display: inline-block;
  margin-top: 12px;
  color: var(--ocean);
  font-size: 12px;
  text-decoration: none;
}
.profile-hint,
.setting-form small {
  font-size: 11px;
  color: var(--muted);
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
