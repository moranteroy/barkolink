import { onBeforeUnmount, onMounted } from "vue";
import { onBeforeRouteLeave, onBeforeRouteUpdate } from "vue-router";
import { confirmAction } from "./confirmation";

export function useUnsavedChanges(isDirty: () => boolean) {
  const confirmLeave = async () => !isDirty() || await confirmAction({
    title: "Leave without saving?", message: "Your changes have not been saved. Stay on this page to finish, or leave and discard them.",
    confirmText: "Discard and leave",
  });
  onBeforeRouteLeave(confirmLeave);
  onBeforeRouteUpdate((to, from) => to.path === from.path || confirmLeave());
  const warn = (event: BeforeUnloadEvent) => {
    if (isDirty()) { event.preventDefault(); event.returnValue = ""; }
  };
  onMounted(() => window.addEventListener("beforeunload", warn));
  onBeforeUnmount(() => window.removeEventListener("beforeunload", warn));
}
