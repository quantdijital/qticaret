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
  // Ek C10: shops are set up by the fake provisioner (state in this process);
  // no test makes a database or starts a shop
  process.env.CP_PROVISIONER = "fake"
  process.env.CP_LOCAL_PG_ADMIN_URL = ""
  // No scheduled job runs while a file's tests do (src/jobs): on the clock
  // they would bill, push plan documents to and probe the test's own shops
  // between its steps (billing at :07, pushes every minute), a race the test
  // did not ask for. A test wanting a job's work calls its function. Medusa's
  // own switch (defineFileConfig's isDisabled), keyed by the path its job
  // loader reads each file from
  const { defineFileConfig } = require("@medusajs/framework/utils")
  const { readdirSync } = require("node:fs")
  const { join } = require("node:path")
  const jobs = join(__dirname, "..", "src", "jobs")
  for (const file of readdirSync(jobs)) {
    defineFileConfig({ path: join(jobs, file), isDisabled: () => true })
  }
}
