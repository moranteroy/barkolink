import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const project = process.cwd();
const binary = path.join(
  project,
  'node_modules/deno',
  process.platform === 'win32' ? 'deno.exe' : 'deno',
);
if (!fs.existsSync(binary)) throw new Error('Install development dependencies first with npm ci.');
const roots = [project, ...(process.argv.includes('--parent') ? [path.dirname(project)] : [])];
for (const root of roots) {
  const file = path.join(root, '.vscode/settings.json');
  const current = fs.existsSync(file)
    ? ts.parseConfigFileTextToJson(file, fs.readFileSync(file, 'utf8'))
    : { config: {} };
  if (current.error)
    throw new Error('Existing editor settings are invalid; no settings were overwritten.');
  const relative = (target) => './' + path.relative(root, target).replaceAll('\\', '/');
  const settings = {
    ...current.config,
    'deno.enablePaths': [relative(path.join(project, 'supabase/functions'))],
    'deno.config': relative(path.join(project, 'supabase/functions/deno.json')),
    'deno.path': relative(binary),
    'deno.lint': true,
    'editor.defaultFormatter': 'esbenp.prettier-vscode',
    'editor.formatOnSave': true,
    'editor.tabSize': 2,
    'editor.insertSpaces': true,
    'editor.detectIndentation': false,
    'typescript.tsdk': relative(path.join(project, 'node_modules/typescript/lib')),
    'typescript.enablePromptUseWorkspaceTsdk': true,
  };
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(settings, null, 2) + '\n');
  console.log(
    'Configured scoped Deno diagnostics and two-space formatting for ' + path.basename(root) + '.',
  );
}
