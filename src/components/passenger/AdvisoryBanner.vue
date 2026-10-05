<template>
  <section
    v-if="items.length || error"
    class="advisories"
    aria-label="Travel advisories"
  >
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
import {
  activeAdvisories,
  type Advisory,
} from "../../services/database/experience";
import { database } from "../../services/session";
import { databaseRequestError } from "../../data/databaseErrors";
const props = defineProps<{ sailingCode?: string }>();
const items = ref<Advisory[]>([]),
  error = ref("");
let request = 0;
async function load() {
  if (!database) return;
  const token = ++request;
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
  }
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
