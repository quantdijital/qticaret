// Based on dtc-starter@2.21.2 and docs.medusajs.com testing-tools (adr/0001).
// Imports utils through @medusajs/framework: pnpm does not expose @medusajs/utils.
const { loadEnv } = require("@medusajs/framework/utils")
loadEnv("test", process.cwd())

module.exports = {
  transform: {
    "^.+\\.[jt]s$": [
      "@swc/jest",
      {
        jsc: {
          parser: { syntax: "typescript", decorators: true },
        },
      },
    ],
  },
  testEnvironment: "node",
  moduleFileExtensions: ["js", "ts", "json"],
  modulePathIgnorePatterns: ["dist/", "<rootDir>/.medusa/"],
  setupFiles: ["./integration-tests/setup.js"],
}

// Each integration spec file boots Medusa and its heap is not all given
// back: one worker (not --runInBand, which ignores this) runs the files and
// is replaced once it holds more than this after a file
const INTEGRATION_WORKER_MEMORY = "1GB"

if (process.env.TEST_TYPE === "integration:http") {
  module.exports.testMatch = ["**/integration-tests/http/*.spec.[jt]s"]
  module.exports.workerIdleMemoryLimit = INTEGRATION_WORKER_MEMORY
} else if (process.env.TEST_TYPE === "integration:modules") {
  module.exports.testMatch = ["**/src/modules/*/__tests__/**/*.[jt]s"]
  module.exports.workerIdleMemoryLimit = INTEGRATION_WORKER_MEMORY
} else if (process.env.TEST_TYPE === "unit") {
  module.exports.testMatch = ["**/src/**/__tests__/**/*.unit.spec.[jt]s"]
}
