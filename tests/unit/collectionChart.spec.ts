import { describe, expect, it } from 'vitest';
import { collectionChart, collectionDateLabel } from '../../src/data/collectionChart';

describe('collection chart', () => {
  it('keeps zero values on the baseline and scales a large peak without clipping', () => {
    const chart = collectionChart([
      { date: '2026-10-01', revenue: 0 },
      { date: '2026-10-02', revenue: 34980 },
    ]);
    expect(chart.plotted[0].y).toBe(180);
    expect(chart.ceiling).toBeGreaterThanOrEqual(34980);
    expect(chart.plotted.every((point) => point.y >= 20 && point.y <= 180)).toBe(true);
  });
  it('handles empty and single-period ranges and labels both range ends', () => {
    expect(collectionChart([]).line).toBe('');
    expect(collectionChart([{ date: '2026-10-01', revenue: 0 }]).plotted[0].x).toBe(300);
    const points = Array.from({ length: 31 }, (_, index) => ({
      date: `2026-10-${String(index + 1).padStart(2, '0')}`,
      revenue: 0,
    }));
    const chart = collectionChart(points);
    expect(chart.labels).toHaveLength(4);
    expect(chart.labels[0]).toBe('2026-10-01');
    expect(chart.labels.at(-1)).toBe('2026-10-31');
  });
  it('formats daily and monthly labels without applying the browser timezone', () => {
    expect(collectionDateLabel('2026-10-01')).toContain('Oct');
    expect(collectionDateLabel('2026-10')).toContain('2026');
  });
});
