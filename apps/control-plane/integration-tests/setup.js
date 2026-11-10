const { MetadataStorage } = require("@medusajs/framework/mikro-orm/core")

MetadataStorage.clear()

if (process.env.TEST_TYPE?.startsWith("integration")) {
  // Per-IP limits a hundred times larger under NODE_ENV=test only
  // (perIpScale in @qticaret/server-kit): every call comes from 127.0.0.1
  process.env.RATE_LIMIT_RELAXED = "1"
  // Each test file counts its limits under a Redis namespace of its own
  process.env.QT_TEST_RUN = require("node:crypto").randomUUID().slice(0, 8)
  // `localhost` as 127.0.0.1 first: a connect to [::1]:55432 can meet itself
  // in macOS's ephemeral port range and hang (apps/backend/integration-tests/
  // database.js, which also retries such connects; this suite opens few)
  require("node:dns").setDefaultResultOrder("ipv4first")
  // No test mail reaches a developer's Mailpit: an invitation's link is read
  // from the answer (C4). Blank, not deleted: loading the env file again
  // never overrides a set variable, and the schema reads blank as unset
  for (const name of ["EMAIL_TRANSPORT", "MAILPIT_URL", "EMAIL_FROM"]) {
    process.env[name] = ""
  }
}
