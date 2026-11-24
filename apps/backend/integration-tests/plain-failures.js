// A failing assertion on an axios response, or a call left unanswered,
// carries axios' own objects out of the test (a response holds its request,
// which holds the response back). Jest's worker then dies on "Converting
// circular structure to JSON" and the failure itself is never shown. Every
// error leaves a test or hook here as a plain error with its text: the
// assertion's diff stays in the message; an axios error says which call
// failed and how.

const MAX_BODY = 500

function bodyText(data) {
  try {
    const text = typeof data === "string" ? data : JSON.stringify(data)
    return text.length > MAX_BODY ? `${text.slice(0, MAX_BODY)}…` : text
  } catch {
    return "(unreadable body)"
  }
}

function plainError(error) {
  if (!error || typeof error !== "object") {
    return error
  }
  if (error.isAxiosError) {
    const method = String(error.config?.method ?? "?").toUpperCase()
    const url = String(error.config?.url ?? "?")
    const outcome = error.response
      ? `${error.response.status} ${bodyText(error.response.data)}`
      : `${String(error.code)} ${String(error.message)}`
    const plain = new Error(`${method} ${url} failed: ${outcome}`)
    plain.stack = `${plain.message}\n${String(error.stack).split("\n").slice(1).join("\n")}`
    return plain
  }
  if ("matcherResult" in error) {
    const plain = new Error(error.message)
    plain.stack = error.stack
    return plain
  }
  return error
}

// A function that takes `done` keeps its own signature
const plainly = (fn) =>
  typeof fn !== "function" || fn.length > 0
    ? fn
    : async function (...args) {
        try {
          return await fn.apply(this, args)
        } catch (error) {
          throw plainError(error)
        }
      }

function wrapTest(original) {
  const wrapped = (name, fn, timeout) => original(name, plainly(fn), timeout)
  Object.assign(wrapped, original)
  wrapped.only = (name, fn, timeout) => original.only(name, plainly(fn), timeout)
  return wrapped
}

globalThis.it = wrapTest(globalThis.it)
globalThis.test = wrapTest(globalThis.test)
for (const hook of ["beforeAll", "beforeEach", "afterAll", "afterEach"]) {
  const original = globalThis[hook]
  globalThis[hook] = (fn, timeout) => original(plainly(fn), timeout)
}

// On CI a test that fails is tried once more before its file fails (adr/0081):
// a loaded runner must not cost a forty-minute run. The first failure stays in
// the log ("RETRY ERRORS"), and the job's summary counts them, so a test that
// needs its second try is seen and mended. Locally a failure is a failure.
if (process.env.CI) {
  // eslint-disable-next-line no-undef -- jest's own object, given to every setup file
  jest.retryTimes(1, { logErrorsBeforeRetry: true })
}
