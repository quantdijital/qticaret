# Bundles of the HTTP integration suite

Each HTTP spec file boots Medusa (`medusaIntegrationTestRunner`), and the boot
is most of a file's time: the tests themselves are short. With
`QT_IT_BUNDLE=<n>` set, **n spec files share one boot**: a generated _bundle_
file loads them and runs every file's `testSuite` under one runner. Measured
locally (one worker, the same six files): 246 s one by one, 104 s as one
bundle, every test passing (adr/0081, Ek).

Unset (the default, and how a single file is run locally) nothing changes:
jest runs `integration-tests/http/*.spec.ts` one file at a time. CI turns it
on for the HTTP jobs (`.github/workflows/ci.yml`).

## How it works

1. **Planning** (`plan.js`, called from `jest.config.js` through `index.js`):
   the spec files in name order, split in two classes by the retry rule
   (`classify.js`, shared with `plain-failures.js`): **plain** files (a failed
   test is tried once more on CI) and **strict** ones (money, stock, races,
   `Promise.all`: never). Each class is cut into bundles of n files. Same
   checkout, same bundles: every `--shard` job plans alike.
2. **Writing**: `integration-tests/.bundles/bundle-<plain|strict>-NNN.spec.js`
   (gitignored), rewritten each run; the folder ends up holding exactly this
   run's bundles. `testMatch` then names the bundles and the files that run
   alone, so a bundled file never runs a second time on its own.
3. **Hosting** (`host.js`): the bundle loads its files with
   `@medusajs/test-utils` mocked, collecting each file's runner call; then one
   real runner (on the template database, `../template/README.md`) runs each
   file's suite in `describe("<file name>")`. Between files:
   - the database goes back to the state Medusa booted into, before the next
     file's own `beforeAll`; the runner's per-test snapshot is taken again at
     the file's first test, so a file sees exactly what it saw alone;
   - what the app holds in process is forgotten with it
     (`src/lib/cache/process-caches.ts`): every TTL and versioned cache,
     the provider clients built from a `*_BASE_URL` (and their circuit
     breakers), the integration health monitor, rate limit counters and the
     staff and editor session stores kept in memory (no Redis in CI). Each
     registers how it forgets, under NODE_ENV=test only;
   - spies are restored (`jest.restoreAllMocks`) and real timers put back;
   - a file's `jest.setTimeout` is kept: its tests and hooks get it as their
     timeout. Medusa's boot and the runner's own hooks wait as long as the
     slowest file of the bundle allows.

A bundle's class is in its name: `plain-failures.js` retries a plain bundle
and never a strict one. "Tried twice" in the CI summary names the test with
its file (`<file name> › <test>`).

## Files that run alone

Not bundled, read from the source (`soloReasonOf` in `plan.js`):

- the runner is given options besides `testSuite`, or is not called exactly
  once at module level;
- `jest.mock` (and `doMock`, `isolateModules`, …) anywhere;
- `process.env` written, fake timers turned on, spies made, or hooks and
  tests declared at module level;
- a step or workflow id another spec file defines too.

And every file listed in **`solo.txt`**, one a line, `#` and the reason. The
run's first line says how many bundles and files alone there are.

## When a file fails in a bundle and passes alone

It shares something in process with another file of its bundle that is not
forgotten between files: a module-level variable (a client, a store, a map)
not registered with `registerProcessCache`, a spy or a timer, or work still
running after its last test. Find the other file (`[bundle] bundle-…: a, b, c`
names a bundle's files, in order), then either register the holder (one call
next to it, as `lib/payments/paytr/client.ts` does) or add the file to
`solo.txt` with the reason. A failing boot fails every file of its bundle; the error
names them.

## Switching it off

- for a run: `QT_IT_BUNDLE=off` (or unset);
- in CI: remove `QT_IT_BUNDLE` from the integration job in `ci.yml`.

Locally, to run one file: leave `QT_IT_BUNDLE` unset and name the file as
before (`pnpm --filter @qticaret/backend test:integration:http <file>`).
