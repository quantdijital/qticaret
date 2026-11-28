/**
 * Releases and the version a shop runs (adr/0061 F17.5, Ek C18), pure.
 *
 * - a release's version is strict semver (no leading zeros, an optional
 *   pre-release, no build metadata): a subset of what the shops' usage
 *   report may carry, so every release can be matched against a report
 * - its commit is lowercase hex, 7 to 40 characters, as the report's
 * - a shop runs a release when its latest report has the same version and
 *   commits that agree (one a prefix of the other: a short and a full hash
 *   of one commit are the same build)
 */

export const RELEASE_VERSION =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/
export const RELEASE_VERSION_MAX = 64
export const RELEASE_COMMIT = /^[0-9a-f]{7,40}$/
export const RELEASE_NOTES_MAX = 2000
/** What a target change's reason may be: as billing's (Ek C16). */
export const TARGET_REASON_MIN = 3
export const TARGET_REASON_MAX = 500

export interface ReleaseRef {
  version: string
  commit: string
}

/** Whether two commits name one build: equal, or one a prefix of the other (7 or more). */
export function sameCommit(a: string, b: string): boolean {
  const left = a.toLowerCase()
  const right = b.toLowerCase()
  if (left.length < 7 || right.length < 7) {
    return false
  }
  return left.startsWith(right) || right.startsWith(left)
}

/** Whether a reported release is this one. */
export const sameRelease = (reported: ReleaseRef, release: ReleaseRef): boolean =>
  reported.version === release.version && sameCommit(reported.commit, release.commit)

/**
 * Whether a shop runs its target: null when it cannot be told (no target
 * set, or no report yet), else whether the latest report is the target.
 */
export function matchesTarget(reported: ReleaseRef | null, target: ReleaseRef | null) {
  return reported && target ? sameRelease(reported, target) : null
}

/** A shop drifts when it has a target and a report, and the two differ. */
export const drifts = (reported: ReleaseRef | null, target: ReleaseRef | null): boolean =>
  matchesTarget(reported, target) === false

/**
 * Semver precedence (semver.org §11) of two strict versions: negative when
 * `a` comes first, 0 when equal, positive after. A pre-release comes
 * before its release; numeric identifiers compare as numbers, before any
 * text one. Audit 3.1 orders a shop's target against the control plane
 * with it (adr/0061 Ek C21: the control plane first).
 */
export function compareVersions(a: string, b: string): number {
  const split = (version: string) => {
    const [core = "", pre] = version.split(/-(.*)/s)
    return { core: core.split(".").map(Number), pre: pre ? pre.split(".") : [] }
  }
  const left = split(a)
  const right = split(b)
  for (let i = 0; i < 3; i++) {
    const diff = (left.core[i] ?? 0) - (right.core[i] ?? 0)
    if (diff !== 0) {
      return Math.sign(diff)
    }
  }
  if (left.pre.length === 0 || right.pre.length === 0) {
    return Math.sign(right.pre.length - left.pre.length)
  }
  for (let i = 0; i < Math.max(left.pre.length, right.pre.length); i++) {
    const x = left.pre[i]
    const y = right.pre[i]
    if (x === undefined || y === undefined) {
      return x === undefined ? -1 : 1
    }
    const xn = /^\d+$/.test(x)
    const yn = /^\d+$/.test(y)
    if (xn && yn && Number(x) !== Number(y)) {
      return Math.sign(Number(x) - Number(y))
    }
    if (xn !== yn) {
      return xn ? -1 : 1
    }
    if (x !== y) {
      return x < y ? -1 : 1
    }
  }
  return 0
}
