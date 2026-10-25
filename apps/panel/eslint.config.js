import { baseConfig } from "@qticaret/config/eslint"
import reactHooks from "eslint-plugin-react-hooks"
import reactRefresh from "eslint-plugin-react-refresh"
import globals from "globals"

export default [
  ...baseConfig(import.meta.dirname),
  // Written by the TanStack Router plugin on every dev/build run
  { ignores: ["src/routeTree.gen.ts"] },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: { globals: globals.browser },
    plugins: { "react-hooks": reactHooks, "react-refresh": reactRefresh },
    rules: {
      ...reactHooks.configs.flat.recommended.rules,
      // Route files export their `Route` constant next to the component
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
    },
  },
  {
    // shadcn's generated components (docs/18 §6): changed only through its
    // CLI, so its style stays; our rules apply to what we write around them
    files: ["src/components/ui/**"],
    rules: {
      "@typescript-eslint/consistent-type-definitions": "off",
      "@typescript-eslint/restrict-template-expressions": "off",
      "@typescript-eslint/no-confusing-void-expression": "off",
      "react-hooks/purity": "off",
      "react-refresh/only-export-components": "off",
    },
  },
  {
    // TanStack Router's idiom: `throw redirect(...)` throws a plain object
    files: ["src/routes/**"],
    rules: { "@typescript-eslint/only-throw-error": "off" },
  },
]
