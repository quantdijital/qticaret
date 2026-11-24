import { readFileSync, readdirSync } from "node:fs"
import { join, relative } from "node:path"

/**
 * Every module-level value that changes while the process runs either says
 * how a test forgets it (registerProcessCache, or a cache made by
 * createTtlCache/createVersionedCache) or is listed below with why it need
 * not. The HTTP suite runs several spec files on one boot
 * (integration-tests/bundle): an unregistered holder carries one file's
 * state into the next, which failed CI three times in a week (adr/0081).
 *
 * Read from the source: a `let` at the top of a module, or an empty
 * `new Map()`/`new Set()` there (a table built from values never changes).
 * A file that registers one holder counts as registered for all of them.
 */

const SRC = join(__dirname, "../../..")

const MODULE_STATE = [
  /^(export )?let \w+/,
  /^(export )?const \w+(: [^=]+)? = new (Map|Set)(<.+>)?\(\)$/,
]
const REGISTERED = /registerProcessCache|createTtlCache|createVersionedCache/

const ENV = "read once from the environment, which a bundled run does not change"
const IN_FLIGHT = "work in flight, back to nothing when it ends"
const ONCE = "said once a process: a log line, no behaviour"

/** Files whose module state is no request's: the same for every spec file. */
const NEED_NOT_FORGET: ReadonlyMap<string, string> = new Map([
  ["api/http/booking-store-routes.ts", ENV],
  ["api/http/challenge.ts", ENV],
  ["api/http/checkout-guard.ts", ENV],
  ["api/http/client-ip.ts", `${ENV}; and when it last warned (${ONCE})`],
  ["api/http/csrf.ts", ENV],
  ["api/http/fraud-routes.ts", ENV],
  ["api/http/mail-domain.ts", `${ENV} (off under NODE_ENV=test)`],
  ["api/http/reauth.ts", ENV],
  ["api/http/search-terms.ts", ENV],
  ["api/http/security-headers.ts", ENV],
  ["api/http/staff-guard.ts", ENV],
  ["lib/ai/scenes.ts", "the scene packs shipped with the code"],
  ["lib/control-plane/config.ts", `${ENV} (kept by its raw value)`],
  ["lib/control-plane/release.ts", "the release the process runs"],
  ["lib/fake-providers.ts", ONCE],
  ["lib/integrations/credential-keys.ts", `${ENV} (kept by its raw value)`],
  ["lib/logging/logger.ts", ONCE],
  ["lib/media/svg.ts", `a library loaded once; and ${IN_FLIGHT}`],
  ["lib/media/video/tools.ts", "the machine's ffmpeg"],
  ["lib/media/video/transcode.ts", "the machine's nice"],
  ["lib/search/normalize.ts", "character classes, the same for every input"],
  ["lib/security/upload/drain.ts", IN_FLIGHT],
  ["lib/staff/permissions.ts", "route patterns compiled from the code's own rules"],
  ["workflows/files/public-upload.ts", ENV],
  ["workflows/media/video/transcode.ts", IN_FLIGHT],
  ["workflows/search/drain.ts", IN_FLIGHT],
  ["workflows/seo/listing.ts", ONCE],
  ["workflows/seo/payload-sources.ts", ENV],
])

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      return entry.name === "__tests__" || entry.name === "node_modules" ? [] : sourceFiles(path)
    }
    return /\.[jt]sx?$/.test(entry.name) && !/\.(spec|test)\.[jt]sx?$/.test(entry.name)
      ? [path]
      : []
  })
}

/** Files with module state, by path under src, with whether they register. */
function census(): Map<string, boolean> {
  const found = new Map<string, boolean>()
  for (const file of sourceFiles(SRC)) {
    const text = readFileSync(file, "utf8")
    const lines = text.split("\n")
    if (lines.some((line) => MODULE_STATE.some((pattern) => pattern.test(line)))) {
      found.set(relative(SRC, file).split("\\").join("/"), REGISTERED.test(text))
    }
  }
  return found
}

describe("process state census (integration-tests/bundle, adr/0081)", () => {
  const found = census()

  it("finds module state at all (the scan reads the source)", () => {
    expect(found.get("lib/clients/failure-log.ts")).toBe(true)
    expect(found.get("lib/payments/paytr/client.ts")).toBe(true)
  })

  it("registers every holder of process state, or says why it need not", () => {
    const unregistered = [...found]
      .filter(([file, registered]) => !registered && !NEED_NOT_FORGET.has(file))
      .map(([file]) => file)
    // A file here: registerProcessCache(() => { held = undefined }) beside the
    // value (lib/cache/process-caches.ts), or a reason in NEED_NOT_FORGET
    expect(unregistered).toEqual([])
  })

  it("lists no file that has no unregistered state any more", () => {
    const stale = [...NEED_NOT_FORGET.keys()].filter((file) => found.get(file) !== false)
    expect(stale).toEqual([])
  })
})
