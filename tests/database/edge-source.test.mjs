import { it } from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { edgeFunctionSource } from '../../scripts/edge-function-source.mjs';
it('bundles local helpers into every single-file Management API upload', () => {
  for (const slug of ['manage-account', 'paymongo', 'weather', 'chatbot']) {
    const source = edgeFunctionSource(slug);
    assert.doesNotMatch(source, /from ['"]\.{1,2}\//);
    assert.match(source, /Deno\.serve/);
    if (slug !== 'chatbot') assert.match(source, /async function readBody/);
    const compiled = ts.transpileModule(source, {
      reportDiagnostics: true,
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
    });
    assert.equal(
      compiled.diagnostics?.filter((d) => d.category === ts.DiagnosticCategory.Error).length,
      0,
    );
  }
  assert.throws(() => edgeFunctionSource('../private'));
});
