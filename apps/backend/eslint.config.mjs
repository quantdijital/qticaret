import { baseConfig } from "@qticaret/config/eslint"

export default [
  ...baseConfig(import.meta.dirname),
  {
    // Plain .js files here (jest config, test setup) are CommonJS, as Medusa expects
    files: ["**/*.js"],
    languageOptions: { sourceType: "commonjs" },
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
]
