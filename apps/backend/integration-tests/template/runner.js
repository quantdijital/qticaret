// Gives each HTTP spec file a database copied from the migrated template
// (README.md in this folder) through the runner's public options only.
//
// Medusa's runner creates its database with "an existing one is fine" and
// then migrates it. `hooks.beforeServerStart` runs just before that: the
// database is created there as a copy of the template, so the runner finds
// it and its migrations, link sync and search index plan have nothing left
// to do. Whatever goes wrong here is a warning: the runner then creates an
// empty database and migrates it in full, as it did before.
const { randomUUID } = require("node:crypto")
const { withAdminClient, copyDatabase } = require("./postgres")

function warn(message) {
  process.stderr.write(`[template] ${message}; this file migrates its own database\n`)
}

async function copyTemplate(template, dbName) {
  try {
    const copied = await withAdminClient((client) =>
      copyDatabase(client, { from: template, to: dbName })
    )
    if (!copied) {
      warn(`database ${dbName} exists already`)
    }
  } catch (error) {
    warn(`copying ${template} failed (${String(error?.message ?? error)})`)
  }
}

function withTemplate(runner, template) {
  return (options = {}) => {
    // Only the default schema is in the template
    if (options.schema && options.schema !== "public") {
      return runner(options)
    }
    // The runner's own naming, with the name known here
    const dbName =
      options.dbName ??
      `medusa-${randomUUID().replace(/-/g, "")}-integration-${process.env.JEST_WORKER_ID || "1"}`
    const hooks = options.hooks ?? {}
    return runner({
      ...options,
      dbName,
      hooks: {
        ...hooks,
        beforeServerStart: async (container) => {
          await hooks.beforeServerStart?.(container)
          await copyTemplate(template, dbName)
        },
      },
    })
  }
}

// Called from setup.js, before the spec file imports @medusajs/test-utils
function useTemplateDatabase(jestObject) {
  const template = process.env.QT_IT_TEMPLATE
  if (process.env.TEST_TYPE !== "integration:http" || !template) {
    return
  }
  jestObject.mock("@medusajs/test-utils", () => {
    const actual = jestObject.requireActual("@medusajs/test-utils")
    return {
      ...actual,
      medusaIntegrationTestRunner: withTemplate(actual.medusaIntegrationTestRunner, template),
    }
  })
}

module.exports = { useTemplateDatabase, withTemplate }
