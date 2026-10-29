import { finding } from "./audit"
import type { AuditFinding, AuditItem } from "./audit"

/**
 * S-GSC-01 and S-CWV-01 (docs/14 §3.9, F10.11) as pure functions of what
 * the nightly insights job brought from Search Console and CrUX.
 */

export interface PageStat {
  /** The page's path on the storefront. */
  path: string
  clicks: number
  impressions: number
  ctr: number
  /** Clicks in the 28 days before. */
  prevClicks: number
}

export interface IndexState {
  path: string
  /** URL Inspection's verdict: PASS is in Google's index. */
  verdict: string
  coverageState: string | null
}

export interface FieldState {
  formFactor: "PHONE" | "DESKTOP"
  lcp: number | null
  inp: number | null
  cls: number | null
}

/** Google's "good" line for each Core Web Vital at p75 (docs/14 S-CWV-01). */
export const CWV_LIMITS = { lcp: 2500, inp: 200, cls: 0.1 } as const

/** A page counts as dropped from this many clicks, by this share. */
const DROP_MIN_CLICKS = 20
const DROP_SHARE = 0.3
/** Seen often, rarely chosen: worth a better title and description. */
const LOW_CTR_IMPRESSIONS = 500
const LOW_CTR = 0.01
/** Items a finding keeps to show; its count says how many there are. */
const SAMPLE = 20

const biggestFirst = (a: AuditItem, b: AuditItem) => (b.count ?? 0) - (a.count ?? 0)

/**
 * S-GSC-01: sitemap pages Google has not indexed, pages whose clicks fell
 * by 30% or more, and pages seen often but rarely clicked.
 */
export function searchConsoleFinding(facts: {
  pages: readonly PageStat[]
  inspections: readonly IndexState[]
}): AuditFinding | null {
  const notIndexed: AuditItem[] = facts.inspections
    .filter((each) => !["PASS", "VERDICT_UNSPECIFIED"].includes(each.verdict))
    .map((each) => ({
      reason: "not_indexed",
      subject: each.path,
      ...(each.coverageState ? { target: each.coverageState } : {}),
    }))
  const dropped: AuditItem[] = facts.pages
    .filter(
      (page) =>
        page.prevClicks >= DROP_MIN_CLICKS && page.clicks <= page.prevClicks * (1 - DROP_SHARE)
    )
    .map((page) => ({
      reason: "clicks_dropped",
      subject: page.path,
      count: page.prevClicks - page.clicks,
    }))
    .sort(biggestFirst)
  const lowCtr: AuditItem[] = facts.pages
    .filter((page) => page.impressions >= LOW_CTR_IMPRESSIONS && page.ctr < LOW_CTR)
    .map((page) => ({ reason: "low_ctr", subject: page.path, count: page.impressions }))
    .sort(biggestFirst)
  const all = [...notIndexed, ...dropped, ...lowCtr]
  return finding("S-GSC-01", all.slice(0, SAMPLE), all.length)
}

/** S-CWV-01: each form factor's p75 past Google's good line, metric by metric. */
export function coreWebVitalsFinding(states: readonly FieldState[]): AuditFinding | null {
  const items: AuditItem[] = states.flatMap((state) =>
    (["lcp", "inp", "cls"] as const).flatMap((metric) => {
      const value = state[metric]
      return value !== null && value > CWV_LIMITS[metric]
        ? [
            {
              reason: metric,
              subject: state.formFactor,
              target: metric === "cls" ? value.toFixed(2) : String(Math.round(value)),
            },
          ]
        : []
    })
  )
  return finding("S-CWV-01", items)
}
