import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

// Each PGlite instance and Edge Function mock runs in a fresh CLI process.
// Node's shared test runtime/worker has produced WebAssembly signature errors on Windows.
for (const file of fs.readdirSync('tests/database').filter(f=>f.endsWith('.test.mjs')).sort()) {
  const result=spawnSync(process.execPath,['--test','--test-isolation=none',`tests/database/${file}`],{stdio:'inherit',windowsHide:true});
  if(result.error)throw result.error;
  if(result.status!==0)process.exit(result.status??1);
}
