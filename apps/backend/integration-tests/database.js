// Postgres connections of an integration test file (docs/07).
//
// The test database is `localhost:55432` (Docker publishes it on 127.0.0.1
// only). Node resolves `localhost` to ::1 first and tries [::1]:55432 before
// 127.0.0.1. Nothing listens there, and 55432 lies in macOS's ephemeral port
// range (49152-65535): about once in 16,000 connects the system gives the
// socket local port 55432 itself and TCP connects the socket to itself
// ([::1]:55432 -> [::1]:55432). pg reads its own startup message back and
// waits for ever. A test file opens hundreds of connections (each module
// migrates with one of its own; each test's restore from the template ends
// every session), so a run hit it once or twice: a module's migration waited
// knex's 30 s, failed, and every test of that file failed at about 36 s.
//
// - IPv4 first: `localhost` is tried as 127.0.0.1, where Postgres listens,
//   so no connect goes to ::1 at all.
// - A connect still unanswered after CONNECT_TIMEOUT_MS is dropped and opened
//   again, in each module's migration pool too (Medusa's shared pool already
//   does so), so one lost connect costs seconds, not a test file. Medusa's
//   test runner replaces `projectConfig.databaseDriverOptions` with `{}` for
//   a localhost database, so medusa-config.ts cannot set this: it is added to
//   the config the runner hands Medusa.
const dns = require("node:dns")

const CONNECT_TIMEOUT_MS = 5_000

function withRetriedConnects(configModule) {
  const project = configModule?.projectConfig
  if (!project) {
    return
  }
  const driver = project.databaseDriverOptions ?? {}
  project.databaseDriverOptions = {
    ...driver,
    connection: { connectionTimeoutMillis: CONNECT_TIMEOUT_MS, ...driver.connection },
    pool: { propagateCreateError: false, ...driver.pool },
  }
}

function setUpTestDatabaseConnections() {
  dns.setDefaultResultOrder("ipv4first")
  const { configManager } = require("@medusajs/framework/config")
  const loadConfig = configManager.loadConfig.bind(configManager)
  configManager.loadConfig = (options) => {
    withRetriedConnects(options?.projectConfig)
    return loadConfig(options)
  }
}

module.exports = { setUpTestDatabaseConnections, withRetriedConnects, CONNECT_TIMEOUT_MS }
