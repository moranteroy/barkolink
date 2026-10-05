<template>
  <section class="advisory-panel">
    <header>
      <div>
        <p class="eyebrow">PASSENGER COMMUNICATION</p>
        <h2>Travel advisories</h2>
        <p>Publish updates for every passenger or for one sailing.</p>
      </div>
      <button :disabled="busy || loading" @click="load">
        <ion-icon :icon="refreshOutline" /> Refresh
      </button>
    </header>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="notice" role="status">{{ notice }}</p>
    <form @submit.prevent="save">
      <h3>{{ form.id ? "Edit advisory" : "Create advisory" }}</h3>
      <label
        >Title<input
          v-model.trim="form.title"
          required
          minlength="3"
          maxlength="120" /></label
      ><label
        >Message<textarea
          v-model.trim="form.message"
          required
          minlength="3"
          maxlength="2000"
          rows="4"
        />
      </label>
      <div class="fields">
        <label
          >Type<select v-model="form.category">
            <option
              v-for="type in [
                'WEATHER',
                'PORT',
                'SCHEDULE',
                'SAFETY',
                'GENERAL',
              ]"
              :key="type"
            >
              {{ type }}
            </option>
          </select></label
        ><label
          >Priority<select v-model="form.priority">
            <option
              v-for="priority in ['HIGH', 'MEDIUM', 'LOW']"
              :key="priority"
            >
              {{ priority }}
            </option>
          </select></label
        >
      </div>
      <label
        >Audience<select v-model="form.sailingCode">
          <option value="">All passengers</option>
          <option v-for="s in sailings" :key="s.code" :value="s.code">
            {{ s.code }} · {{ s.origin.name }} → {{ s.destination.name }}
          </option>
        </select></label
      ><button
        v-if="sailings.length < sailingTotal"
        type="button"
        :disabled="moreLoading || busy"
        @click="loadMoreSailings"
      >
        {{ moreLoading ? "Loading…" : "Load older sailings" }}
      </button>
      <div class="fields">
        <label
          >Starts (Philippine time)<input
            v-model="form.startsAt"
            type="datetime-local"
            required /></label
        ><label
          >Ends (Philippine time)<input
            v-model="form.endsAt"
            type="datetime-local"
            required
        /></label>
      </div>
      <label class="check"
        ><input v-model="form.published" type="checkbox" /> Publish during this
        period</label
      >
      <div class="actions">
        <button :disabled="busy || loading">
          {{ busy ? "Saving…" : "Save advisory" }}</button
        ><button type="button" :disabled="busy" @click="reset">
          {{ form.id ? "Cancel edit" : "Clear" }}
        </button>
      </div>
    </form>
    <p v-if="loading">Loading advisories…</p>
    <p v-else-if="!items.length">No advisories created yet.</p>
    <div class="advisory-list">
      <article v-for="item in items" :key="item.id">
        <ion-icon
          :icon="item.priority === 'HIGH' ? warningOutline : megaphoneOutline"
        />
        <div>
          <small
            >{{ item.category }} · {{ item.priority }} ·
            {{ status(item) }}</small
          >
          <h3>{{ item.title }}</h3>
          <p>{{ item.message }}</p>
          <small
            >{{ item.sailingCode || "All passengers" }} ·
            {{ date(item.startsAt) }} to {{ date(item.endsAt) }}</small
          >
        </div>
        <button :disabled="busy" @click="edit(item)">Edit</button>
      </article>
    </div>
  </section>
</template>
<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { IonIcon } from "@ionic/vue";
import {
  megaphoneOutline,
  refreshOutline,
  warningOutline,
} from "ionicons/icons";
import {
  adminAdvisories,
  saveAdvisory,
  type Advisory,
} from "../../services/database/experience";
import { adminSailings } from "../../services/database/staff";
import { staffDatabase } from "../../services/session";
import { databaseRequestError } from "../../data/databaseErrors";
const items = ref<Advisory[]>([]),
  sailings = ref<
    Array<{
      code: string;
      origin: { name: string };
      destination: { name: string };
    }>
  >([]);
const sailingPage = ref(0),
  sailingTotal = ref(0),
  moreLoading = ref(false);
async function loadMoreSailings() {
  if (!staffDatabase || moreLoading.value) return;
  moreLoading.value = true;
  try {
    const result = await adminSailings(staffDatabase, {
      page: sailingPage.value + 1,
      pageSize: 100,
    });
    const seen = new Set(sailings.value.map((s) => s.code));
    sailings.value.push(
      ...result.data.sailings.filter((s) => !seen.has(s.code)),
    );
    sailingPage.value++;
    sailingTotal.value = result.data.totalCount || sailings.value.length;
  } catch (cause) {
    error.value = databaseRequestError(cause, "Could not load more sailings.");
  } finally {
    moreLoading.value = false;
  }
}
const error = ref(""),
  notice = ref(""),
  busy = ref(false),
  loading = ref(false);
