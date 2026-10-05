<template>
  <section class="records-grid" :aria-label="title">
    <div class="grid-tools">
      <div class="grid-summary"><Badge>{{ visibleCount }} of {{ rows.length }} records</Badge><span>Sort and filter the loaded page.</span></div>
      <div v-if="!compact">
        <DropdownMenu>
          <DropdownMenuTrigger as-child><Button variant="outline" :disabled="!api"><Columns3 />Columns</Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel class="ui-menu-label">Visible columns</DropdownMenuLabel>
            <DropdownMenuCheckboxItem v-for="(column, index) in columns" :key="column"
              class="ui-menu-item" :model-value="!hiddenColumns.includes(index)"
              :disabled="hiddenColumns.length === columns.length - 1 && !hiddenColumns.includes(index)"
              @select.prevent @update:model-value="toggleColumn(index, $event)">
              <span class="column-check"><DropdownMenuItemIndicator><Check /></DropdownMenuItemIndicator></span>{{ column }}
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button variant="outline" :disabled="!api" @click="fitColumns"><ScanLine />Fit columns</Button>
        <Button variant="ghost" :disabled="!api" @click="resetView"><RotateCcw />Reset table</Button>
      </div>
    </div>
    <div v-if="compact" class="mobile-records">
      <div v-if="loading" role="status" aria-label="Loading records" class="loading-cards">
        <Card v-for="item in 3" :key="item" class="loading-card"><Skeleton class="h-4 w-2/3" /><Skeleton class="h-4 w-full" /><Skeleton class="h-4 w-1/2" /></Card>
      </div>
      <Card v-for="row in rows" v-else :key="row.key" class="mobile-record">
        <div
          v-for="(column, index) in columns"
          :key="column"
          class="mobile-field"
        >
          <small>{{ column }}</small>
          <div>
            <slot
              name="cell"
              :row="row"
              :index="index"
              :value="row.cells[index]"
              ><Badge v-if="row.statusIndex === index" :variant="statusVariant(row.cells[index])">{{ row.cells[index] }}</Badge><span v-else>{{ row.cells[index] }}</span></slot
            >
          </div>
        </div>
        <div v-if="$slots.actions" class="mobile-field">
          <small>Actions</small>
          <div><slot name="actions" :row="row" /></div>
        </div>
      </Card>
      <p v-if="!loading && !rows.length" class="grid-empty">
        No matching records.
      </p>
    </div>
    <AgGridVue
      v-else
      class="desktop-grid"
      :style="{ height: gridHeight }"
      :theme="gridTheme"
      :modules="modules"
      :column-defs="columnDefs"
      :row-data="rows"
      :default-col-def="defaultColDef"
      :get-row-id="getRowId"
      :loading="loading"
      :row-height="60"
      :header-height="44"
      :enable-cell-text-selection="true"
      :ensure-dom-order="true"
      :animate-rows="false"
      :tooltip-show-delay="400"
      overlay-no-rows-template="No matching records."
      @grid-ready="ready"
      @grid-pre-destroyed="api = null"
      @filter-changed="updateCount"
      @row-data-updated="updateCount"
      @column-visible="syncColumns"
    />
  </section>
</template>
<script setup lang="ts">
import {
  computed,
  defineComponent,
  h,
  markRaw,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  useSlots,
  type PropType,
} from "vue";
import { AgGridVue } from "ag-grid-vue3";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem,
  DropdownMenuItemIndicator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { Columns3, Check, ScanLine, RotateCcw } from "@lucide/vue";
import {
  ClientSideRowModelModule,
  ClientSideRowModelApiModule,
  ColumnApiModule,
  ColumnAutoSizeModule,
  RowAutoHeightModule,
  TextFilterModule,
  TooltipModule,
  ValidationModule,
  themeQuartz,
  type ColDef,
  type GetRowIdParams,
  type GridApi,
  type GridReadyEvent,
  type ICellRendererParams,
} from "ag-grid-community";

