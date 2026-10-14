/** Global ordering is explicitly requested; normal searches retain server pagination. */
export async function orderedDirectory<T>(
  readPage: (page: number, size: number) => Promise<{ rows: T[]; total: number }>,
  order: string, value: (row: T, key: string) => string | number,
  page: number, pageSize: number,
) {
  const all: T[] = [];
  const first = await readPage(0, 100);
  all.push(...first.rows);
  for (let next = 1; all.length < first.total; next++) {
    const batch = await readPage(next, 100);
    if (!batch.rows.length) throw new Error('Records changed while sorting. Refresh and try again.');
    all.push(...batch.rows);
  }
  const [key, direction] = order.split(':');
  const collator = new Intl.Collator('en', { numeric:true, sensitivity:'base' });
  const sorted = all.map((row,index) => ({row,index})).sort((a,b) => {
    const left=value(a.row,key), right=value(b.row,key);
    const result = typeof left==='number' && typeof right==='number' ? left-right : collator.compare(String(left),String(right));
    return (direction==='desc' ? -result : result) || a.index-b.index;
  });
  return { rows:sorted.slice(page*pageSize,(page+1)*pageSize).map(item=>item.row), total:sorted.length };
}
