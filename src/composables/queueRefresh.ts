import { onBeforeUnmount, onMounted } from "vue";

// Polling uses the secured RPC; no direct-table Realtime grants are needed.
export function useQueueRefresh(
  refresh: () => Promise<void>,
  enabled: () => boolean,
  interval = 15000,
) {
  let timer: ReturnType<typeof setInterval> | undefined;
  let pending = false;
  async function tick() {
    if (document.hidden || pending || !enabled()) return;
    pending = true;
    try {
      await refresh();
    } finally {
      pending = false;
    }
  }
  onMounted(() => {
    timer = setInterval(() => {
      void tick();
    }, interval);
  });
  onBeforeUnmount(() => {
    if (timer) clearInterval(timer);
  });
}
