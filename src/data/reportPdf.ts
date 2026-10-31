import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';

export type PdfReport = {
  title: string;
  scope: string[];
  headers: string[];
  rows: (string | number)[][];
  summary?: { label: string; value: string }[];
  note: string;
};
let fonts: Promise<string[]> | undefined;
let logo: Promise<Uint8Array> | undefined;
const pdfText = (value: string | number) => String(value).replace(/\u2192/g, ' to ').replace(/\u20b1/g, 'PHP ');
function logoData() {
  return logo ??= fetch(`${import.meta.env.BASE_URL}images/brand/barkolink-mark.png`).then(async response => {
    if (!response.ok) throw new Error('The report logo could not be loaded. Try again.');
    return new Uint8Array(await response.arrayBuffer());
  }).catch(error => { logo = undefined; throw error; });
}
function fontData() {
  return fonts ??= Promise.all(['Regular', 'Bold'].map(async weight => {
    const response = await fetch(`${import.meta.env.BASE_URL}fonts/NotoSans-${weight}.ttf`);
    if (!response.ok) throw new Error('The PDF font could not be loaded. Try again.');
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
    return btoa(binary);
  })).catch(error => { fonts = undefined; throw error; });
}
export async function createReportPdf(input: PdfReport) {
  const orientation = input.headers.length > 6 ? 'landscape' : 'portrait';
  const doc = new jsPDF({ orientation, unit: 'mm', format: 'legal', compress: true, putOnlyUsedFonts: true });
  const [data, mark] = await Promise.all([fontData(), logoData()]);
  for (const [index, style] of ['normal', 'bold'].entries()) {
    const file = `NotoSans-${style}.ttf`;
    doc.addFileToVFS(file, data[index]!);doc.addFont(file, 'NotoSans', style);
  }
  doc.setFont('NotoSans');
  doc.setProperties({ title: `BarkoLink | ${input.title}`, author: 'BarkoLink', subject: input.note });
  const width = doc.internal.pageSize.getWidth(), height = doc.internal.pageSize.getHeight();
  const generated = new Intl.DateTimeFormat('en-PH', { timeZone:'Asia/Manila', dateStyle:'medium', timeStyle:'short' }).format(new Date());
  const margin = 14, contentWidth = width - margin * 2;
  doc.setFont('NotoSans', 'bold');doc.setFontSize(17);
  const title = doc.splitTextToSize(pdfText(input.title), contentWidth) as string[];
  const bannerHeight = 24 + title.length * 7;
  doc.setFont('NotoSans', 'normal');doc.setFontSize(8);
  const scope = doc.splitTextToSize(input.scope.map(pdfText).join('   /   '), contentWidth - 10) as string[];
  const headerHeight = bannerHeight + 8 + scope.length * 4;
  doc.setFontSize(7);
  const notes = doc.splitTextToSize(pdfText(input.note), contentWidth) as string[];
  const footerHeight = 15 + notes.length * 3.4;
  const renderedHeaders = new Set<number>();
  function pageHeader() {
    const page = doc.getCurrentPageInfo().pageNumber;
    if (renderedHeaders.has(page)) return;
    renderedHeaders.add(page);
    doc.setFillColor(255,255,255);doc.rect(0,0,width,bannerHeight,'F');
    doc.addImage(mark,'PNG',margin,8,10,10,'barkolink-logo');
    doc.setTextColor(9,35,59);doc.setFontSize(13);doc.setFont('NotoSans','bold');doc.text('BarkoLink',margin+14,13);
    doc.setFont('NotoSans','normal');doc.setFontSize(7);doc.setTextColor(85,103,119);doc.text('OPERATIONS & MANAGEMENT REPORT',margin+14,18);
    doc.setFontSize(7);doc.text('PREPARED IN PHILIPPINE TIME',width-margin,11,{align:'right'});
    doc.setTextColor(45,73,94);doc.setFontSize(8);doc.text(generated,width-margin,16,{align:'right'});
    doc.setTextColor(9,35,59);doc.setFont('NotoSans','bold');doc.setFontSize(17);doc.text(title,margin,27,{lineHeightFactor:1.17});
    doc.setDrawColor(16,93,127);doc.setLineWidth(0.5);doc.line(margin,bannerHeight,width-margin,bannerHeight);
    doc.setFont('NotoSans','normal');doc.setFontSize(8);doc.setTextColor(75,93,108);doc.text(scope,margin+5,bannerHeight+8,{lineHeightFactor:1.4});
  }
  pageHeader();
  let startY = headerHeight + 7;
  const summary = input.summary || [];
  const columns = Math.min(summary.length, 3), gap = 4;
  const cardWidth = (contentWidth - (columns - 1) * gap) / Math.max(columns, 1);
  for (let offset = 0; offset < summary.length; offset += columns) {
    const cards = summary.slice(offset, offset + columns).map(item => {
      doc.setFont('NotoSans','normal');doc.setFontSize(8);
      const label = doc.splitTextToSize(pdfText(item.label),cardWidth-16) as string[];
      doc.setFont('NotoSans','bold');doc.setFontSize(13);
      const value = doc.splitTextToSize(pdfText(item.value),cardWidth-16) as string[];
      return { label, value, height: 10 + label.length * 4 + value.length * 6 };
    });
    const cardHeight = Math.max(...cards.map(card => card.height));
    if (startY + cardHeight > height - footerHeight - 14) { doc.addPage();pageHeader();startY = headerHeight + 7; }
    cards.forEach((card, index) => {
      const x = margin + index * (cardWidth + gap);
      doc.setFillColor(245,249,252);doc.setDrawColor(215,229,238);doc.setLineWidth(0.25);
      doc.roundedRect(x,startY,cardWidth,cardHeight,2,2,'FD');
      doc.setFillColor(12,137,165);doc.rect(x+4,startY+5,1,cardHeight-10,'F');
      doc.setFont('NotoSans','normal');doc.setFontSize(8);doc.setTextColor(75,99,119);
      doc.text(card.label,x+8,startY+7,{lineHeightFactor:1.4});
      doc.setFont('NotoSans','bold');doc.setFontSize(13);doc.setTextColor(9,58,87);
      doc.text(card.value,x+8,startY+9+card.label.length*4,{lineHeightFactor:1.3});
    });
    startY += cardHeight + gap;
  }
  startY += 3;
  autoTable(doc,{
    startY, head:[input.headers.map(pdfText)],body:input.rows.map(row => row.map(pdfText)), theme:'striped',
    styles:{font:'NotoSans',fontSize:orientation === 'landscape' ? 8.5 : 9.5,cellPadding:3,overflow:'linebreak',textColor:[28,49,67],lineColor:[222,232,240],lineWidth:{bottom:0.15}},
    headStyles:{fillColor:[16,66,96],textColor:255,fontStyle:'bold',cellPadding:3},alternateRowStyles:{fillColor:[241,247,251]},
    margin:{left:margin,right:margin,top:headerHeight+7,bottom:footerHeight},showHead:'everyPage',rowPageBreak:'avoid',
    didParseCell: cell => {
      if (cell.section === 'body' && /^(?:PHP\s*)?-?[\d,.]+%?$/.test(String(cell.cell.raw))) cell.cell.styles.halign = 'right';
    },
    willDrawPage:pageHeader,
  });
  const pages = doc.getNumberOfPages();
  for (let page=1;page<=pages;page++) {
    doc.setPage(page);doc.setFont('NotoSans','normal');doc.setFontSize(7);doc.setTextColor(75,93,108);
    doc.setDrawColor(204,222,234);doc.setLineWidth(0.3);doc.line(margin,height-footerHeight+2,width-margin,height-footerHeight+2);
    doc.text(notes,margin,height-footerHeight+7,{lineHeightFactor:1.35});
    doc.setFont('NotoSans','bold');doc.setTextColor(16,93,127);doc.text('BarkoLink',margin,height-6);
    doc.setFont('NotoSans','normal');doc.setTextColor(75,93,108);doc.text('Travel smarter. Sail easier.',margin+15,height-6);
    doc.text(`Page ${page} of ${pages}`,width-margin,height-6,{align:'right'});
  }
  return doc;
}
export async function downloadReportPdf(input: PdfReport, filename: string) {
  const doc = await createReportPdf(input);
  doc.save(filename.replace(/[^a-zA-Z0-9_.-]/g,'-'));
}
