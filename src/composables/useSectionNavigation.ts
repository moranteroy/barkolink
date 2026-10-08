import { nextTick, onUnmounted, watch, type Ref } from 'vue';
import { useRoute } from 'vue-router';
import { onIonViewDidEnter, onIonViewDidLeave } from '@ionic/vue';

/** Ionic pages scroll inside ion-content and may stay mounted after navigation. */
export function useSectionNavigation(root: Ref<HTMLElement | undefined>, path: string, hashes: string[]) {
  const route = useRoute();
  let visible = false;
  let observer: ResizeObserver | undefined;
  let request = 0;
  const events = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const;
  function stop() {
    request++;
    observer?.disconnect(); observer = undefined;
    events.forEach(event => root.value?.removeEventListener(event, stop));
  }
  async function reveal() {
    stop(); const id = request;
    const hash = route.hash;
    if (!visible || route.path !== path || !hashes.includes(hash)) return;
    await nextTick();
    if (id !== request || !visible || !root.value) return;
    const scroll = () => {
      const target = root.value?.querySelector<HTMLElement>(hash);
      if (!target) return;
      if (target instanceof HTMLDetailsElement) target.open = true;
      target.scrollIntoView({ block: 'start', behavior: 'instant' });
      target.focus({ preventScroll: true });
    };
    scroll();
    observer = new ResizeObserver(scroll);
    observer.observe(root.value);
    events.forEach(event => root.value?.addEventListener(event, stop, { passive: true }));
  }
  onIonViewDidEnter(() => { visible = true; void reveal(); });
  onIonViewDidLeave(() => { visible = false; stop(); });
  onUnmounted(stop);
  watch(() => route.hash, () => { void reveal(); });
}
