import { describe, expect, it } from 'vitest';
import { ref } from 'vue';
import { useTableRecords } from '../../src/composables/tableRecords';

describe('active-first directories', () => {
  const rows = () => ref([
    { code: 'A', isActive: false },
    { code: 'B', isActive: true },
    { code: 'C', isActive: false },
    { code: 'D', isActive: true },
  ]);
  it('keeps inactive records last while preserving order within each group', () => {
    expect(useTableRecords(rows()).records.value.map(row => row.code)).toEqual(['B', 'D', 'A', 'C']);
  });
  it('sorts within the active and inactive groups in both directions', () => {
    const table = useTableRecords(rows());
    table.sort.value = 'code:desc';
    expect(table.records.value.map(row => row.code)).toEqual(['D', 'B', 'C', 'A']);
    table.sort.value = 'code:asc';
    expect(table.records.value.map(row => row.code)).toEqual(['B', 'D', 'A', 'C']);
  });
  it('updates grouping when status changes without hiding inactive search results', () => {
    const source = rows(), table = useTableRecords(source);
    source.value[0].isActive = true;
    expect(table.records.value.map(row => row.code)).toEqual(['A', 'B', 'D', 'C']);
    table.query.value = '"code":"C"';
    expect(table.records.value.map(row => row.code)).toEqual(['C']);
  });
});
