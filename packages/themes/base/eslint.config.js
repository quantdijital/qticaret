import { baseConfig } from "@qticaret/config/eslint"
import reactHooks from "eslint-plugin-react-hooks"
import globals from "globals"

export default [
  ...baseConfig(import.meta.dirname),
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: { globals: globals.browser },
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.flat.recommended.rules,
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
    },
  },
]
