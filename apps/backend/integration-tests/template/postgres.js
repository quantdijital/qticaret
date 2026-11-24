// Postgres calls of the template database (README.md in this folder). The
// connection is the one Medusa's test runner uses for creating databases:
// DB_HOST, DB_PORT, DB_USERNAME and DB_PASSWORD, on the `postgres` database.
const { Client } = require("@medusajs/framework/pg")

const DUPLICATE_DATABASE = "42P04"
const OBJECT_IN_USE = "55006"
const COPY_ATTEMPTS = 3
// Any 64-bit number: one run at a time builds or removes templates
const LOCK_KEY = 7_420_250_118

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function quoted(identifier) {
  return `"${String(identifier).replace(/"/g, '""')}"`
}

async function withAdminClient(work) {
  const client = new Client({
    host: process.env.DB_HOST ?? "localhost",
    port: parseInt(process.env.DB_PORT ?? "5432"),
    user: process.env.DB_USERNAME ?? "postgres",
    password: process.env.DB_PASSWORD || undefined,
    database: process.env.DB_WAITINGROOM_DATABASE ?? "postgres",
    connectionTimeoutMillis: 5_000,
  })
  await client.connect()
  try {
    return await work(client)
  } finally {
    await client.end().catch(() => undefined)
  }
}

// Held by the session until `work` ends, so two runs on one Postgres (two
// worktrees, say) never build the same template at once
async function withTemplateLock(client, work) {
  await client.query("SELECT pg_advisory_lock($1)", [LOCK_KEY])
  try {
    return await work()
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [LOCK_KEY]).catch(() => undefined)
  }
}

async function databaseExists(client, name) {
  const { rowCount } = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [name])
  return rowCount > 0
}

async function dropDatabase(client, name) {
  await client.query(`DROP DATABASE IF EXISTS ${quoted(name)} WITH (FORCE)`)
}

// `CREATE DATABASE … TEMPLATE` is all or nothing. It refuses while a session
// is on the template (an autovacuum worker, say): tried again a few times.
// An existing database is left as it is and reported as not copied.
async function copyDatabase(client, { from, to }) {
  for (let attempt = 1; ; attempt++) {
    try {
      await client.query(`CREATE DATABASE ${quoted(to)} TEMPLATE ${quoted(from)}`)
      return true
    } catch (error) {
      if (error?.code === DUPLICATE_DATABASE) {
        return false
      }
      if (error?.code !== OBJECT_IN_USE || attempt >= COPY_ATTEMPTS) {
        throw error
      }
      await sleep(200 * attempt)
    }
  }
}

module.exports = {
  withAdminClient,
  withTemplateLock,
  databaseExists,
  dropDatabase,
  copyDatabase,
  quoted,
}