export type RecordGridRow = {
  key: string;
  cells: (string | number)[];
  sortValues?: (string | number | undefined)[];
  source: any;
  statusIndex?: number;
};
const props = withDefaults(
  defineProps<{
    title: string;
    columns: string[];
    rows: RecordGridRow[];
    loading?: boolean;
    actionWidth?: number;
    displayOnlyColumns?: number[];
  }>(),
  { loading: false, actionWidth: 300, displayOnlyColumns: () => [] },
);
const emit = defineEmits<{ ready: [api: GridApi<RecordGridRow>] }>();
const slots = useSlots();
const api = shallowRef<GridApi<RecordGridRow> | null>(null);
const displayedCount = ref<number | null>(null);
const hiddenColumns = ref<number[]>([]);
const visibleCount = computed(() => compact.value ? props.rows.length : displayedCount.value ?? props.rows.length);
function updateCount() { displayedCount.value = api.value?.getDisplayedRowCount() ?? null; }
function syncColumns() {
  hiddenColumns.value = props.columns.map((_, index) => index).filter(index => api.value?.getColumn(`cell-${index}`)?.isVisible() === false);
}
function toggleColumn(index: number, visible: boolean | "indeterminate") {
  api.value?.setColumnsVisible([`cell-${index}`], visible === true);
  syncColumns();
}
function statusVariant(value: string | number) {
  const status = String(value).toUpperCase().replace(/[\s-]+/g, "_");
  if (/^(PAID|CONFIRMED|ACTIVE|COMPLETED|BOARDED|CHECKED_IN|ISSUED|SCHEDULED)$/.test(status)) return "success";
  if (/^(PENDING|UNPAID|BOARDING|DELAYED|RESERVED)$/.test(status)) return "warning";
  if (/^(CANCELLED|EXPIRED|NO_SHOW|INACTIVE|REFUNDED)$/.test(status)) return "destructive";
  return "default";
}
const compact = ref(typeof window !== "undefined" && window.innerWidth < 700);
const modules = [
  ClientSideRowModelModule,
  ClientSideRowModelApiModule,
  ColumnApiModule,
  ColumnAutoSizeModule,
  RowAutoHeightModule,
  TextFilterModule,
  TooltipModule,
  ...(import.meta.env.DEV ? [ValidationModule] : []),
];
const gridTheme = themeQuartz.withParams({
  backgroundColor: "var(--surface)",
  foregroundColor: "var(--ink)",
  headerBackgroundColor: "var(--surface-soft)",
  headerTextColor: "var(--muted)",
  borderColor: "var(--line)",
  accentColor: "var(--ocean)",
  rowHoverColor: "var(--light-blue)",
  oddRowBackgroundColor: "var(--surface-soft)",
  fontFamily: "inherit",
  fontSize: 12,
  borderRadius: 12,
  wrapperBorderRadius: 12,
  spacing: 6,
});
const gridHeight = computed(
  () => `${Math.min(560, Math.max(250, props.rows.length * 60 + 48))}px`,
);
const defaultColDef: ColDef<RecordGridRow> = {
  sortable: true,
  filter: "agTextColumnFilter",
  resizable: true,
  minWidth: 150,
  flex: 1,
  wrapText: true,
  autoHeight: true,
  cellDataType: false,
};
const collator = new Intl.Collator("en", {
  numeric: true,
  sensitivity: "base",
});
function renderer(index: number, actions = false) {
  return markRaw(
    defineComponent({
      props: {
        params: {
          type: Object as PropType<ICellRendererParams<RecordGridRow>>,
          required: true,
        },
      },
      setup(cell, { expose }) {
        const params = shallowRef(cell.params);
        expose({
          refresh: (next: ICellRendererParams<RecordGridRow>) => {
            params.value = next;
            return true;
          },
        });
        return () => {
          const row = params.value.data;
          if (!row) return null;
          const content = actions
            ? slots.actions?.({ row })
            : slots.cell?.({ row, index, value: row.cells[index] }) ||
              (row.statusIndex === index
                ? h(Badge, { variant: statusVariant(row.cells[index]) }, () => String(row.cells[index] ?? ""))
                : h("span", String(row.cells[index] ?? "")));
          return h(
            "div",
            { class: actions ? "grid-row-actions" : "grid-cell-content" },
            content,
          );
        };
      },
    }),
  );
}
const columnDefs = computed<ColDef<RecordGridRow>[]>(() => [
  ...props.columns.map(
    (headerName, index): ColDef<RecordGridRow> => ({
      headerName,
      colId: `cell-${index}`,
      sortable: !props.displayOnlyColumns.includes(index),
      filter: props.displayOnlyColumns.includes(index)
        ? false
        : "agTextColumnFilter",
      valueGetter: ({ data }) => data?.cells[index] ?? "",
      tooltip: ({ value }) => String(value ?? ""),
      cellRenderer: renderer(index),
      minWidth: index === 0 ? 170 : 150,
      comparator: (a, b, nodeA, nodeB) => {
        const left = nodeA.data?.sortValues?.[index] ?? a,
          right = nodeB.data?.sortValues?.[index] ?? b;
        return typeof left === "number" && typeof right === "number"
          ? left - right
          : collator.compare(String(left ?? ""), String(right ?? ""));
      },
    }),
  ),
  ...(slots.actions
    ? [
        {
          headerName: "Action",
          colId: "actions",
          cellRenderer: renderer(-1, true),
          sortable: false,
          filter: false,
          width: props.actionWidth,
          minWidth: props.actionWidth,
          flex: 0,
          pinned: "right" as const,
          lockPinned: true,
          suppressMovable: true,
        },
      ]
    : []),
]);
const getRowId = ({ data }: GetRowIdParams<RecordGridRow>) => data.key;
function ready(event: GridReadyEvent<RecordGridRow>) {
  api.value = event.api;
  updateCount();
  syncColumns();
  emit("ready", event.api);
}
function fitColumns() {
  api.value?.sizeColumnsToFit();
}
function resetView() {
  api.value?.setFilterModel(null);
  api.value?.resetColumnState();
  syncColumns();
  updateCount();
  fitColumns();
}
function resize() {
  compact.value = window.innerWidth < 700;
}
onMounted(() => window.addEventListener("resize", resize));
onBeforeUnmount(() => window.removeEventListener("resize", resize));
defineExpose({ getApi: () => api.value, resetView, fitColumns });
</script>
<style scoped>
.records-grid {
  width: 100%;
  min-width: 0;
}
.grid-tools {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 18px;
  color: var(--muted);
  font-size: 11px;
}
.grid-tools > div {
  display: flex;
  gap: 8px;
}
.grid-tools button {
  padding: 7px 10px;
  border: 1px solid var(--line);
  border-radius: 7px;
  background: var(--surface);
  color: var(--ocean);
  font: inherit;
  font-size: 11px;
  cursor: pointer;
}
.grid-tools button:disabled {
  opacity: 0.5;
}
.desktop-grid {
  width: 100%;
  min-width: 0;
}
.records-grid :deep(.grid-cell-content),
.records-grid :deep(.grid-row-actions) {
  padding: 12px 0;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.records-grid :deep(.record-status) {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 6px;
  background: var(--light-blue);
  color: var(--ocean);
  font-size: 10px;
  font-weight: 650;
}
.mobile-records {
  padding: 12px;
  display: grid;
  gap: 12px;
}
.mobile-record {
  padding: 12px 14px;
}
.mobile-field {
  display: flex;
  justify-content: space-between;
  align-items: start;
  gap: 14px;
  padding: 7px 0;
  font-size: 12px;
}
.mobile-field > small {
  color: var(--muted);
  font-size: 10px;
  flex: none;
  max-width: 90px;
}
.mobile-field > div {
  min-width: 0;
  text-align: right;
  overflow-wrap: anywhere;
}
.grid-empty,
.mobile-records > p {
  padding: 24px 0;
  color: var(--muted);
  font-size: 12px;
}
.grid-tools span {
  line-height: 1.5;
}
@media (max-width: 699px) {
  .grid-tools {
    padding: 12px 16px;
  }
  .grid-tools span {
    display: none;
  }
}
.grid-summary { align-items: center; flex-wrap: wrap; }
.grid-summary [data-slot="badge"] { display: inline-flex; }
.grid-tools button { min-height: 40px; color: var(--ink); }
.grid-tools button svg { width: 15px; height: 15px; }
.column-check { width: 16px; height: 16px; }
.loading-cards { display: grid; gap: 12px; }
.loading-card { padding: 18px; display: grid; gap: 15px; }
@media (max-width: 1000px) { .grid-tools { flex-wrap: wrap; } }
</style>
