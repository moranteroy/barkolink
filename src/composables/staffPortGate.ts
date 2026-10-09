import { computed, watch } from 'vue';
import { auth } from '../services/session';
import { staffPortAccess } from '../services/staffPortAccess';

export function useStaffPortGate(onReady: () => Promise<void>) {
  const portBlocked = computed(() => staffPortAccess.uid === auth?.currentUser?.uid && staffPortAccess.status === 'blocked');
  watch(() => staffPortAccess.status, (status, previous) => {
    if (status === 'ready' && previous === 'blocked' && staffPortAccess.uid === auth?.currentUser?.uid) void onReady();
  });
  return { portBlocked };
}
