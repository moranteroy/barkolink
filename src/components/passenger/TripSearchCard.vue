<template>
  <section class="search-card glass-panel">
    <div class="card-heading">
      <div>
        <span class="eyebrow">Plan your journey</span>
        <h2>Find your next ferry</h2>
      </div>
      <span class="route-badge">ONE WAY</span>
    </div>
    <div class="route-fields">
      <label
        >From<select v-model="from" :disabled="loading || !!portError">
          <option v-for="city in cities" :key="city" :value="city">
            {{ city }}
          </option>
        </select></label
      ><button
        class="swap-button"
        type="button"
        aria-label="Swap ports"
        @click="swap"
      >
        ⇅</button
      ><label
        >To<select v-model="to" :disabled="loading || !!portError">
          <option v-for="city in cities" :key="city" :value="city">
            {{ city }}
          </option>
        </select></label
      >
    </div>
    <p v-if="routeError || portError" class="form-error" role="alert">
      {{ routeError || portError }}
    </p>
    <div class="detail-fields">
      <label
        >Departure date<input v-model="date" type="date" :min="today" /></label
      ><label
        >Passengers
        <div class="counter">
          <button
            type="button"
            aria-label="Remove passenger"
            :disabled="count <= 1"
            @click="count--"
          >
            −</button
          ><strong>{{ count }}</strong
          ><button
            type="button"
            aria-label="Add passenger"
            :disabled="count >= 8"
            @click="count++"
          >
            +
          </button>
        </div></label
      ><Button
        class="search-button"
        :disabled="loading || !!portError || cities.length < 2"
        @click="search"
        >Search sailings →</Button
      >
    </div>
  </section>
</template>
<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { Button } from "@/components/ui/button";
import { browseActivePorts } from "../../services/database/passenger";
import { database } from "../../services/session";
import { philippineDateKey } from "../../data/travelDate";
const emit = defineEmits<{ searched: [] }>();
const router = useRouter();
const localDate = (date: Date) => {
  return philippineDateKey(date);
};
const today = localDate(new Date());
const defaultDate = new Date();
defaultDate.setDate(defaultDate.getDate() + 1);
function readRoute() {
  try {
    return JSON.parse(
      localStorage.getItem("barkolink-search-route") || "{}",
    ) as { from?: string; to?: string };
  } catch {
    return {};
  }
}
const prior = readRoute();
const from = ref(prior.from || ""),
  to = ref(prior.to || "");
const savedDate = localStorage.getItem("barkolink-search-iso-date");
const date = ref(
  savedDate && savedDate >= today ? savedDate : localDate(defaultDate),
);
const count = ref(
  Math.max(
    1,
    Math.min(
      8,
      Number(localStorage.getItem("barkolink-search-passengers")) || 1,
    ),
  ),
);
const ports = ref<{ city: string }[]>([]),
  loading = ref(true),
  portError = ref(""),
  routeError = ref("");
const cities = computed(() => [
  ...new Set(ports.value.map((port) => port.city)),
]);
onMounted(async () => {
  try {
    if (!database) throw new Error("Supabase is unavailable.");
    const result = await browseActivePorts(database);
    ports.value = result.data.ports;
    if (!cities.value.includes(from.value)) from.value = cities.value[0] || "";
    if (!cities.value.includes(to.value) || to.value === from.value)
      to.value = cities.value.find((city) => city !== from.value) || "";
    if (cities.value.length < 2)
      portError.value = "At least two active port cities are needed to search.";
  } catch (error) {
    portError.value = (error as Error).message || "Could not load ports.";
  } finally {
    loading.value = false;
  }
});
function swap() {
  const old = from.value;
  from.value = to.value;
  to.value = old;
  routeError.value = "";
}
function search() {
  if (!from.value || !to.value || from.value === to.value) {
    routeError.value = "Choose two different ports.";
    return;
  }
  if (!date.value || date.value < today) {
    routeError.value = "Choose today or a future date.";
    return;
  }
  routeError.value = "";
  localStorage.setItem("barkolink-search-iso-date", date.value);
  localStorage.setItem(
    "barkolink-search-date",
    new Date(`${date.value}T00:00:00`).toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
    }),
  );
  localStorage.setItem("barkolink-search-passengers", String(count.value));
  localStorage.setItem(
    "barkolink-search-route",
    JSON.stringify({ from: from.value, to: to.value }),
  );
  emit("searched");
  void router.push("/search");
}
</script>
<style scoped>
.form-error {
  margin: 10px 0 0;
  color: var(--danger);
  font-size: 11px;
  font-weight: 700;
}
.search-card {
  padding: 25px;
  border: 1px solid #e5eaf0;
  border-radius: 21px;
  background: var(--surface);
  box-shadow: 0 18px 45px #102b4c12;
}
.card-heading {
  display: flex;
  align-items: start;
  justify-content: space-between;
  margin-bottom: 20px;
}
.eyebrow {
  color: var(--ocean);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
h2 {
  margin: 5px 0;
  font-size: 23px;
  letter-spacing: -0.5px;
}
.route-badge {
  color: var(--muted);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.1em;
}
.route-fields,
.detail-fields {
  display: grid;
  grid-template-columns: 1fr 34px 1fr;
  align-items: end;
  gap: 12px;
}
.detail-fields {
  grid-template-columns: 1fr 1fr auto;
  margin-top: 15px;
}
label {
  display: grid;
  gap: 7px;
  min-width: 0;
  color: var(--muted);
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
select,
input {
  width: 100%;
  height: 46px;
  padding: 0 11px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface-soft);
  color: var(--ink);
  font: inherit;
  font-size: 12px;
  letter-spacing: normal;
  text-transform: none;
}
.swap-button {
  width: 30px;
  height: 30px;
  margin-bottom: 8px;
  border: 0;
  border-radius: 50%;
  background: var(--light-blue);
  color: var(--ocean);
  font-size: 19px;
  cursor: pointer;
}
.counter {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 46px;
  padding: 0 8px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface-soft);
  color: var(--ink);
}
.counter button {
  width: 27px;
  height: 27px;
  border: 0;
  border-radius: 7px;
  background: var(--surface);
  color: var(--ocean);
  font-size: 18px;
  cursor: pointer;
}
.counter button:disabled {
  opacity: 0.4;
}
.counter strong {
  color: var(--ink);
  font-size: 13px;
}
.search-button {
  --background: var(--ocean);
  --box-shadow: none;
  --border-radius: 10px;
  height: 46px;
  margin: 0;
  text-transform: none;
  font-weight: 800;
  white-space: nowrap;
}
@container passenger (max-width:620px) {
  .search-card {
    padding: 19px 15px;
  }
  .route-fields,
  .detail-fields {
    grid-template-columns: 1fr;
    gap: 10px;
  }
  .swap-button {
    display: none;
  }
  .detail-fields {
    margin-top: 10px;
  }
  .search-button {
    width: 100%;
  }
}
</style>
