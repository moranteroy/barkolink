<template>
  <section class="records-grid" :class="{ 'dense-grid': density === 'compact' }" :aria-label="title">
    <div class="grid-tools">
      <div class="grid-summary" role="status" aria-live="polite">
        <span class="grid-count"><strong>{{ visibleCount.toLocaleString() }}</strong><template v-if="activeFilterCount"> of {{ rows.length.toLocaleString() }}</template> {{ visibleCount === 1 ? 'record' : 'records' }}</span>
        <span class="grid-scope">on this page</span>
        <Button v-if="activeFilterCount" variant="ghost" class="clear-filters" @click="clearFilters"><X :size="14" />Clear filters ({{ activeFilterCount }})</Button>
      </div>
      <div class="grid-actions" aria-label="Table controls">
        <DropdownMenu>
          <DropdownMenuTrigger as-child><Button variant="outline" :disabled="!compact && !api"><Columns3 />Columns</Button></DropdownMenuTrigger>
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
        <Button v-if="!compact" variant="outline" :disabled="!api" @click="fitColumns"><ScanLine />Fit columns</Button>
        <Button variant="ghost" :disabled="!api" @click="resetView"><RotateCcw />Reset table</Button>
      </div>
    </div>
    <div v-if="compact" class="mobile-records">
      <label class="mobile-sort">Sort this page<select :value="mobileSort" :disabled="!api || loading" @change="sortMobile"><option value="">Original order</option><template v-for="(column, index) in columns" :key="column"><option v-if="!displayOnlyColumns.includes(index)" :value="`${index}:asc`">{{ column }}: ascending</option><option v-if="!displayOnlyColumns.includes(index)" :value="`${index}:desc`">{{ column }}: descending</option></template></select></label>
      <div v-if="loading" role="status" aria-label="Loading records" class="loading-cards">
        <Card v-for="item in 3" :key="item" class="loading-card"><Skeleton class="h-4 w-2/3" /><Skeleton class="h-4 w-full" /><Skeleton class="h-4 w-1/2" /></Card>
      </div>
      <Card v-for="row in mobileRows" v-else :key="row.key" class="mobile-record">
        <div
          v-for="(column, index) in columns"
          :key="column"
          class="mobile-field"
          :class="{ 'primary-field': index === firstVisibleColumn }"
          v-show="!hiddenColumns.includes(index)"
        >
          <small>{{ column }}</small>
          <div>
            <slot
              name="cell"
              :row="row"
              :index="index"
              :value="row.cells[index]"
              ><Badge v-if="row.statusIndex === index" :variant="statusVariant(row.cells[index])">{{ statusLabel(row.cells[index]) }}</Badge><span v-else>{{ row.cells[index] }}</span></slot
            >
          </div>
        </div>
        <div v-if="$slots.actions" class="mobile-field mobile-actions">
          <small>Actions</small>
          <div><slot name="actions" :row="row" /></div>
        </div>
      </Card>
      <p v-if="!loading && !mobileRows.length" class="grid-empty" role="status">
        {{ activeFilterCount ? 'No records on this page match your column filters.' : 'No matching records.' }}
      </p>
    </div>
    <AgGridVue
      v-show="!compact"
      class="desktop-grid"
      :aria-label="title"
      :style="{ height: gridHeight }"
      :theme="gridTheme"
      :modules="modules"
      :column-defs="columnDefs"
      :row-data="orderedRows"
      :post-sort-rows="keepInactiveLast"
      :default-col-def="defaultColDef"
      :get-row-id="getRowId"
      :loading="loading"
      :row-height="density === 'compact' ? 44 : 60"
      :header-height="44"
      :enable-cell-text-selection="true"
      :ensure-dom-order="true"
      :animate-rows="false"
      :tooltip-show-delay="400"
      overlay-no-rows-template="No matching records."
      @grid-ready="ready"
      @grid-pre-destroyed="api = null"
      @filter-changed="updateView"
      @sort-changed="updateView"
      @row-data-updated="updateView"
      @column-visible="syncColumns"
    />
  </section>
</template>
<script setup lang="ts">
import { statusLabel } from "../../data/statusPresentation";
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
import { activeFirst } from '../../data/statusOrder';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem,
  DropdownMenuItemIndicator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { Columns3, Check, ScanLine, RotateCcw, X } from "@lucide/vue";
