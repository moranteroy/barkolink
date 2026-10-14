import { readonly, ref } from 'vue';

export type ToastTone = 'success' | 'error' | 'info';
export interface ToastMessage { id: number; message: string; tone: ToastTone; duration: number }
const messages = ref<ToastMessage[]>([]);
let nextId = 0;
export const toastMessages = readonly(messages);

/** Return the message so existing persistent feedback can remain available. */
export function notify(message: string, tone: ToastTone = 'info'): string {
  if (!message.trim() || messages.value.some(item => item.message === message && item.tone === tone)) return message;
  messages.value.push({ id: ++nextId, message, tone, duration: tone === 'error' ? 8000 : 4500 });
  return message;
}
export const notifySuccess = (message: string) => notify(message, 'success');
export const notifyError = (message: string) => notify(message, 'error');
export function dismissToast(id: number) {
  messages.value = messages.value.filter(item => item.id !== id);
}
export function clearToasts() { messages.value = []; }
