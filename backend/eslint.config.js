// ESLint v9 flat config for TypeScript (non type-aware)
// If you later want type-aware rules, switch to `recommendedTypeChecked`
// and add parserOptions.project below.

import js from "@eslint/js";
import tseslint from "typescript-eslint";

/** @type {import('eslint').Linter.FlatConfig[]} */
export default [
  // Ignore build artifacts & deps
  { ignores: ["dist/**", "node_modules/**"] },

  // Base JS rules
  js.configs.recommended,

  // TS parser + recommended rules (no type-checking needed)
  ...tseslint.configs.recommended,

  // Optional: scope to your src directory for TS-specific tweaks
  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
    rules: {
      // Add/adjust rules here if you like:
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
];