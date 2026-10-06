<template>
  <ion-page
    ><ion-content
      ><main class="profile-page">
        <PassengerHeader />
        <p v-if="error" class="error" role="alert">
          {{ error }} <button :disabled="loading" @click="load">Retry</button>
        </p>
        <section class="identity">
          <span class="avatar" aria-hidden="true">{{ initials }}</span>
          <p class="eyebrow">YOUR BARKOLINK ACCOUNT</p>
          <h1>
            {{
              loading
                ? "Loading your profile…"
                : profile.name || "Passenger profile"
            }}
          </h1>
          <p class="email">{{ profile.email }}</p>
          <span class="role">Passenger</span
          ><router-link class="edit" to="/settings/profile"
            ><ion-icon :icon="createOutline" /> Edit personal
            information</router-link
          >
        </section>
        <section class="contact-summary">
          <ion-icon :icon="callOutline" />
          <div>
            <small>CONTACT NUMBER</small
            ><strong>{{
              profile.phone || "Add a contact number for trip assistance"
            }}</strong>
          </div>
          <router-link to="/settings/profile"
            >{{ profile.phone ? "Update" : "Add" }}
            <ion-icon :icon="chevronForwardOutline"
          /></router-link>
        </section>
        <div class="profile-sections">
          <section v-for="group in groups" :key="group.title">
            <h2>{{ group.title }}</h2>
            <div class="menu-card">
              <a
                v-for="item in group.items"
                :key="item.label"
                :href="item.to"
                @click="openMenu($event, item.to)"
                ><span class="item-icon"
                  ><ion-icon :icon="item.icon" aria-hidden="true"
                /></span>
                <div>
                  <strong>{{ item.label }}</strong
                  ><small>{{ item.description }}</small>
                </div>
                <ion-icon :icon="chevronForwardOutline" aria-hidden="true"
              /></a>
            </div>
          </section>
        </div>
        <button class="logout" :disabled="loggingOut" @click="logout">
          <ion-icon :icon="logOutOutline" />{{
            loggingOut ? "Signing out…" : "Log out"
          }}
        </button>
      </main>
      <PassengerBottomNav /></ion-content
  ></ion-page>
</template>
<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { IonPage, IonContent, IonIcon, onIonViewWillEnter, useIonRouter } from "@ionic/vue";
import {
  callOutline,
  chevronForwardOutline,
  contrastOutline,
  createOutline,
  helpCircleOutline,
  logOutOutline,
  notificationsOutline,
  peopleOutline,
  personOutline,
  shieldCheckmarkOutline,
  ticketOutline,
  documentTextOutline,
} from "ionicons/icons";
import PassengerHeader from "../../components/passenger/PassengerHeader.vue";
import PassengerBottomNav from "../../components/passenger/PassengerBottomNav.vue";
import { auth, database } from "../../services/session";
import { myProfile } from "../../services/database/passenger";
import { signOut } from "../../services/auth";
import { clearSessionViews } from "../../composables/sessionViews";
import { databaseRequestError } from "../../data/databaseErrors";
const router = useRouter(),
  profile = reactive({ name: "", email: "", phone: "" });
const ionRouter = useIonRouter();
function openMenu(event: MouseEvent, path: string) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  ionRouter.navigate(path, "forward", "push");
}
const loading = ref(false),
  loggingOut = ref(false),
  error = ref("");
