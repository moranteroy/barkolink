<template>
  <label v-if="travelers.length" class="saved-picker"
    >Use a saved traveler
    <select :value="''" @change="select">
      <option value="">Choose traveler</option>
      <option v-for="person in travelers" :key="person.id" :value="person.id">
        {{ person.fullName }}
      </option>
    </select>
  </label>
</template>
<script setup lang="ts">
import { onMounted, ref } from "vue";
import {
  savedTravelers,
  type SavedTraveler,
} from "../../services/database/experience";
import { database } from "../../services/session";
const emit = defineEmits<{ select: [traveler: SavedTraveler] }>();
const travelers = ref<SavedTraveler[]>([]);
onMounted(async () => {
  if (database) {
    try {
      travelers.value = (await savedTravelers(database)).data.travelers;
    } catch {
      /* Manual passenger entry stays available. */
    }
  }
});
function select(event: Event) {
  const traveler = travelers.value.find(
    (p) => p.id === (event.target as HTMLSelectElement).value,
  );
  if (traveler) emit("select", traveler);
  (event.target as HTMLSelectElement).value = "";
}
</script>
<style scoped>
.saved-picker {
  display: grid;
  gap: 6px;
  margin: 12px 0;
  font-size: 12px;
  font-weight: 700;
  color: var(--ocean);
}
select {
  width: 100%;
  min-height: 42px;
  border: 1px solid var(--line);
  border-radius: 9px;
  padding: 8px;
  background: var(--surface);
  color: var(--ink);
}
</style>
