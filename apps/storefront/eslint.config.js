import nextPlugin from "@next/eslint-plugin-next"
import { baseConfig } from "@qticaret/config/eslint"
import reactHooks from "eslint-plugin-react-hooks"
import globals from "globals"

export default [
  ...baseConfig(import.meta.dirname),
  { ignores: [".next/**", "next-env.d.ts"] },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    plugins: { "@next/next": nextPlugin, "react-hooks": reactHooks },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      ...reactHooks.configs.flat.recommended.rules,
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
    },
  },
]
