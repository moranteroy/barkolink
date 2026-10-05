<template>
  <ion-page>
    <ion-content :fullscreen="true">
      <main class="staff-settings-page">
        <header class="topbar glass-toolbar">
          <router-link
            :to="workspacePath"
            class="back"
            aria-label="Back to staff workspace"
            ><ion-icon :icon="arrowBackOutline"
          /></router-link>
          <BrandMark />
          <span class="role-label">{{ roleLabel }}</span>
        </header>

        <section class="page-heading">
          <div>
            <p class="eyebrow">STAFF WORKSPACE / SETTINGS</p>
            <h1>Account settings</h1>
            <p>Keep your contact details and sign-in preferences up to date.</p>
          </div>
          <span class="heading-icon"><ion-icon :icon="settingsOutline" /></span>
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
              ><ion-icon :icon="item.icon" /><span>{{ item.label }}</span
              ><ion-icon class="nav-chevron" :icon="chevronForwardOutline"
            /></a>
            <router-link :to="workspacePath" class="workspace-link"
              ><ion-icon :icon="gridOutline" /><span
                >Back to workspace</span
              ></router-link
            >
          </nav>

          <section class="settings-card">
            <template v-if="section === 'account'">
              <div class="card-heading">
                <div>
                  <p class="eyebrow">YOUR ACCOUNT</p>
                  <h2>Profile details</h2>
                  <p>Information linked to your staff account.</p>
                </div>
                <ion-icon :icon="personOutline" />
              </div>
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
                  <span>Full name</span><strong>{{ displayName }}</strong>
                </div>
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
                  /><button
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
                  type="button"
                  :disabled="savingPhone || !phoneDirty"
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
              <div class="card-heading">
                <div>
                  <p class="eyebrow">SECURITY</p>
                  <h2>Change password</h2>
                  <p>
                    Confirm your current password before choosing a new one.
                  </p>
                </div>
                <ion-icon :icon="shieldCheckmarkOutline" />
              </div>
              <form class="password-form" @submit.prevent="changePassword">
                <label
                  >Current password<input
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
                <button type="submit" :disabled="savingPassword">
                  {{ savingPassword ? "Updating…" : "Update password" }}
                </button>
              </form>
            </template>

            <template v-else>
              <div class="card-heading">
                <div>
                  <p class="eyebrow">APPEARANCE</p>
                  <h2>Color theme</h2>
                  <p>Choose how BarkoLink looks on this device.</p>
                </div>
                <ion-icon :icon="contrastOutline" />
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
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { validatedProfile } from "../../data/profileValidation";
import { databaseRequestError } from "../../data/databaseErrors";
import { computed, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import { useRoute } from "vue-router";
import {
  PasswordAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from "../../services/auth";
import {
  IonContent,
  IonIcon,
  IonPage,
  onIonViewWillEnter,
  useIonRouter,
} from "@ionic/vue";
import {
  arrowBackOutline,
  chevronForwardOutline,
  contrastOutline,
  gridOutline,
  personOutline,
  settingsOutline,
  shieldCheckmarkOutline,
} from "ionicons/icons";
import BrandMark from "../../components/shared/BrandMark.vue";
import ThemeSwitcher from "../../components/shared/ThemeSwitcher.vue";
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
const ionRouter = useIonRouter();
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
const savingPassword = ref(false);
const passwordMessage = ref("");
const passwordMessageType = ref<"error" | "success">("error");

onMounted(() => {
  if (section.value === "account") void loadProfile();
});
onIonViewWillEnter(() => {
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
    profileError.value = databaseRequestError(
      error,
      "Could not load staff profile.",
    );
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
    phoneMessage.value = "Contact number saved.";
  } catch (error) {
    phoneMessageType.value = "error";
    phoneMessage.value = databaseRequestError(
      error,
      "Could not save contact number.",
    );
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
    passwordMessage.value = "Password updated.";
  } catch (error) {
    passwordMessageType.value = "error";
    const code = (error as { code?: string }).code;
    passwordMessage.value =
      code === "auth/invalid-credential" ||
      code === "auth/wrong-password" ||
      code === "invalid_credentials"
        ? "Current password is incorrect."
        : databaseRequestError(error, "Could not update password.");
  } finally {
    savingPassword.value = false;
  }
}
</script>

<style scoped>
.staff-settings-page {
  max-width: 1120px;
  margin: 0 auto;
  padding: 28px 32px 80px;
  color: var(--ink);
}
.topbar {
  display: flex;
  align-items: center;
  gap: 15px;
}
.back {
  display: grid;
  place-items: center;
  flex: none;
  width: 42px;
  height: 42px;
  border: 1px solid var(--line);
  border-radius: 11px;
  background: var(--surface);
  color: var(--ink);
  font-size: 20px;
}
.role-label {
  margin-left: auto;
  padding: 8px 11px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--surface);
  color: var(--ocean);
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.page-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
  margin: 40px 0 24px;
}
.eyebrow {
  margin: 0;
  color: var(--ocean);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.1em;
}
.page-heading h1 {
  margin: 8px 0 5px;
  font-size: 32px;
  letter-spacing: -0.04em;
}
.page-heading p:last-child,
.card-heading p,
.phone-form p,
.theme-card p {
  margin: 0;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.55;
}
.heading-icon {
  display: grid;
  place-items: center;
  flex: none;
  width: 54px;
  height: 54px;
  border-radius: 16px;
  background: var(--light-blue);
  color: var(--ocean);
  font-size: 25px;
}
.settings-layout {
  display: grid;
  grid-template-columns: 230px minmax(0, 1fr);
  gap: 20px;
  align-items: start;
}
.settings-nav,
.settings-card {
  border: 1px solid var(--line);
  border-radius: 18px;
  background: var(--surface);
  box-shadow: 0 12px 30px #102b4c0b;
}
.settings-nav {
  display: grid;
  gap: 5px;
  padding: 14px;
}
.nav-title {
  margin: 6px 10px 9px;
  color: var(--muted);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.1em;
}
.settings-nav a {
  display: flex;
  align-items: center;
  gap: 11px;
  min-height: 44px;
  padding: 0 11px;
  border-radius: 10px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
  text-decoration: none;
}
.settings-nav a > ion-icon:first-child {
  flex: none;
  font-size: 19px;
}
.settings-nav a.active,
.settings-nav a:hover {
  background: var(--light-blue);
  color: var(--ocean);
}
.settings-nav .nav-chevron {
  margin-left: auto;
  font-size: 13px;
  opacity: 0.6;
}
.settings-nav .workspace-link {
  margin-top: 12px;
  padding-top: 14px;
  border-top: 1px solid var(--line);
  border-radius: 0;
}
.settings-card {
  min-height: 420px;
  padding: 26px;
}
.card-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 22px;
  border-bottom: 1px solid var(--line);
}
.card-heading h2 {
  margin: 7px 0 5px;
  font-size: 23px;
  letter-spacing: -0.025em;
}
.card-heading > ion-icon {
  display: grid;
  place-items: center;
  flex: none;
  width: 38px;
  height: 38px;
  padding: 9px;
  border-radius: 11px;
  background: var(--light-blue);
  color: var(--ocean);
  font-size: 20px;
}
.identity-card {
  display: flex;
  align-items: center;
  gap: 13px;
  margin: 22px 0;
  padding: 16px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--surface-soft);
}
.avatar {
  display: grid;
  place-items: center;
  flex: none;
  width: 46px;
  height: 46px;
  border-radius: 13px;
  background: var(--ocean);
  color: #fff;
  font-size: 15px;
  font-weight: 800;
}
.identity-card strong,
.identity-card span:last-child {
  display: block;
}
.identity-card strong {
  font-size: 15px;
}
.identity-card div span {
  margin-top: 4px;
  color: var(--muted);
  font-size: 11px;
}
.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.detail {
  min-width: 0;
  padding: 15px;
  border: 1px solid var(--line);
  border-radius: 12px;
}
.detail span,
.detail strong {
  display: block;
}
.detail span {
  color: var(--muted);
  font-size: 10px;
}
.detail strong {
  margin-top: 8px;
  font-size: 12px;
  overflow-wrap: anywhere;
}
.phone-form {
  display: grid;
  gap: 10px;
  margin-top: 24px;
  padding-top: 22px;
  border-top: 1px solid var(--line);
}
.phone-form h3 {
  margin: 0 0 4px;
  font-size: 16px;
}
.phone-form label,
.password-form label {
  color: var(--ink);
  font-size: 11px;
  font-weight: 800;
}
.phone-actions {
  display: flex;
  gap: 10px;
}
.phone-actions input,
.password-form input {
  width: 100%;
  min-width: 0;
  height: 44px;
  padding: 0 12px;
  border: 1px solid var(--line);
  border-radius: 9px;
  background: var(--surface-soft);
  color: var(--ink);
  font: inherit;
  font-size: 12px;
}
.phone-actions input:focus,
.password-form input:focus {
  outline: 2px solid var(--ocean);
  outline-offset: 1px;
}
.phone-actions button,
.password-form button {
  flex: none;
  min-height: 44px;
  padding: 0 17px;
  border: 0;
  border-radius: 9px;
  background: var(--ocean);
  color: #fff;
  font: inherit;
  font-size: 11px;
  font-weight: 800;
  cursor: pointer;
}
.phone-actions button:disabled,
.password-form button:disabled {
  opacity: 0.55;
  cursor: default;
}
.feedback {
  margin: 6px 0 0;
  color: var(--muted);
  font-size: 11px;
}
.feedback.error {
  color: #b8463c;
}
.feedback.success {
  color: #16805a;
}
.password-form {
  display: grid;
  gap: 18px;
  max-width: 480px;
  margin-top: 24px;
}
.password-form label {
  display: grid;
  gap: 8px;
}
.password-form button {
  justify-self: start;
}
.theme-card {
  margin-top: 24px;
  padding: 20px;
  border: 1px solid var(--line);
  border-radius: 13px;
  background: var(--surface-soft);
}
.theme-card :deep(.theme-switcher) {
  position: static;
  top: auto;
  right: auto;
  bottom: auto;
  display: inline-flex;
  box-shadow: none;
}
.theme-card :deep(.theme-switcher button span) {
  display: inline;
}
.theme-card p {
  margin-top: 12px;
}
@media (max-width: 760px) {
  .staff-settings-page {
    padding: 20px 16px 60px;
  }
  .role-label,
  .heading-icon {
    display: none;
  }
  .page-heading {
    margin: 32px 0 20px;
  }
  .page-heading h1 {
    font-size: 28px;
  }
  .settings-layout {
    grid-template-columns: 1fr;
  }
  .settings-nav {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 4px;
    padding: 9px;
  }
  .settings-nav .nav-title {
    grid-column: 1/-1;
    margin: 6px 7px;
  }
  .settings-nav a {
    justify-content: center;
    gap: 6px;
    min-height: 40px;
    padding: 0 5px;
    font-size: 10px;
  }
  .settings-nav a > ion-icon:first-child {
    font-size: 16px;
  }
  .settings-nav .nav-chevron {
    display: none;
  }
  .settings-nav .workspace-link {
    grid-column: 1/-1;
    justify-content: flex-start;
    margin: 3px 0 0;
    padding: 10px;
  }
  .settings-card {
    padding: 20px;
  }
  .card-heading h2 {
    font-size: 21px;
  }
}
@media (max-width: 480px) {
  .detail-grid {
    grid-template-columns: 1fr;
  }
  .phone-actions {
    flex-direction: column;
  }
  .phone-actions button {
    width: 100%;
  }
  .topbar :deep(.brand-copy small) {
    display: none;
  }
  .theme-card :deep(.theme-switcher) {
    width: 100%;
  }
  .theme-card :deep(.theme-switcher button) {
    flex: 1;
    justify-content: center;
  }
}
.password-toggle {
  display: flex !important;
  align-items: center;
  gap: 8px;
}
.password-toggle input {
  width: 18px;
  height: 18px;
}
</style>
