import { computed, ref, type Ref } from "vue";
export function useTableRecords<T extends object>(rows: Ref<T[]>) {
  const query = ref(''), sort = ref('');
  const records = computed(() => {
    const result = rows.value.filter(row => !query.value || JSON.stringify(row).toLowerCase().includes(query.value.toLowerCase()));
    if (!sort.value) return result;
    const [key, direction] = sort.value.split(':');
    const value = (row: T) => key.split('.').reduce((current: any, part) => current?.[part], row);
    const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
    return result.sort((a, b) => {
      const left = value(a), right = value(b);
      const order = typeof left === 'number' && typeof right === 'number' ? left - right : collator.compare(String(left ?? ''), String(right ?? ''));
      return direction === 'desc' ? -order : order;
    });
  });
  return { query, sort, records };
}
