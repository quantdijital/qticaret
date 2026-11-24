// Jest globalSetup of the HTTP integration suite: makes sure the migrated
// template database exists, once per run and before any worker starts
// (README.md in this folder).
//
// The name of a usable template is handed to the workers in QT_IT_TEMPLATE.
// It stays unset when the template is switched off or cannot be built: every
// spec file then migrates its own database, as before.
const { spawn } = require("node:child_process")
const path = require("node:path")
const { templateName, PREFIX } = require("./name")
const {
  withAdminClient,
  withTemplateLock,
  databaseExists,
  dropDatabase,
  quoted,
} = require("./postgres")

const BACKEND = path.resolve(__dirname, "..", "..")
const BUILD_TIMEOUT_MS = 15 * 60 * 1000
const KEPT_OUTPUT = 20_000
// Templates of other schemas (another branch's migrations) stay this long
const STALE_AFTER_MS = 3 * 24 * 60 * 60 * 1000

const say = (message) => process.stderr.write(`[template] ${message}\n`)

// The builder is a jest run of its own: Medusa boots once per process
function runBuilder(buildName) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        require.resolve("jest/bin/jest"),
        "--maxWorkers=1",
        "--forceExit",
        "integration-tests/template/build-template.js",
      ],
      {
        cwd: BACKEND,
        env: {
          ...process.env,
          TEST_TYPE: "integration:template",
          QT_IT_TEMPLATE_BUILD: buildName,
        },
        stdio: ["ignore", "pipe", "pipe"],
      }
    )
    let output = ""
    const keep = (chunk) => {
      output = (output + String(chunk)).slice(-KEPT_OUTPUT)
    }
    child.stdout.on("data", keep)
    child.stderr.on("data", keep)
    const timer = setTimeout(() => child.kill("SIGKILL"), BUILD_TIMEOUT_MS)
    child.on("error", reject)
    child.on("close", (code) => {
      clearTimeout(timer)
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`the builder ended with ${String(code)}:\n${output}`))
      }
    })
  })
}

// Half-built templates and templates of other schemas that are old. One of
// another branch's run in progress is young and is left alone.
async function removeLeftovers(client, current) {
  const { rows } = await client.query(
    `SELECT datname AS name, shobj_description(oid, 'pg_database') AS built
       FROM pg_database WHERE datname LIKE $1`,
    [`${PREFIX}%`]
  )
  for (const { name, built } of rows) {
    const age = Date.now() - Date.parse(built ?? "")
    if (name !== current && !(age < STALE_AFTER_MS)) {
      await dropDatabase(client, name)
    }
  }
}

async function ensureTemplate(name) {
  return withAdminClient(async (client) => {
    // Asked again under the lock: another run may be building it right now
    if (await databaseExists(client, name)) {
      return "reused"
    }
    return withTemplateLock(client, async () => {
      if (await databaseExists(client, name)) {
        return "reused"
      }
      const buildName = `${name}-build`
      await dropDatabase(client, buildName)
      await runBuilder(buildName)
      // No session may sit on a template while it is copied (the copy would
      // fail), and nothing may write to it: it takes no connections at all
      await client.query(`ALTER DATABASE ${quoted(buildName)} WITH ALLOW_CONNECTIONS false`)
      await client.query(
        `COMMENT ON DATABASE ${quoted(buildName)} IS '${new Date().toISOString()}'`
      )
      // The rename is what makes the template exist: a build that failed
      // half way leaves nothing under the name the workers copy from
      await client.query(`ALTER DATABASE ${quoted(buildName)} RENAME TO ${quoted(name)}`)
      await removeLeftovers(client, name).catch(() => undefined)
      return "built"
    })
  })
}

module.exports = async function globalSetup() {
  delete process.env.QT_IT_TEMPLATE
  if (process.env.TEST_TYPE !== "integration:http" || process.env.QT_IT_TEMPLATE_MODE === "off") {
    return
  }
  const started = Date.now()
  try {
    const name = templateName()
    const outcome = await ensureTemplate(name)
    process.env.QT_IT_TEMPLATE = name
    say(`${outcome} ${name} in ${((Date.now() - started) / 1000).toFixed(1)} s`)
  } catch (error) {
    say(`no template, every file migrates its own database: ${String(error?.message ?? error)}`)
  }
}
