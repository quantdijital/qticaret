// Builds the migrated template database (README.md in this folder). Run by
// global-setup.js as a jest run of its own (TEST_TYPE=integration:template),
// never as part of a suite.
//
// Medusa's runner creates and migrates a database and starts the app, as it
// does for every spec file. Before the first test it takes its own snapshot
// of that database (`<dbName>-template`), which no session is connected to:
// the one test here copies that snapshot under the name global-setup.js
// asked for. No test has written anything by then.
/* global jest, it, expect */
const { medusaIntegrationTestRunner } = require("@medusajs/test-utils")
const { copyDatabase, withAdminClient } = require("./postgres")

jest.setTimeout(600 * 1000)

const target = process.env.QT_IT_TEMPLATE_BUILD

medusaIntegrationTestRunner({
  testSuite: ({ dbConfig }) => {
    it("copies the migrated database before any test writes to it", async () => {
      if (!target) {
        throw new Error("QT_IT_TEMPLATE_BUILD is not set")
      }
      const copied = await withAdminClient((client) =>
        copyDatabase(client, { from: `${dbConfig.dbName}-template`, to: target })
      )
      expect(copied).toBe(true)
    })
  },
})
