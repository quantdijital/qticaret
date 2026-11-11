// As apps/backend/jest.config.js (dtc-starter@2.21.2, adr/0001)
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
  // age-encryption (escrow, Ek C8) ships ES modules only, which Jest with
  // --experimental-vm-modules refuses to require: Node loads it (require(esm))
  moduleNameMapper: {
    "^age-encryption$": "<rootDir>/../../packages/server-kit/jest.age.cjs",
  },
  testEnvironment: "node",
  moduleFileExtensions: ["js", "ts", "json"],
  modulePathIgnorePatterns: ["dist/", "<rootDir>/.medusa/"],
  setupFiles: ["./integration-tests/setup.js"],
}

if (process.env.TEST_TYPE === "integration:http") {
  module.exports.testMatch = ["**/integration-tests/http/*.spec.[jt]s"]
  module.exports.workerIdleMemoryLimit = "1GB"
} else if (process.env.TEST_TYPE === "unit") {
  module.exports.testMatch = ["**/src/**/__tests__/**/*.unit.spec.[jt]s"]
}
