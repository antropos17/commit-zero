import js from "@eslint/js";
import globals from "globals";
import { builtinModules } from "node:module";
const nodeImports = [
  ...new Set(builtinModules.flatMap((name) => [name, `node:${name}`])),
];
export default [
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "runtime/**",
      ".cache/**",
      "prototype-backup-*/**",
    ],
  },
  js.configs.recommended,
  {
    files: ["prototype/app/**/*.jsx"],
    languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
    plugins: {
      local: {
        rules: {
          "jsx-variables": {
            create(context) {
              return {
                JSXOpeningElement() {
                  context.sourceCode.markVariableAsUsed("React");
                },
                JSXFragment() {
                  context.sourceCode.markVariableAsUsed("React");
                },
                JSXIdentifier(node) {
                  if (
                    !/^[A-Z]/.test(node.name) ||
                    node.parent.type === "JSXAttribute" ||
                    (node.parent.type === "JSXMemberExpression" &&
                      node.parent.property === node)
                  )
                    return;
                  if (!context.sourceCode.markVariableAsUsed(node.name, node))
                    context.report({
                      node,
                      message: "Undefined JSX component: " + node.name,
                    });
                },
              };
            },
          },
        },
      },
    },
    rules: { "local/jsx-variables": "error" },
  },
  {
    files: ["**/*.mjs", "**/*.js", "**/*.jsx"],
    languageOptions: { globals: globals.node },
    rules: {
      "no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    files: ["prototype/app/**/*.{jsx,mjs}"],
    languageOptions: {
      globals: {
        ...Object.fromEntries(
          Object.keys(globals.node).map((name) => [name, "off"]),
        ),
        ...globals.browser,
      },
    },
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: nodeImports,
          patterns: [
            {
              regex: "(?:^|/)(?:server|services|scripts|tests)/",
              message:
                "Browser UI uses the API client or shared pure modules, never server internals.",
            },
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXOpeningElement[name.name='details']",
          message:
            "Keep content in visible sections; disclosure arrows violate DESIGN.md.",
        },
      ],
      "no-eval": "error",
      "no-implied-eval": "error",
    },
  },
  {
    files: ["tests/browser/**/*.mjs"],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  {
    files: ["shared/**/*.mjs", "server/domain/**/*.mjs"],
    languageOptions: {
      globals: {
        ...Object.fromEntries(
          Object.keys(globals.node).map((name) => [name, "off"]),
        ),
        structuredClone: "readonly",
      },
    },
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: nodeImports,
          patterns: [
            {
              regex: "(?:^|/)(?:services|prototype)/",
              message:
                "Keep domain/shared transformations independent of transport and UI.",
            },
          ],
        },
      ],
    },
  },
];
