import { baseConfig } from "@qticaret/config/eslint"

export default [
  ...baseConfig(import.meta.dirname),
  {
    // The Jest config is CommonJS, as Jest loads it
    files: ["**/*.js"],
    languageOptions: { sourceType: "commonjs" },
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
]
