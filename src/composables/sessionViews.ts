import { ref } from "vue";

// Remounting IonRouterOutlet clears Ionic's cached pages after a user signs out.
export const sessionViewsKey = ref(0);

export function clearSessionViews() {
  sessionViewsKey.value += 1;
}
