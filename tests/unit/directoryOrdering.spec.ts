import { describe, expect, it, vi } from 'vitest';
import { orderedDirectory } from '../../src/data/directoryOrdering';
describe('ordering all matching records', () => {
  it('sorts before pagination, including matching records beyond the original first page', async () => {
    const read = vi.fn(async (page: number) => ({ rows: page === 0 ? [{ name:'Zulu' },{name:'Mike'}] : [{name:'Alpha'}], total:3 }));
    const result=await orderedDirectory(read,'name:asc',row=>row.name,0,2);
    expect(result.rows.map(row=>row.name)).toEqual(['Alpha','Mike']);
    expect(result.total).toBe(3);
    expect(read).toHaveBeenCalledTimes(2);
  });
  it('does not present an incomplete ordering as a complete result when a page fails', async () => {
    const read=vi.fn(async(page:number)=>({rows:page ? [] : [{amount:1}],total:2}));
    await expect(orderedDirectory(read,'amount:desc',row=>row.amount,0,1)).rejects.toThrow('Records changed');
  });
});
