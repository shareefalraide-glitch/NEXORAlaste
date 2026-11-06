import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';

// ESLint's core no-undef rule does not treat JSX tag names as identifier
// references. Check component roots too, without treating HTML tags as globals.
const jsxBindings = {
  meta: { type: 'problem', messages: { missing: "'{{name}}' is not defined." } },
  create(context) {
    return {
      JSXOpeningElement(node) {
        let root = node.name;
        while (root.type === 'JSXMemberExpression') root = root.object;
        if (root.type !== 'JSXIdentifier') return;
        const name = root.name;
        if (node.name.type === 'JSXIdentifier' && /^[a-z]/.test(name)) return;
        if (name === 'this') return;
        let scope = context.sourceCode.getScope(node);
        while (scope && !scope.set.has(name)) scope = scope.upper;
        if (!scope) context.report({ node: root, messageId: 'missing', data: { name } });
      },
    };
  },
};

export default [
  { ignores: ['dist/**', 'node_modules/**', 'demo/**', 'coverage/**'] },
  {
    files: ['src/**/*.{js,jsx}', 'tests/**/*.mjs', 'scripts/**/*.mjs', '*.config.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: { local: { rules: { 'jsx-bindings': jsxBindings } }, 'react-hooks': reactHooks },
    rules: {
      'no-undef': 'error',
      'local/jsx-bindings': 'error',
      'react-hooks/rules-of-hooks': 'error',
    },
  },
];
