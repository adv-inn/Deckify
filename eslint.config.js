import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

export default tseslint.config(
  {
    ignores: ["dist/", "dashboard/dist/", "node_modules/", "**/*.js"],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}", "dashboard/src/**/*.{ts,tsx}"],
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      // Relax recommended rules for existing code
      "no-empty": "warn",

      // React Hooks
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      // Complexity
      complexity: ["warn", 15],
      "max-depth": ["warn", 4],
      "max-lines-per-function": [
        "warn",
        { max: 80, skipBlankLines: true, skipComments: true },
      ],
      "max-params": ["warn", 4],

      // TypeScript tweaks
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
);