import {
  ClientSideRowModelModule,
  ClientSideRowModelApiModule,
  ColumnApiModule,
  ColumnAutoSizeModule,
  RowAutoHeightModule,
  TextFilterModule,
  NumberFilterModule,
  DateFilterModule,
  TooltipModule,
  ValidationModule,
  themeQuartz,
  type ColDef,
  type GetRowIdParams,
  type GridApi,
  type GridReadyEvent,
  type ICellRendererParams,
  type PostSortRowsParams,
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
    density?: "comfortable" | "compact";
    actionWidth?: number;
    columnMinWidths?: number[];
    columnFlex?: number[];
    maxGridHeight?: number;
    displayOnlyColumns?: number[];
    columnTypes?: ("text" | "number" | "date")[];
  }>(),
  { loading: false, density: "comfortable", actionWidth: 160, columnMinWidths: () => [], maxGridHeight: 560, displayOnlyColumns: () => [], columnTypes: () => [] },
);
const emit = defineEmits<{ ready: [api: GridApi<RecordGridRow>] }>();
const slots = useSlots();
const api = shallowRef<GridApi<RecordGridRow> | null>(null);
const displayedRows = shallowRef<RecordGridRow[] | null>(null);
const activeFilterCount = ref(0);
const hiddenColumns = ref<number[]>([]);
const visibleCount = computed(() => displayedRows.value?.length ?? props.rows.length);
const firstVisibleColumn = computed(() => props.columns.findIndex((_, index) => !hiddenColumns.value.includes(index)));
function updateView() {
  if (!api.value) return;
  const rows: RecordGridRow[] = [];
  api.value.forEachNodeAfterFilterAndSort(node => { if (node.data) rows.push(node.data); });
  displayedRows.value = rows;
  activeFilterCount.value = Object.keys(api.value.getFilterModel()).length;
  const sort = api.value.getColumnState().filter(column => column.sort).sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0))[0];
  mobileSort.value = sort ? `${sort.colId.replace('cell-', '')}:${sort.sort}` : '';
}
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
  if (/^(CANCELLED|EXPIRED|NO_SHOW)$/.test(status)) return "destructive";
  return "default";
}
const compact = ref(typeof window !== "undefined" && window.innerWidth < 700);
const mobileSort = ref("");
const orderedRows = computed(() => activeFirst(props.rows, row => row.source?.isActive === false));
function keepInactiveLast(params: PostSortRowsParams<RecordGridRow>) {
  const ordered = activeFirst(params.nodes, node => node.data?.source?.isActive === false);
  ordered.forEach((node, index) => { params.nodes[index] = node; });
}
const mobileRows = computed(() => displayedRows.value ?? orderedRows.value);
function sortMobile(event: Event) {
  const value = (event.target as HTMLSelectElement).value;
  const [index, direction] = value.split(':');
  api.value?.applyColumnState({ state: value ? [{ colId: `cell-${index}`, sort: direction === 'desc' ? 'desc' : 'asc', sortIndex: 0 }] : [], defaultState: { sort: null } });
}
function clearFilters() { api.value?.setFilterModel(null); }
const modules = [
  ClientSideRowModelModule,
  ClientSideRowModelApiModule,
  ColumnApiModule,
  ColumnAutoSizeModule,
  RowAutoHeightModule,
  TextFilterModule,
  NumberFilterModule,
  DateFilterModule,
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
  fontSize: 14,
  borderRadius: 12,
  wrapperBorderRadius: 12,
  spacing: 6,
});
const gridHeight = computed(
  () => `${Math.min(props.maxGridHeight, Math.max(props.density === "compact" ? 150 : 250, props.rows.length * (props.density === "compact" ? 44 : 60) + 48))}px`,
);
const defaultColDef: ColDef<RecordGridRow> = {
  sortable: true,
  filter: "agTextColumnFilter",
  resizable: true,
  minWidth: 150,
  flex: 1,
  wrapText: true,
  autoHeight: true,
  wrapHeaderText: true,
  autoHeaderHeight: true,
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
                ? h(Badge, { variant: statusVariant(row.cells[index]) }, () => statusLabel(row.cells[index] ?? ""))
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
      filter: props.displayOnlyColumns.includes(index) ? false : props.columnTypes[index] === 'number' ? 'agNumberColumnFilter' : props.columnTypes[index] === 'date' ? 'agDateColumnFilter' : 'agTextColumnFilter',
      filterValueGetter: ({ data }) => {
        const raw = data?.sortValues?.[index] ?? data?.cells[index];
        if (props.columnTypes[index] === 'number') return raw == null || raw === '' || !Number.isFinite(Number(raw)) ? null : Number(raw);
        if (props.columnTypes[index] === 'date') {
          if (raw == null || raw === '') return null;
          const date = new Date(raw);
          if (Number.isNaN(date.getTime())) return null;
          const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(date);
          const part = (type: string) => Number(parts.find(p => p.type === type)?.value);
          return new Date(part('year'), part('month') - 1, part('day'));
        }
        return data?.cells[index] ?? '';
      },
      valueGetter: ({ data }) => data?.cells[index] ?? "",
      tooltip: ({ value }) => String(value ?? ""),
      cellRenderer: renderer(index),
      minWidth: props.columnMinWidths[index] ?? (index === 0 ? 170 : 150),
      flex: props.columnFlex?.[index] ?? 1,
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
  updateView();
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
  updateView();
  if (!compact.value) fitColumns();
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
  container: records / inline-size;
}
.grid-tools {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px 16px;
  flex-wrap: wrap;
  padding: 10px 14px;
  color: var(--muted);
  font-size: var(--text-caption);
}
.grid-tools > div {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  min-width: 0;
}
.grid-summary { align-items: center; }
.grid-count { color: var(--ink); white-space: nowrap; font-variant-numeric: tabular-nums; }
.grid-count strong { font-weight: 650; }
.grid-scope { color: var(--muted); }
.grid-actions { margin-left: auto; align-items: center; }
.grid-tools .clear-filters { color: var(--ocean); padding-inline: 6px; }
.grid-tools button {
  padding: 7px 10px;
  border-radius: 8px;
  font: inherit;
  font-size: var(--text-caption);
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
.records-grid :deep(.grid-cell-content) { min-width: 0; width: 100%; }
.records-grid :deep(.ag-header-cell-text) { line-height: 1.35; }
.records-grid :deep(.record-status) {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 6px;
  background: var(--light-blue);
  color: var(--ocean);
  font-size: var(--text-caption);
  font-weight: 650;
}
.mobile-records {
  padding: 12px;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  min-width: 0;
  gap: 12px;
}
.mobile-record {
  padding: 12px 14px;
  box-shadow: none;
  border-radius: 10px;
}
.mobile-field {
  display: flex;
  justify-content: space-between;
  align-items: start;
  gap: 14px;
  padding: 7px 0;
  font-size: var(--text-label);
}
.mobile-field > small {
  color: var(--muted);
  font-size: var(--text-caption);
  flex: none;
  max-width: 40%;
}
.mobile-field > div {
  min-width: 0;
  text-align: right;
  overflow-wrap: anywhere;
}
.grid-empty,
.mobile-records > p {
  padding: 24px 12px;
  margin: 0;
  text-align: center;
  color: var(--muted);
  font-size: var(--text-label);
}
.grid-tools span {
  line-height: 1.5;
}
.grid-tools button { min-height: 34px; }
.grid-tools button svg { width: 15px; height: 15px; }
.column-check { width: 16px; height: 16px; }
.loading-cards { display: grid; gap: 12px; }
.loading-card { padding: 18px; display: grid; gap: 15px; }
.dense-grid :deep(.grid-cell-content) { padding: 6px 0; line-height: 1.5; }
.dense-grid .mobile-records { gap: 7px; padding: 10px; }
.dense-grid .mobile-record { padding: 10px 12px; }
.dense-grid .mobile-field { padding: 5px 0; font-size: var(--text-label); }
.mobile-sort { display: flex; align-items: center; justify-content: space-between; gap: 12px; color: var(--muted); font-size: var(--text-caption); padding: 0 2px 6px; }
.mobile-sort select { min-width: 0; max-width: 65%; min-height: 44px; padding: 8px 10px; border: 1px solid var(--line); border-radius: 8px; color: var(--ink); background: var(--surface); font: inherit; }
.mobile-field.primary-field { display: grid; gap: 4px; padding: 4px 0 12px; margin-bottom: 6px; border-bottom: 1px solid var(--line); }
.primary-field > small { max-width: none; }
.primary-field > div { text-align: left; font-weight: 650; font-size: 15px; }
.mobile-actions { border-top: 1px solid var(--line); margin-top: 8px; padding-top: 12px; align-items: center; }
.mobile-actions > div { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
@container records (max-width: 600px) {
  .grid-tools { align-items: stretch; gap: 6px; }
  .grid-summary { width: 100%; gap: 6px; }
  .grid-actions { width: 100%; margin-left: 0; gap: 6px; }
  .grid-tools button { min-height: 44px; }
}
</style>
