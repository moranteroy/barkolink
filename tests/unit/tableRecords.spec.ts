import { ref } from "vue";
import { describe, expect, it } from "vitest";
import { useTableRecords } from "../../src/composables/tableRecords";
describe("loaded table controls", () => {
  it("sorts numbers and nested text without changing the source order", () => {
    const rows = ref([{ seats: 100, port: { name: 'Port 10' } }, { seats: 20, port: { name: 'Port 2' } }]);
    const table = useTableRecords(rows);
    table.sort.value = 'seats:asc';
    expect(table.records.value.map(row => row.seats)).toEqual([20, 100]);
    expect(rows.value.map(row => row.seats)).toEqual([100, 20]);
    table.sort.value = 'port.name:asc';
    expect(table.records.value[0].port.name).toBe('Port 2');
    table.query.value = 'PORT 10';
    expect(table.records.value).toHaveLength(1);
  });
});