const local = (value: string) =>
  new Date(Date.parse(value) + 8 * 3600000).toISOString().slice(0, 16);
const empty = () => ({
  id: "",
  title: "",
  message: "",
  category: "GENERAL",
  priority: "MEDIUM",
  sailingCode: "",
  startsAt: local(new Date().toISOString()),
  endsAt: local(new Date(Date.now() + 86400000).toISOString()),
  published: false,
});
const form = reactive(empty());
const date = (value: string) =>
  new Date(value).toLocaleString("en-PH", { timeZone: "Asia/Manila" });
const status = (item: Advisory) =>
  !item.published
    ? "DRAFT"
    : Date.parse(item.endsAt) <= Date.now()
      ? "ENDED"
      : Date.parse(item.startsAt) > Date.now()
        ? "SCHEDULED"
        : "ACTIVE";
function reset() {
  Object.assign(form, empty());
}
function edit(item: Advisory) {
  Object.assign(form, item, {
    sailingCode: item.sailingCode || "",
    startsAt: local(item.startsAt),
    endsAt: local(item.endsAt),
  });
  if (
    item.sailingCode &&
    !sailings.value.some((s) => s.code === item.sailingCode)
  )
    sailings.value.push({
      code: item.sailingCode,
      origin: { name: "Existing" },
      destination: { name: "sailing" },
    });
  notice.value = "";
}
async function load() {
  if (!staffDatabase || loading.value) return;
  loading.value = true;
  error.value = "";
  try {
    const [advisories, trips] = await Promise.all([
      adminAdvisories(staffDatabase),
      adminSailings(staffDatabase, { pageSize: 100 }),
    ]);
    items.value = advisories.data.advisories;
    sailings.value = trips.data.sailings;
    sailingPage.value = 0;
    sailingTotal.value = trips.data.totalCount || sailings.value.length;
  } catch (cause) {
    error.value = databaseRequestError(cause, "Could not load advisories.");
  } finally {
    loading.value = false;
  }
}
async function save() {
  if (!staffDatabase || busy.value) return;
  error.value = "";
  notice.value = "";
  const startsAt = new Date(`${form.startsAt}:00+08:00`).toISOString(),
    endsAt = new Date(`${form.endsAt}:00+08:00`).toISOString();
  if (endsAt <= startsAt) {
    error.value = "End time must be later than start time.";
    return;
  }
  busy.value = true;
  try {
    await saveAdvisory(staffDatabase, {
      ...form,
      id: form.id || undefined,
      sailingCode: form.sailingCode || null,
      startsAt,
      endsAt,
    });
    reset();
    await load();
    notice.value =
      "Advisory saved. Published advisories appear during their effective period.";
  } catch (cause) {
    error.value = databaseRequestError(cause, "Could not save advisory.");
  } finally {
    busy.value = false;
  }
}
onMounted(load);
</script>
<style scoped>
.advisory-panel {
  display: grid;
  gap: 20px;
}
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 15px;
}
h2,
h3 {
  margin: 0;
}
header p {
  margin: 8px 0;
  color: var(--muted);
  font-size: 12px;
}
.eyebrow {
  font-weight: 800;
  letter-spacing: 0.1em;
  color: var(--ocean) !important;
  font-size: 10px !important;
}
form {
  display: grid;
  gap: 14px;
  padding: 24px;
  border: 1px solid var(--line);
  border-radius: 15px;
  background: var(--surface);
}
label {
  display: grid;
  gap: 6px;
  font-size: 12px;
  font-weight: 700;
}
input,
select,
textarea {
  width: 100%;
  padding: 11px;
  border: 1px solid var(--line);
  border-radius: 9px;
  background: var(--surface-soft);
  color: var(--ink);
  font: inherit;
}
textarea {
  resize: vertical;
}
.fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
.check {
  display: flex;
  align-items: center;
}
.check input {
  width: auto;
}
.actions {
  display: flex;
  gap: 10px;
}
button {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 10px 14px;
  border: 1px solid var(--line);
  border-radius: 9px;
  background: var(--light-blue);
  color: var(--ocean);
  font-weight: 700;
  cursor: pointer;
}
button:disabled {
  opacity: 0.5;
}
.advisory-list {
  display: grid;
  gap: 12px;
}
.advisory-list article {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 20px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--surface);
}
.advisory-list article div {
  flex: 1;
  min-width: 0;
}
.advisory-list ion-icon {
  color: var(--ocean);
  font-size: 25px;
  flex: none;
}
.advisory-list h3 {
  margin: 8px 0;
  font-size: 16px;
}
.advisory-list p {
  white-space: pre-wrap;
  line-height: 1.6;
  font-size: 13px;
}
.advisory-list small {
  color: var(--muted);
  font-size: 10px;
}
.error {
  color: #b8463c;
}
@media (max-width: 600px) {
  .fields {
    grid-template-columns: 1fr;
  }
  .advisory-list article {
    flex-wrap: wrap;
  }
  form {
    padding: 18px;
  }
}
</style>
