# Template database of the HTTP integration suite

Each HTTP spec file boots Medusa on a database of its own. Migrating that
database from nothing (about 365 migrations, 44 link tables) was most of a
file's start-up. The migrations now run once per run, into a **template
database**; every file's database is a copy of it (`CREATE DATABASE … TEMPLATE`).

Nothing in `node_modules` is changed: only public options of
`medusaIntegrationTestRunner` are used (`dbName`, `hooks.beforeServerStart`).

## How it works

1. **`global-setup.js`** (jest `globalSetup`, `TEST_TYPE=integration:http`
   only) runs once, before any worker. It works out the template's name
   (`name.js`) and, if no database has that name, builds it under a Postgres
   advisory lock. The name goes to the workers in `QT_IT_TEMPLATE`.
2. **Building** is a jest run of its own (`TEST_TYPE=integration:template`,
   `build-template.js`): Medusa's runner migrates a database and starts the app
   exactly as it does for a spec file, takes its own snapshot before the first
   test, and the one test copies that snapshot. The copy is renamed to the
   template's name only after the run succeeded, so a half-built template never
   has the name.
3. **`runner.js`** (installed from `setup.js` with `jest.mock`) wraps
   `medusaIntegrationTestRunner`: in `beforeServerStart`, just before the runner
   creates its database, the database is created as a copy of the template. The
   runner treats an existing database as created, and its migrations, link sync
   and search index plan find nothing to do.

The runner's migration steps still run on the copy. A migration the template
lacks is therefore applied all the same; the template only saves work, it
never decides the schema.

## What the template holds

The state a spec file has always had before its first test: the schema, the
migration records and what the app writes when it starts (currencies,
countries, the default store and sales channel, provider rows). No test has
written to it.

## When it is rebuilt

The name ends in a digest of the modules' migration files, `src/links`,
`medusa-config.ts` and `pnpm-lock.yaml`. Any change gives another name and so
a new template. Locally a template is reused between runs; templates of other
digests are removed once they are three days old. In CI each shard has its own
Postgres and builds the template once.

## When it is not used

Every failure falls back to the old way, each file migrating its own database,
with a line starting `[template]` in the output:

- the template cannot be built (global setup says why, with the builder's output),
- copying fails for a file (that file alone migrates),
- `QT_IT_TEMPLATE_MODE=off` switches it off for a run.

`QT_IT_TEMPLATE_SALT=<anything>` forces a template of another name, for trying
a rebuild. To remove a template by hand: `DROP DATABASE "qt-it-template-…"`.
A template takes no connections (`ALLOW_CONNECTIONS false`), so that no open
session can make a copy fail; to look inside one, copy it first.

The module suite (`test:integration:modules`) does not use any of this.
