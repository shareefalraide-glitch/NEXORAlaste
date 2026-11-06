import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { parse } from '@babel/parser';

const root = process.cwd();
const required = [
  'src/main.jsx',
  'src/app/App.jsx',
  'src/app/dialogs/Dialogs.jsx',
  'src/features/alerts/Alerts.jsx',
  'src/features/incidents/Incidents.jsx',
  'src/features/events/Events.jsx',
  'src/features/assets/Assets.jsx',
  'src/features/network/Network.jsx',
  'src/features/investigations/details/Details.jsx',
  'src/features/investigations/notebook/notebook-model.js',
  'src/shared/ui/index.js',
  'src/data/fixtures/demo-records.js',
  'tests/support/helpers.mjs',
];
for (const relative of required)
  assert.ok(existsSync(path.join(root, relative)), `Missing ${relative}`);
for (const obsolete of [
  'Operations.jsx',
  'Detection.jsx',
  'Admin.jsx',
  'Details.jsx',
  'Dialogs.jsx',
]) {
  assert.ok(
    !existsSync(path.join(root, 'src', obsolete)),
    `Unexpected flat module: src/${obsolete}`,
  );
}

function filesIn(folder) {
  return readdirSync(folder, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(folder, entry.name);
    return entry.isDirectory() ? filesIn(file) : [file];
  });
}
function walk(node, visitor) {
  if (!node || typeof node !== 'object') return;
  if (typeof node.type === 'string') visitor(node);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach(item => walk(item, visitor));
    else if (value && typeof value === 'object') walk(value, visitor);
  }
}
function resolveImport(from, specifier) {
  const target = path.resolve(path.dirname(from), specifier.split('?')[0]);
  const candidates = [
    target,
    ...['.js', '.jsx', '.mjs', '.css', '.json', '.png', '.svg'].map(ext => target + ext),
    ...['index.js', 'index.jsx', 'index.mjs'].map(name => path.join(target, name)),
  ];
  return candidates.find(candidate => existsSync(candidate) && statSync(candidate).isFile());
}

const modules = ['src', 'tests', 'scripts']
  .flatMap(folder => filesIn(path.join(root, folder)))
  .filter(file => /\.(?:js|jsx|mjs)$/.test(file));
modules.push(path.join(root, 'vite.config.js'), path.join(root, 'eslint.config.js'));
let checkedImports = 0;
for (const file of modules) {
  const code = readFileSync(file, 'utf8');
  const ast = parse(code, { sourceType: 'module', plugins: ['jsx'] });
  let hasJsx = false;
  const specifiers = [];
  walk(ast.program, node => {
    if (node.type === 'JSXElement' || node.type === 'JSXFragment') hasJsx = true;
    if (
      ['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration'].includes(node.type) &&
      node.source?.type === 'StringLiteral'
    ) {
      specifiers.push(node.source.value);
    }
    if (node.type === 'ImportExpression' && node.source?.type === 'StringLiteral') {
      specifiers.push(node.source.value);
    }
    if (
      node.type === 'CallExpression' &&
      node.callee?.type === 'Import' &&
      node.arguments[0]?.type === 'StringLiteral'
    ) {
      specifiers.push(node.arguments[0].value);
    }
  });
  if (hasJsx) {
    const react = ast.program.body.find(
      node =>
        node.type === 'ImportDeclaration' &&
        node.source.value === 'react' &&
        node.specifiers.some(spec => spec.local.name === 'React'),
    );
    assert.ok(
      react,
      `${path.relative(root, file)}: JSX requires React for the current Vite transform`,
    );
  }
  for (const specifier of specifiers.filter(value => value.startsWith('.'))) {
    const target = resolveImport(file, specifier);
    assert.ok(target, `${path.relative(root, file)}: unresolved import ${specifier}`);
    assert.ok(target.startsWith(root + path.sep), `Import escapes the project: ${specifier}`);
    if (file.startsWith(path.join(root, 'src/shared') + path.sep)) {
      assert.ok(
        !target.startsWith(path.join(root, 'src/features') + path.sep),
        `${path.relative(root, file)}: shared code must not depend on a feature: ${specifier}`,
      );
    }
    checkedImports++;
  }
}

// These active layers deliberately preserve the existing CSS cascade. Change
// the list consciously if a future visual change requires a different order.
const cssOrder = [
  './styles/base/theme-tokens.css',
  './styles/base/foundation.css',
  './styles/base/shell.css',
  './styles/base/ui-components.css',
  './styles/base/overview.css',
  './styles/base/tables.css',
  './styles/base/page-sections.css',
  './styles/base/detection.css',
  './styles/base/administration.css',
  './styles/base/overlays.css',
  './styles/base/login.css',
  './styles/base/responsive.css',
  './styles/base/refinements.css',
  './styles/base/theme-components.css',
  './styles/charts/visuals.css',
  './styles/features/auth.css',
  './styles/base/ux.css',
  './styles/layers/enhancements.css',
  './styles/features/tour.css',
  './styles/features/network.css',
  './styles/layers/experience.css',
  './styles/layers/final-experience.css',
  './styles/features/radar-display.css',
  './styles/layers/professional-soc.css',
  './styles/layers/analyst-experience.css',
  './styles/layers/workspace-1-5.css',
  './styles/layers/workspace-1-6.css',
  './styles/layers/workspace-1-6-1.css',
  './styles/features/api-console.css',
];
const entry = parse(readFileSync(path.join(root, 'src/main.jsx'), 'utf8'), {
  sourceType: 'module',
  plugins: ['jsx'],
});
const actualCss = entry.program.body
  .filter(node => node.type === 'ImportDeclaration' && node.source.value.startsWith('./styles/'))
  .map(node => node.source.value);
assert.deepEqual(actualCss, cssOrder, 'Global CSS layer order changed');

const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
for (const [name, command] of Object.entries(pkg.scripts)) {
  for (const [, script] of command.matchAll(/\b(?:node|sh)\s+([\w./-]+\.(?:mjs|sh))/g)) {
    assert.ok(existsSync(path.join(root, script)), `npm run ${name}: missing ${script}`);
  }
}
console.log(
  `PASS project structure: ${modules.length} modules, ${checkedImports} relative imports, CSS order and npm entry points`,
);
