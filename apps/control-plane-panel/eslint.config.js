import { baseConfig } from "@qticaret/config/eslint"
import reactHooks from "eslint-plugin-react-hooks"
import reactRefresh from "eslint-plugin-react-refresh"
import globals from "globals"

export default [
  ...baseConfig(import.meta.dirname),
  // Written by the TanStack Router plugin on every dev/build run
  { ignores: ["src/routeTree.gen.ts"] },
  // Playwright's own output: the run's session, results and HTML report
  { ignores: ["e2e/.auth/**", "e2e/.results/**", "e2e/.report/**"] },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: { globals: globals.browser },
    plugins: { "react-hooks": reactHooks, "react-refresh": reactRefresh },
    rules: {
      ...reactHooks.configs.flat.recommended.rules,
      // Route files export their `Route` constant next to the component
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      // React Hook Form names array fields by index (`variants.${index}.price`)
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
    },
  },
  {
    // Playwright's tests run in Node, and its fixtures' `use` is no React hook
    files: ["e2e/**/*.ts"],
    languageOptions: { globals: globals.node },
    rules: { "react-hooks/rules-of-hooks": "off" },
  },
  {
    // TanStack Router's idiom: `throw redirect(...)` throws a plain object
    files: ["src/routes/**"],
    rules: { "@typescript-eslint/only-throw-error": "off" },
  },
]
