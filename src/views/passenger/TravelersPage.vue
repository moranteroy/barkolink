<template>
  <ion-page
    ><ion-content ref="contentRef"
      ><main class="travelers-page">
        <PassengerHeader />
        <div class="heading">
          <p>SAVE TIME ON YOUR NEXT TRIP</p>
          <h1>Saved travelers</h1>
          <span
            >Save passenger details for your account. Fare categories are
            selected and verified for each booking.</span
          >
        </div>
        <p v-if="error" class="error" role="alert">{{ error }}</p>
        <p v-if="notice" role="status">{{ notice }}</p>
        <form novalidate @submit.prevent="save">
          <h2>{{ form.id ? "Edit traveler" : "Add a traveler" }}</h2>
          <label
            >Full name<input
              v-model.trim="form.fullName"
              v-bind="fieldAttrs('traveler-name')"
              required
              maxlength="120"
          /><small v-if="fieldErrors['traveler-name']" :id="errorId('traveler-name')" class="field-error">{{ fieldErrors['traveler-name'] }}</small></label>
          <div class="fields">
            <label
              >Birth date<input
                v-model="form.birthDate"
                v-bind="fieldAttrs('traveler-birth')"
                type="date"
                :max="today"
                min="1900-01-01"
                required /><small v-if="fieldErrors['traveler-birth']" :id="errorId('traveler-birth')" class="field-error">{{ fieldErrors['traveler-birth'] }}</small></label
            ><label
              >Sex<select v-model="form.sex" v-bind="fieldAttrs('traveler-sex')" required>
                <option value="" disabled>Select sex</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select><small v-if="fieldErrors['traveler-sex']" :id="errorId('traveler-sex')" class="field-error">{{ fieldErrors['traveler-sex'] }}</small></label
            >
          </div>
          <div class="fields">
            <label
              >Mobile number<input
                v-model.trim="form.phone"
                v-bind="fieldAttrs('traveler-phone')"
                type="tel"
                minlength="7"
                maxlength="30"
                required /><small v-if="fieldErrors['traveler-phone']" :id="errorId('traveler-phone')" class="field-error">{{ fieldErrors['traveler-phone'] }}</small></label
            ><label
              >Nationality<input
                v-model.trim="form.nationality"
                v-bind="fieldAttrs('traveler-nationality')"
                maxlength="60"
                required
            /><small v-if="fieldErrors['traveler-nationality']" :id="errorId('traveler-nationality')" class="field-error">{{ fieldErrors['traveler-nationality'] }}</small></label>
          </div>
          <div class="actions">
            <button :disabled="busy">
              {{ busy ? "Saving…" : "Save traveler" }}</button
            ><button
              v-if="form.id"
              type="button"
              :disabled="busy"
              @click="reset"
            >
              Cancel edit
            </button>
          </div>
          <small
            >Only save details you have permission to use. You can delete them
            at any time.</small
          >
        </form>
        <section class="traveler-list" aria-label="Your travelers">
          <p v-if="loading" role="status">Loading travelers…</p>
          <p v-else-if="loadError" class="error" role="alert">{{ loadError }} <button type="button" @click="load">Retry</button></p>
          <p v-else-if="!items.length">No saved travelers yet.</p>
          <article v-for="person in items" :key="person.id">
            <AppIcon :icon="personOutline" aria-hidden="true" />
            <div>
              <strong>{{ person.fullName }}</strong
              ><small>{{ person.nationality }} · {{ person.phone }}</small>
            </div>
            <button :disabled="busy" @click="edit(person)">Edit</button
            ><button :disabled="busy" @click="remove(person)">Delete</button>
          </article>
        </section>
      </main>
      <PassengerBottomNav /></ion-content
  ></ion-page>
</template>
<script setup lang="ts">
import { validName, validPhone, validNationality } from '../../data/securityValidation';
import { validBirthDate } from '../../data/travelDate';
import { notifyError, notifySuccess } from '@/composables/toast';
import { confirmAction } from "../../composables/confirmation";
import { useFieldErrors } from '../../composables/fieldErrors';
import { onMounted, reactive, ref } from "vue";
import { IonPage, IonContent, onIonViewWillEnter } from "@ionic/vue";
import AppIcon from "@/components/ui/icon/AppIcon.vue";
import { personOutline } from "ionicons/icons";
import PassengerHeader from "../../components/passenger/PassengerHeader.vue";
import PassengerBottomNav from "../../components/passenger/PassengerBottomNav.vue";
import {
  deleteTraveler,
  savedTravelers,
  saveTraveler,
  type SavedTraveler,
} from "../../services/database/experience";
import { database } from "../../services/session";
import { databaseRequestError } from "../../data/databaseErrors";
import { manilaDay } from "../../data/reportAnalytics";
const today = manilaDay(),
  items = ref<SavedTraveler[]>([]),
  loading = ref(false),
  busy = ref(false),
  error = ref(""),
  notice = ref("");
