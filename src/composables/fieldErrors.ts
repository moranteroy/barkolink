import { nextTick, reactive } from 'vue';

export function useFieldErrors() {
  const errors = reactive<Record<string, string>>({});
  const errorId = (key: string) => `field-error-${key.replace(/[^a-zA-Z0-9-]/g, '-')}`;
  function fieldAttrs(key: string, hint?: string) {
    return { 'aria-invalid': !!errors[key], 'aria-describedby': [hint, errors[key] ? errorId(key) : ''].filter(Boolean).join(' ') || undefined };
  }
  function clearErrors() { Object.keys(errors).forEach(key => delete errors[key]); }
  async function showErrors(next: Record<string, string>) {
    clearErrors(); Object.assign(errors, next);
    await nextTick();
    const first = Array.from(document.querySelectorAll<HTMLElement>('[aria-invalid="true"]')).find(el => el.getClientRects().length && !el.hasAttribute('disabled'));
    first?.focus(); first?.scrollIntoView({ block: 'nearest', behavior: 'auto' });
  }
  return { fieldErrors: errors, fieldAttrs, errorId, clearErrors, showErrors };
}
