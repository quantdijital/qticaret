// Name of the migrated template database of the HTTP integration suite
// (README.md in this folder).
//
// The name carries a digest of everything that decides the schema: the
// modules' migration files, the link definitions, medusa-config.ts and the
// lockfile (Medusa's own migrations). A changed, added or removed migration
// gives another name, so a template built before it is never used.
const { createHash } = require("node:crypto")
const fs = require("node:fs")
const path = require("node:path")

const PREFIX = "qt-it-template-"
// Raised when the way the template is built changes
const BUILD_VERSION = "1"

const BACKEND = path.resolve(__dirname, "..", "..")
const SCHEMA_FILES = ["medusa-config.ts", path.join("..", "..", "pnpm-lock.yaml")]

function filesUnder(directory) {
  if (!fs.existsSync(directory)) {
    return []
  }
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name)
    return entry.isDirectory() ? filesUnder(full) : [full]
  })
}

function schemaFiles() {
  const migrations = filesUnder(path.join(BACKEND, "src", "modules")).filter((file) =>
    file.split(path.sep).includes("migrations")
  )
  const links = filesUnder(path.join(BACKEND, "src", "links"))
  const single = SCHEMA_FILES.map((file) => path.join(BACKEND, file)).filter((file) =>
    fs.existsSync(file)
  )
  return [...migrations, ...links, ...single].sort()
}

function templateName() {
  const digest = createHash("sha256")
  digest.update(`${BUILD_VERSION}\n${process.env.QT_IT_TEMPLATE_SALT ?? ""}\n`)
  for (const file of schemaFiles()) {
    digest.update(`${path.relative(BACKEND, file)}\n`)
    digest.update(fs.readFileSync(file))
    digest.update("\n")
  }
  return `${PREFIX}${digest.digest("hex").slice(0, 16)}`
}

module.exports = { templateName, PREFIX }