const empty = () => ({
  id: "",
  fullName: "",
  birthDate: "",
  sex: "",
  phone: "",
  nationality: "Filipino",
});
const form = reactive(empty());
const loadError = ref('');
const { fieldErrors, fieldAttrs, errorId, clearErrors, showErrors } = useFieldErrors();
const contentRef = ref<InstanceType<typeof IonContent> | null>(null);
function reset() {
  clearErrors();
  Object.assign(form, empty());
}
function edit(person: SavedTraveler) {
  clearErrors();
  Object.assign(form, person);
  notice.value = "";
  void contentRef.value?.$el.scrollToTop(250).then(() => {
    contentRef.value?.$el.querySelector('form input')?.focus({ preventScroll: true });
  });
}
async function load() {
  if (!database || loading.value) return;
  loading.value = true;
  loadError.value = '';
  try {
    items.value = (await savedTravelers(database)).data.travelers;
  } catch (cause) {
    loadError.value = notifyError(databaseRequestError(
      cause,
      "Could not load saved travelers.",
    ));
  } finally {
    loading.value = false;
  }
}
async function save() {
  if (!database || busy.value) return;
  error.value = '';
  clearErrors();
  const errors: Record<string, string> = {};
  if (!validName(form.fullName)) errors['traveler-name'] = 'Enter the traveler’s full name.';
  if (!validBirthDate(form.birthDate)) errors['traveler-birth'] = 'Enter a valid birth date that is not in the future.';
  if (!['MALE', 'FEMALE', 'OTHER'].includes(form.sex)) errors['traveler-sex'] = 'Select the traveler’s sex.';
  if (!validPhone(form.phone)) errors['traveler-phone'] = 'Enter a valid mobile number.';
  if (!validNationality(form.nationality)) errors['traveler-nationality'] = 'Enter the traveler’s nationality.';
  if (Object.keys(errors).length) {
    await showErrors(errors);
    return;
  }
  busy.value = true;
  error.value = "";
  notice.value = "";
  try {
    await saveTraveler(database, { ...form, id: form.id || undefined });
    reset();
    await load();
    notice.value = notifySuccess("Traveler saved.");
  } catch (cause) {
    error.value = notifyError(databaseRequestError(cause, "Could not save traveler."));
  } finally {
    busy.value = false;
  }
}
async function remove(person: SavedTraveler) {
  if (!database || busy.value) return;
  if (
    !(await confirmAction({
      title: "Delete saved traveler?",
      message: `Remove ${person.fullName} from your saved list? Existing bookings keep their passenger details.`,
      confirmText: "Delete traveler",
      danger: true,
    }))
  )
    return;
  busy.value = true;
  error.value = "";
  try {
    await deleteTraveler(database, person.id);
    if (form.id === person.id) reset();
    await load();
    notice.value = notifySuccess("Traveler deleted.");
  } catch (cause) {
    error.value = notifyError(databaseRequestError(cause, "Could not delete traveler."));
  } finally {
    busy.value = false;
  }
}
onMounted(load);
onIonViewWillEnter(load);
</script>
<style scoped>
.travelers-page {
  max-width: 850px;
  margin: auto;
  padding: 28px 24px 110px;
  color: var(--ink);
}
.heading {
  margin: 32px 0 24px;
}
.heading p {
  font-size: var(--text-caption);
  letter-spacing: 0.12em;
  color: var(--ocean);
  font-weight: 800;
}
.heading h1 {
  margin: 8px 0;
  font-size: 30px;
}
.heading span {
  font-size: 13px;
  color: var(--muted);
}
form {
  display: grid;
  gap: 14px;
  padding: 24px;
  border: 1px solid var(--line);
  border-radius: 16px;
  background: var(--surface);
}
h2 {
  margin: 0;
  font-size: 18px;
}
label {
  display: grid;
  gap: 6px;
  font-size: var(--text-label);
  font-weight: 700;
}
input,
select {
  width: 100%;
  height: 43px;
  padding: 8px;
  border: 1px solid var(--line);
  border-radius: 9px;
  background: var(--surface-soft);
  color: var(--ink);
  font: inherit;
}
.fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
.actions {
  display: flex;
  gap: 10px;
}
button {
  padding: 10px 14px;
  border: 1px solid var(--line);
  border-radius: 9px;
  background: var(--light-blue);
  color: var(--ocean);
  cursor: pointer;
  font-weight: 700;
}
button:disabled {
  opacity: 0.5;
}
.traveler-list {
  display: grid;
  gap: 12px;
  margin-top: 24px;
}
.traveler-list article {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 18px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 13px;
}
.traveler-list .app-icon {
  font-size: 24px;
  color: var(--ocean);
}
.traveler-list article div {
  flex: 1;
  min-width: 0;
}
.traveler-list small {
  display: block;
  margin-top: 6px;
}
small {
  color: var(--muted);
  font-size: var(--text-caption);
  line-height: 1.5;
}
.error {
  color: var(--danger);
}
.field-error { color: var(--danger); font-weight: 400; }
input[aria-invalid="true"], select[aria-invalid="true"] { border-color: var(--danger); }
@container passenger (max-width: 600px) {
  .travelers-page {
    padding: 20px 16px 110px;
  }
  .fields {
    grid-template-columns: 1fr;
  }
  .traveler-list article {
    flex-wrap: wrap;
  }
  .traveler-list article div {
    flex-basis: 65%;
  }
}
</style>
