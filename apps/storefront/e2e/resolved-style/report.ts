import { groupChanges, isSame, subtreeRoots } from "./diff.ts"
import type { CaptureDiff, ElementRef } from "./diff.ts"
import type { SkippedEntry } from "./types.ts"

/**
 * The difference report, in Turkish: it is pasted into the PR body
 * ("yalnız taşıma; çözülmüş stil N/N aynı", adr/0067 §3).
 */

export interface FolderComparison {
  diffs: CaptureDiff[]
  /** Captures only one folder has (a page or state the other skipped or did not run). */
  onlyBefore: string[]
  onlyAfter: string[]
  skippedBefore: SkippedEntry[]
  skippedAfter: SkippedEntry[]
}

export interface ReportOptions {
  /** Elements listed under each change; the rest are counted. */
  limit: number
  /** Whole keys instead of their section and last steps. */
  fullKeys: boolean
  tolerance: number
}

/** A key short enough to read: its anchor (section or body) and its last three steps. */
export function shortKey(key: string, full: boolean): string {
  const steps = key.split(" > ")
  if (full || steps.length <= 4) {
    return key
  }
  return [steps[0], "…", ...steps.slice(-3)].join(" > ")
}

function element(ref: ElementRef, options: ReportOptions): string {
  const text = ref.text ? `  «${ref.text}»` : ""
  return `${shortKey(ref.key, options.fullKeys)}${text}`
}

function title(diff: CaptureDiff): string {
  const state = diff.state === "load" ? "" : `, durum ${diff.state}`
  return `${diff.page} (${diff.path}) ${diff.width} px${state}`
}

function listed<T>(items: T[], limit: number, line: (item: T) => string): string[] {
  const shown = items.slice(0, limit).map((item) => `      ${line(item)}`)
  if (items.length > limit) {
    shown.push(`      … ${items.length - limit} öğe daha`)
  }
  return shown
}

function skippedLine(each: SkippedEntry): string {
  return `  ${each.page} ${each.width} px, durum ${each.state}: ${each.reason}`
}

export function formatReport(comparison: FolderComparison, options: ReportOptions): string {
  const { diffs, onlyBefore, onlyAfter } = comparison
  const lines: string[] = []
  const same = diffs.filter(isSame).length
  const total = diffs.length + onlyBefore.length + onlyAfter.length

  for (const diff of diffs.filter((each) => !isSame(each))) {
    lines.push("", `## ${title(diff)}  [${diff.file}]`)
    const groups = groupChanges(diff.changed)
    if (groups.length > 0) {
      lines.push(`  Stil farkı: ${diff.changed.length} öğe`)
      for (const { change, elements } of groups) {
        lines.push(
          `    ${change.prop}: ${change.before} → ${change.after}  (${elements.length} öğe)`
        )
        lines.push(...listed(elements, options.limit, (ref) => element(ref, options)))
      }
    }
    for (const [label, refs] of [
      ["Yapı: eklenen öğe", diff.added],
      ["Yapı: silinen öğe", diff.removed],
    ] as const) {
      if (refs.length === 0) {
        continue
      }
      const roots = subtreeRoots(refs)
      lines.push(`  ${label}: ${refs.length} (${roots.length} kök)`)
      lines.push(
        ...listed(roots, options.limit, ({ ref, inside }) => {
          const under = inside > 0 ? `  (+${inside} alt öğe)` : ""
          return `${element(ref, options)}${under}`
        })
      )
    }
  }
  if (onlyBefore.length > 0 || onlyAfter.length > 0) {
    lines.push("", "## Yalnız bir tarafta olan yakalamalar")
    lines.push(...onlyBefore.map((file) => `  yalnız eskide: ${file}`))
    lines.push(...onlyAfter.map((file) => `  yalnız yenide: ${file}`))
  }
  const skipped = [...comparison.skippedBefore, ...comparison.skippedAfter]
  if (skipped.length > 0) {
    lines.push("", "## Atlanan durumlar (sayfa o denetimi çizmiyor)")
    const seen = new Set<string>()
    for (const each of skipped) {
      const line = skippedLine(each)
      if (!seen.has(line)) {
        seen.add(line)
        lines.push(line)
      }
    }
  }
  const tolerance = options.tolerance > 0 ? `, ≤${options.tolerance} px fark yok sayıldı` : ""
  lines.push(
    "",
    same === total
      ? `çözülmüş stil ${same}/${total} aynı${tolerance}`
      : `çözülmüş stil ${same}/${total} aynı, ${total - same} farklı${tolerance}`
  )
  return lines.join("\n").replace(/^\n/, "")
}
