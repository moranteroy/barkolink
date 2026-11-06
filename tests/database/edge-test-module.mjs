import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

/** Resolve actual TypeScript imports, including formatter-generated multiline imports. */
export function edgeTestModule(slug, factory) {
  if (!/^[\w$]+$/.test(factory)) throw new Error('Invalid mock factory name.');
  const root = path.resolve('supabase/functions');
  const modules = new Map();
  function read(file) {
    if (!file.startsWith(root + path.sep))
      throw new Error('Edge fixture escaped the functions folder.');
    if (modules.has(file)) return modules.get(file);
    const source = fs.readFileSync(file, 'utf8');
    const syntax = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
    const edits = syntax.statements.filter(ts.isImportDeclaration).map((node) => {
      const specifier = node.moduleSpecifier.text;
      let replacement;
      if (node.importClause?.isTypeOnly) replacement = '';
      else if (
        specifier === '@supabase/supabase-js' ||
        specifier.startsWith('npm:@supabase/supabase-js')
      )
        replacement = `const createClient = globalThis.${factory};`;
      else if (specifier.startsWith('.'))
        replacement = `import ${node.importClause.getText(syntax)} from ${JSON.stringify(read(path.resolve(path.dirname(file), specifier)))};`;
      else throw new Error('Unexpected external Edge fixture import.');
      return { start: node.getStart(syntax), end: node.end, replacement };
    });
    let result = source;
    for (const edit of edits.reverse())
      result = result.slice(0, edit.start) + edit.replacement + result.slice(edit.end);
    const { outputText, diagnostics } = ts.transpileModule(result, {
      reportDiagnostics: true,
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
    });
    if (diagnostics?.some((item) => item.category === ts.DiagnosticCategory.Error))
      throw new Error('Invalid Edge fixture TypeScript.');
    const url = `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`;
    modules.set(file, url);
    return url;
  }
  return read(path.join(root, slug, 'index.ts'));
}
