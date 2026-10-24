// Shared ESLint flat config. Usage in a package:
//   import { baseConfig } from "@qticaret/config/eslint"
//   export default baseConfig(import.meta.dirname)
import js from "@eslint/js"
import { defineConfig } from "eslint/config"
import globals from "globals"
import tseslint from "typescript-eslint"

/**
 * @param {string} tsconfigRootDir absolute path of the package using this config
 */
export function baseConfig(tsconfigRootDir) {
  return defineConfig(
    {
      ignores: ["**/dist/**", "**/coverage/**", "**/.turbo/**", "**/.medusa/**"],
    },
    js.configs.recommended,
    tseslint.configs.strictTypeChecked,
    tseslint.configs.stylisticTypeChecked,
    {
      languageOptions: {
        globals: globals.node,
        parserOptions: {
          projectService: { allowDefaultProject: ["*.js", "*.mjs"] },
          tsconfigRootDir,
        },
      },
      rules: {
        // docs/10: `any` is forbidden; narrow from `unknown` instead
        "@typescript-eslint/no-explicit-any": "error",
        "@typescript-eslint/consistent-type-imports": "error",
        "@typescript-eslint/switch-exhaustiveness-check": "error",
        "@typescript-eslint/no-floating-promises": "error",
        "@typescript-eslint/no-misused-promises": "error",
        // docs/10: never swallow errors silently
        "no-empty": ["error", { allowEmptyCatch: false }],
        // docs/10: structured logger only, never console
        "no-console": "error",
        eqeqeq: ["error", "always"],
      },
    },
    {
      files: ["**/*.js", "**/*.mjs", "**/*.cjs"],
      extends: [tseslint.configs.disableTypeChecked],
    }
  )
}
