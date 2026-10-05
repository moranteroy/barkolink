// Parent-component tests exercise their own data and actions; browser checks use the real grid.
export const recordsGridStub = {
  props:['columns','rows','loading'],
  template:`<section class="records-grid"><table><thead><tr><th v-for="column in columns" :key="column">{{ column }}</th></tr></thead><tbody><tr v-for="row in rows" :key="row.key"><td v-for="(value,index) in row.cells" :key="index"><slot name="cell" :row="row" :index="index" :value="value">{{ value }}</slot></td><td v-if="$slots.actions"><slot name="actions" :row="row" /></td></tr></tbody></table></section>`
}
