export function collectionChart(points: { date: string; revenue: number }[]) {
  const max = Math.max(0, ...points.map(point => point.revenue));
  const rough = (max || 100) / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = ([1, 2, 5, 10].find(value => value * magnitude >= rough) || 10) * magnitude;
  const ceiling = step * 4;
  const plotted = points.map((point,index) => ({...point,
    x:points.length===1 ? 300 : 10+index/(points.length-1)*580,
    y:180-point.revenue/ceiling*160,
  }));
  const line = plotted.map(point => `${point.x},${point.y}`).join(' ');
  const area = plotted.length ? `${plotted[0]!.x},180 ${line} ${plotted[plotted.length-1]!.x},180` : '';
  const indices = [...new Set(Array.from({length:Math.min(4,points.length)},(_,index) => Math.round(index*(points.length-1)/Math.max(1,Math.min(4,points.length)-1))))];
  return { ceiling, plotted, line, area, ticks:[ceiling,ceiling/2,0], labels:indices.map(index => points[index]!.date), max };
}
export function collectionDateLabel(date: string) {
  return new Intl.DateTimeFormat('en-PH',{timeZone:'UTC',month:'short',...(date.length===7?{year:'numeric'}:{day:'numeric'})})
    .format(new Date(`${date.length===7?date+'-01':date}T00:00:00Z`));
}