const initials = computed(
  () =>
    profile.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "P",
);
const groups = [
  {
    title: "Account & travel",
    items: [
      {
        label: "Personal information",
        description: "Edit your name and contact number",
        icon: personOutline,
        to: "/settings/profile",
      },
      {
        label: "Saved passengers",
        description: "Reuse traveler details in your next booking",
        icon: peopleOutline,
        to: "/travelers",
      },
      {
        label: "My bookings",
        description: "Reservations, payment deadlines and tickets",
        icon: ticketOutline,
        to: "/bookings",
      },
    ],
  },
  {
    title: "Settings & security",
    items: [
      {
        label: "Password & security",
        description: "Verify your current password before changing it",
        icon: shieldCheckmarkOutline,
        to: "/settings/password",
      },
      {
        label: "Notifications",
        description: "Booking and sailing updates",
        icon: notificationsOutline,
        to: "/notifications",
      },
      {
        label: "Appearance",
        description: "Light, dark or your device preference",
        icon: contrastOutline,
        to: "/settings/appearance",
      },
    ],
  },
  {
    title: "Help & privacy",
    items: [
      {
        label: "Help & travel guide",
        description: "Payment, check-in, boarding and refund guidance",
        icon: helpCircleOutline,
        to: "/help",
      },
      {
        label: "Privacy notice",
        description: "How your account and passenger details are used",
        icon: documentTextOutline,
        to: "/privacy?from=profile",
      },
    ],
  },
];
let request = 0;
async function load() {
  if (loading.value) return;
  const user = auth?.currentUser,
    token = ++request;
  error.value = "";
  loading.value = true;
  if (!database || !user) {
    error.value = "Your account is unavailable. Please sign in again.";
    loading.value = false;
    return;
  }
  try {
    const result = await myProfile(database, { fetchPolicy: "SERVER_ONLY" });
    if (token !== request || auth?.currentUser?.uid !== user.uid) return;
    if (!result.data.user) throw new Error("Your profile could not be found.");
    Object.assign(profile, {
      name: result.data.user.fullName,
      email: result.data.user.email,
      phone: result.data.user.phone || "",
    });
  } catch (cause) {
    if (token === request)
      error.value = databaseRequestError(cause, "Could not load your profile.");
  } finally {
    if (token === request) loading.value = false;
  }
}
async function logout() {
  if (!auth || loggingOut.value) return;
  loggingOut.value = true;
  error.value = "";
  try {
    await signOut(auth);
    request++;
    Object.assign(profile, { name: "", email: "", phone: "" });
    clearSessionViews();
    await router.replace("/login");
  } catch (cause) {
    error.value = databaseRequestError(cause, "Could not sign out. Try again.");
  } finally {
    loggingOut.value = false;
  }
}
onMounted(load);
onIonViewWillEnter(load);
</script>
<style scoped>
.profile-page {
  max-width: 950px;
  margin: auto;
  padding: 28px 24px 112px;
  color: var(--ink);
}
.identity {
  display: flex;
  align-items: center;
  flex-direction: column;
  margin: 30px 0 16px;
  padding: 30px 20px;
  border: 1px solid var(--line);
  border-radius: 20px;
  background: var(--surface);
  text-align: center;
}
.avatar {
  display: grid;
  place-items: center;
  width: 76px;
  height: 76px;
  border-radius: 50%;
  background: linear-gradient(140deg, var(--ocean), #087ea4);
  color: white;
  font-size: 25px;
  font-weight: 800;
}
.eyebrow {
  font-size: 9px;
  letter-spacing: 0.12em;
  font-weight: 800;
  color: var(--ocean);
  margin: 18px 0 6px;
}
.identity h1 {
  font-size: 25px;
  overflow-wrap: anywhere;
  margin: 4px 0;
}
.email {
  color: var(--muted);
  font-size: 13px;
  overflow-wrap: anywhere;
}
.role {
  padding: 5px 12px;
  border-radius: 99px;
  background: var(--light-blue);
  color: var(--ocean);
  font-size: 11px;
  font-weight: 700;
}
.edit {
  display: flex;
  gap: 7px;
  align-items: center;
  margin-top: 20px;
  padding: 10px 15px;
  border: 1px solid var(--line);
  border-radius: 10px;
  color: var(--ocean);
  font-size: 12px;
  text-decoration: none;
  font-weight: 700;
}
.contact-summary {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 18px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--surface);
}
.contact-summary > ion-icon {
  font-size: 23px;
  color: var(--ocean);
}
.contact-summary div {
  flex: 1;
  min-width: 0;
}
.contact-summary small {
  display: block;
  font-size: 9px;
  color: var(--muted);
  margin-bottom: 5px;
}
.contact-summary strong {
  font-size: 12px;
  overflow-wrap: anywhere;
}
.contact-summary a {
  font-size: 11px;
  color: var(--ocean);
  text-decoration: none;
}
.profile-sections {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 22px;
  margin-top: 26px;
}
.profile-sections h2 {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
}
.menu-card {
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--surface);
  overflow: hidden;
}
.menu-card a {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 17px;
  color: var(--ink);
  text-decoration: none;
  border-bottom: 1px solid var(--line);
}
.menu-card a:last-child {
  border-bottom: 0;
}
.menu-card a:hover {
  background: var(--surface-soft);
}
.item-icon {
  display: grid;
  place-items: center;
  width: 35px;
  height: 35px;
  border-radius: 10px;
  background: var(--light-blue);
  color: var(--ocean);
  flex: none;
}
.item-icon ion-icon {
  font-size: 19px;
}
.menu-card a > ion-icon {
  color: var(--muted);
  flex: none;
}
.menu-card a div {
  flex: 1;
  min-width: 0;
}
.menu-card strong {
  display: block;
  font-size: 12px;
}
.menu-card small {
  display: block;
  font-size: 10px;
  line-height: 1.5;
  color: var(--muted);
  margin-top: 5px;
}
.logout {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  width: 100%;
  margin-top: 28px;
  padding: 14px;
  border: 1px solid #ce6a62;
  border-radius: 12px;
  background: var(--surface);
  color: var(--danger);
  font-weight: 700;
  cursor: pointer;
}
.error {
  padding: 14px;
  background: var(--surface);
  color: var(--danger);
  border: 1px solid var(--line);
  border-radius: 10px;
  font-size: 12px;
}
.error button {
  border: 0;
  background: transparent;
  color: var(--ocean);
  font-weight: 700;
  cursor: pointer;
}
@container passenger (max-width: 600px) {
  .profile-page {
    padding: 20px 16px 112px;
  }
  .profile-sections {
    grid-template-columns: 1fr;
    gap: 14px;
  }
  .identity {
    padding: 24px 16px;
  }
  .identity h1 {
    font-size: 22px;
  }
}
</style>
