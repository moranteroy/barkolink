import { computed, ref, type Ref } from "vue";
import { activeFirst } from '../data/statusOrder';
export function useTableRecords<T extends object>(rows: Ref<T[]>) {
  const query = ref(''), sort = ref('');
  const records = computed(() => {
    const result = rows.value.filter(row => !query.value || JSON.stringify(row).toLowerCase().includes(query.value.toLowerCase()));
    const ordered = () => activeFirst(result, row => (row as { isActive?: boolean }).isActive === false);
    if (!sort.value) return ordered();
    const [key, direction] = sort.value.split(':');
    const value = (row: T) => key.split('.').reduce((current: any, part) => current?.[part], row);
    const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
    result.sort((a, b) => {
      const left = value(a), right = value(b);
      const order = typeof left === 'number' && typeof right === 'number' ? left - right : collator.compare(String(left ?? ''), String(right ?? ''));
      return direction === 'desc' ? -order : order;
    });
    return ordered();
  });
  return { query, sort, records };
}
