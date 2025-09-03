// lecture-to-anki/backend/eslint.config.mjs
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  // JS recommendations
  js.configs.recommended,

  // TypeScript recommendations (type-aware)
  ...tseslint.configs.recommendedTypeChecked,

  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: new URL(".", import.meta.url).pathname,
      },
    },
    rules: {
      // ↓ Relax these so you can iterate. Tighten later if you want.
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-console": "off",
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },

  // Ignores (instead of .eslintignore)
  {
    ignores: ["node_modules/**", "dist/**", "build/**", "coverage/**"],
  }
);