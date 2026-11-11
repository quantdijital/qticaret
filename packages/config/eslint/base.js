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
    },
    {
      // adr/0061 Ek C8 (review L4): the age library and the test-only escrow
      // opener stay out of application code, so nothing but a test can ever
      // open an escrow. Allowed: tests, and the one module that seals with it
      ignores: [...TEST_FILES, "**/src/crypto/escrow.ts", "**/src/testing/**", "**/jest.age.cjs"],
      rules: {
        "no-restricted-imports": ["error", { patterns: [TEST_ONLY_IMPORTS] }],
        "no-restricted-syntax": [
          "error",
          {
            selector: `CallExpression[callee.name='require'][arguments.0.value=${TEST_ONLY_REQUIRE}]`,
            message: TEST_ONLY_IMPORTS.message,
          },
        ],
      },
    }
  )
}

const TEST_FILES = [
  "**/*.spec.*",
  "**/*.test.*",
  "**/__tests__/**",
  "**/integration-tests/**",
  "**/e2e/**",
  "**/src/test/**",
]

const TEST_ONLY_IMPORTS = {
  group: [
    "age-encryption",
    "age-encryption/*",
    "@qticaret/server-kit/testing/*",
    // adr/0061 Ek C9 (review L1): the contract's test-only keys and vectors
    "@qticaret/types/control-plane/testing",
  ],
  message:
    "Test-only: the escrow is opened by the offline identity alone (adr/0061 Ek C8), and the contract's test keys sign nothing real (Ek C9). Seal with @qticaret/server-kit/escrow.",
}

const TEST_ONLY_REQUIRE =
  "/^(age-encryption|@qticaret\\/server-kit\\/testing\\/|@qticaret\\/types\\/control-plane\\/testing)/"
