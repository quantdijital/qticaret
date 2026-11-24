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

// A failure leaves an integration test as a plain error, never with axios'
// circular objects that crash the worker and hide it (plain-failures.js)
const PLAIN_FAILURES = ["./integration-tests/plain-failures.js"]

if (process.env.TEST_TYPE === "integration:http") {
  // QT_IT_BUNDLE=<n>: n spec files share one Medusa boot; the bundles are
  // written here, before jest looks for tests (integration-tests/bundle/README.md)
  const bundles = require("./integration-tests/bundle").prepareBundles(process.env.QT_IT_BUNDLE)
  module.exports.testMatch = bundles?.testMatch ?? ["**/integration-tests/http/*.spec.[jt]s"]
  module.exports.workerIdleMemoryLimit = INTEGRATION_WORKER_MEMORY
  module.exports.setupFilesAfterEnv = PLAIN_FAILURES
  // Migrations run once per run, into a template database each spec file's
  // database is copied from (integration-tests/template/README.md)
  module.exports.globalSetup = "./integration-tests/template/global-setup.js"
} else if (process.env.TEST_TYPE === "integration:template") {
  // The one run that builds that template; started by its global setup only
  module.exports.testMatch = ["**/integration-tests/template/build-template.js"]
  module.exports.setupFilesAfterEnv = PLAIN_FAILURES
} else if (process.env.TEST_TYPE === "integration:modules") {
  module.exports.testMatch = ["**/src/modules/*/__tests__/**/*.[jt]s"]
  module.exports.workerIdleMemoryLimit = INTEGRATION_WORKER_MEMORY
  module.exports.setupFilesAfterEnv = PLAIN_FAILURES
} else if (process.env.TEST_TYPE === "unit") {
  module.exports.testMatch = [
    "**/src/**/__tests__/**/*.unit.spec.[jt]s",
    "**/integration-tests/bundle/__tests__/*.unit.spec.[jt]s",
  ]
}
