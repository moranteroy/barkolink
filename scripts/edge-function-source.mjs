import fs from 'node:fs';
import path from 'node:path';

// Management API single-file uploads must include all local TypeScript helpers.
export function edgeFunctionSource(slug) {
  if (!['manage-account','paymongo','weather','chatbot'].includes(slug)) throw new Error('Unknown Edge Function.');
  const root=path.resolve('supabase/functions');
  const included=new Set();
  function read(file) {
    const full=path.resolve(file);
    if(!full.startsWith(root+path.sep))throw new Error('Edge source is outside the functions directory.');
    if(included.has(full))return '';
    included.add(full);
    return fs.readFileSync(full,'utf8').replace(/^import .* from ['"](\.{1,2}\/[^'"]+)['"];\r?$/gm,
      (_line,relative)=>read(path.resolve(path.dirname(full),relative)).replace(/^export /gm,''));
  }
  const source=read(path.join(root,slug,'index.ts'));
  if(/from ['"]\.{1,2}\//.test(source))throw new Error('Unbundled local Edge Function import.');
  return source;
}
