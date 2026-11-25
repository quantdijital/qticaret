// On CI a failed test is tried once more before its file fails (adr/0081), as
// the backend's suites are (apps/backend/integration-tests/plain-failures.js):
// a loaded runner must not cost a whole run. The first failure stays in the
// log ("RETRY ERRORS") and the job's summary names it ("Tried twice"), so a
// test that needs its second try is seen and mended. Locally a failure is a
// failure.
//
// Never where failing now and then IS the finding: money (billing, the
// wallet, credits, invoices), races and idempotent deliveries, and any file
// that sends requests side by side (`Promise.all`). A second try there would
// turn a one-in-five double charge into one in twenty-five and call the rest
// green. Known by the file's name and source; a file that cannot be read is
// not retried either.
const fs = require("node:fs")
const path = require("node:path")

const MONEY_OR_RACE = /(race|idempot|billing|wallet|credit|payment|invoice|ledger|refund)/
const SIDE_BY_SIDE = /Promise\.all(Settled)?\(/

/** Whether a spec file, by its name and source text, may be tried twice. */
function retriableSource(name, source) {
  return !MONEY_OR_RACE.test(name) && !SIDE_BY_SIDE.test(source)
}

function retriable(testPath) {
  try {
    return retriableSource(path.basename(testPath), fs.readFileSync(testPath, "utf8"))
  } catch {
    return false
  }
}

// eslint-disable-next-line no-undef -- jest's own objects, given to every setup file
if (process.env.CI && retriable(String(expect.getState().testPath ?? ""))) {
  // eslint-disable-next-line no-undef -- jest's own object, given to every setup file
  jest.retryTimes(1, { logErrorsBeforeRetry: true })
}
