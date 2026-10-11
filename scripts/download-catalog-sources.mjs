import { mkdir, writeFile } from 'node:fs/promises';
await mkdir('.audit/reference-catalog', { recursive: true });
for (const [name, url] of Object.entries({
  marina: 'https://marina.gov.ph/wp-content/uploads/2026/04/Philippine-Nautical-Highway-Matrix-MAR-2026.pdf',
  starlite: 'https://starliteferries.com/our-fleet/',
  montenegro: 'https://montenegrolines.com.ph/contact.php',
})) {
  const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
  await writeFile(`.audit/reference-catalog/${name}.${name === 'marina' ? 'pdf' : 'html'}`, Buffer.from(await response.arrayBuffer()));
  console.log(`Saved ${name} source`);
}
