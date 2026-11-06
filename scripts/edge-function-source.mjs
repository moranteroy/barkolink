import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

// Management API single-file uploads must include all local TypeScript helpers.
export function edgeFunctionSource(slug) {
  if (!['manage-account', 'paymongo', 'weather', 'chatbot'].includes(slug))
    throw new Error('Unknown Edge Function.');
  const root = path.resolve('supabase/functions');
  const included = new Set();
  const imports = JSON.parse(fs.readFileSync(path.join(root, 'deno.json'), 'utf8')).imports;
  function read(file) {
    const full = path.resolve(file);
    if (!full.startsWith(root + path.sep))
      throw new Error('Edge source is outside the functions directory.');
    if (included.has(full)) return '';
    included.add(full);
    const source = fs.readFileSync(full, 'utf8');
    const syntax = ts.createSourceFile(full, source, ts.ScriptTarget.Latest, true);
    const edits = syntax.statements
      .filter((node) => ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier))
      .flatMap((node) => {
        const relative = node.moduleSpecifier.text;
        if (relative.startsWith('.'))
          return [
            {
              start: node.getStart(syntax),
              end: node.end,
              replacement: read(path.resolve(path.dirname(full), relative)).replace(
                /^export /gm,
                '',
              ),
            },
          ];
        if (imports[relative])
          return [
            {
              start: node.moduleSpecifier.getStart(syntax),
              end: node.moduleSpecifier.end,
              replacement: JSON.stringify(imports[relative]),
            },
          ];
        return [];
      });
    let result = source;
    for (const edit of edits.reverse())
      result = result.slice(0, edit.start) + edit.replacement + result.slice(edit.end);
    return result;
  }
  const source = read(path.join(root, slug, 'index.ts'));
  if (/from ['"]\.{1,2}\//.test(source)) throw new Error('Unbundled local Edge Function import.');
  return source;
}
