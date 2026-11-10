import { baseConfig } from "@qticaret/config/eslint"
import reactHooks from "eslint-plugin-react-hooks"
import reactRefresh from "eslint-plugin-react-refresh"
import globals from "globals"

// The panel's rules (apps/panel/eslint.config.js), for the code it shares
export default [
  ...baseConfig(import.meta.dirname),
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: { globals: globals.browser },
    plugins: { "react-hooks": reactHooks, "react-refresh": reactRefresh },
    rules: {
      ...reactHooks.configs.flat.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      // React Hook Form names array fields by index (`variants.${index}.price`)
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
    },
  },
  {
    // shadcn's generated components (docs/18 §6): changed only through its
    // CLI, so its style stays; our rules apply to what we write around them
    files: ["src/ui/**"],
    rules: {
      "@typescript-eslint/consistent-type-definitions": "off",
      "@typescript-eslint/restrict-template-expressions": "off",
      "@typescript-eslint/no-confusing-void-expression": "off",
      "react-hooks/purity": "off",
      "react-refresh/only-export-components": "off",
      // The generated code's own idioms (any from recharts, `!= null`, `||`)
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unnecessary-condition": "off",
      "@typescript-eslint/no-unnecessary-type-assertion": "off",
      "@typescript-eslint/prefer-nullish-coalescing": "off",
      "@typescript-eslint/no-deprecated": "off",
      "@typescript-eslint/no-base-to-string": "off",
      eqeqeq: "off",
    },
  },
]
