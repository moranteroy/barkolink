<template>
  <section
    v-if="items.length || error || showEmpty"
    class="advisories"
    aria-label="Travel advisories"
  >
    <h2 v-if="showHeading" class="advisory-heading"><ion-icon :icon="megaphoneOutline" aria-hidden="true" /> Travel advisories</h2>
    <div v-if="showEmpty && !items.length && !error" class="advisory-empty" role="status"><span><ShieldCheck :size="20" aria-hidden="true" /></span><div><strong>{{ loading ? 'Checking travel advisories…' : 'No active travel advisories.' }}</strong><p v-if="!loading">Check operator updates again before departure.</p></div></div>
    <p v-if="error" role="alert">
      {{ error }} <button @click="load">Retry</button>
    </p>
    <article
      v-for="item in items"
      :key="item.id"
      :class="item.priority.toLowerCase()"
    >
      <ion-icon
        :icon="
          item.category === 'WEATHER' || item.category === 'SAFETY'
            ? warningOutline
            : megaphoneOutline
        "
        aria-hidden="true"
      />
      <div>
        <small>{{ item.category }} · {{ item.priority }} PRIORITY</small>
        <h3>{{ item.title }}</h3>
        <p>{{ item.message }}</p>
      </div>
    </article>
  </section>
</template>
<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { IonIcon, onIonViewWillEnter } from "@ionic/vue";
import { megaphoneOutline, warningOutline } from "ionicons/icons";
import { ShieldCheck } from '@lucide/vue';
import {
  activeAdvisories,
  type Advisory,
} from "../../services/database/experience";
import { database } from "../../services/session";
import { databaseRequestError } from "../../data/databaseErrors";
const props = defineProps<{ sailingCode?: string; showHeading?: boolean; showEmpty?: boolean }>();
const loading = ref(true);
const items = ref<Advisory[]>([]),
  error = ref("");
let request = 0;
async function load() {
  if (!database) { loading.value = false; return; }
  const token = ++request;
  loading.value = true;
  try {
    const result = await activeAdvisories(database, props.sailingCode);
    if (token === request) {
      items.value = result.data.advisories;
      error.value = "";
    }
  } catch (cause) {
    if (token === request) {
      items.value = [];
      error.value = databaseRequestError(
        cause,
        "Travel advisories are unavailable.",
      );
    }
  } finally { if (token === request) loading.value = false; }
}
onMounted(load);
onIonViewWillEnter(load);
watch(() => props.sailingCode, load);
</script>
<style scoped>
.advisories {
  display: grid;
  gap: 10px;
  margin: 20px 0;
}
.advisory-heading { display: flex; align-items: center; gap: 8px; margin: 0 0 4px; color: var(--ink); font-size: 14px; font-weight: 650; }
.advisory-heading ion-icon { font-size: 17px; }
.advisory-empty { display:flex; align-items:center; gap:12px; padding:15px; border:1px solid var(--line); border-radius:13px; background:var(--surface); }
.advisory-empty > span { display:grid; place-items:center; width:34px; height:34px; flex-shrink:0; border-radius:10px; background:color-mix(in srgb,#299e91 12%,var(--surface)); color:#299e91; }
.advisory-empty strong { color:var(--ink); font-size:12px; font-weight:650; }
.advisory-empty p { margin-top:4px; font-size:11px; }
.advisories article {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  border: 1px solid var(--line);
  border-left: 4px solid var(--ocean);
  border-radius: 12px;
  background: var(--surface);
}
.advisories .high {
  border-left-color: #ce634a;
}
.advisories ion-icon {
  font-size: 24px;
  color: var(--ocean);
  flex: none;
}
.advisories small {
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.08em;
  color: var(--muted);
}
.advisories h3 {
  margin: 5px 0;
  font-size: 14px;
}
.advisories p {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--muted);
  white-space: pre-wrap;
}
.advisories button {
  border: 0;
  background: transparent;
  color: var(--ocean);
  cursor: pointer;
}
</style>
