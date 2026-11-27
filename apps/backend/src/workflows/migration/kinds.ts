import type { ReportProblem } from "./report"

/**
 * What a migration run may be asked to move (adr/0042 Ek 2026-11-27): the
 * owner ticks these in the wizard; a run without a choice moves them all.
 * `post` brings the blog's categories and tags with it; `url` is the old
 * addresses' inventory and the texts' links to the old site, after an apply.
 */
export const RUN_KINDS = [
  "category",
  "brand",
  "product",
  "image",
  "customer",
  "order",
  "review",
  "post",
  "page",
  "url",
] as const
export type RunKind = (typeof RUN_KINDS)[number]

/**
 * What a kind cannot do without, added by the server whatever the owner
 * chose: a product names its categories and brand; a picture and a review
 * belong to a product; an old order to its customer. A record moved before
 * is found, never written twice, so the addition costs a read only.
 */
const NEEDS: Readonly<Partial<Record<RunKind, readonly RunKind[]>>> = {
  product: ["category", "brand"],
  image: ["product"],
  review: ["product"],
  order: ["customer"],
}

/** The kinds a run takes: the chosen ones and all they need, in the run's order; none chosen, all. */
export function withDependencies(chosen: readonly RunKind[] | null | undefined): RunKind[] {
  if (!chosen || chosen.length === 0) {
    return [...RUN_KINDS]
  }
  const taken = new Set<RunKind>()
  const add = (kind: RunKind) => {
    if (!taken.has(kind)) {
      taken.add(kind)
      for (const need of NEEDS[kind] ?? []) {
        add(need)
      }
    }
  }
  chosen.forEach(add)
  return RUN_KINDS.filter((kind) => taken.has(kind))
}

/** The kinds the server added to the owner's choice. */
export const addedKinds = (chosen: readonly RunKind[], taken: readonly RunKind[]): RunKind[] =>
  chosen.length === 0 ? [] : taken.filter((kind) => !chosen.includes(kind))

/**
 * A run's problems grouped by kind and reason (adr/0042 Ek 2026-11-27):
 * the panel says each reason once with its count and offers its fix. A few
 * of each group's source keys come along, never a person's: customers,
 * their orders, consents and reviews may be keyed by e-mail.
 */
export interface ProblemGroup {
  kind: ReportProblem["kind"]
  key: string
  count: number
  samples: string[]
}

// Kinds whose source keys name no person; any other (customers, orders, reviews, a kind added later) keeps none
const SAMPLED_KINDS: ReadonlySet<string> = new Set([
  "category",
  "brand",
  "product",
  "image",
  "post",
  "page",
  "post_category",
  "post_tag",
])
// Groups and samples the summary keeps; the report file has every row
export const MAX_GROUPS = 40
export const MAX_SAMPLES = 10

export function groupProblems(problems: readonly ReportProblem[]): ProblemGroup[] {
  const groups = new Map<string, ProblemGroup>()
  for (const problem of problems) {
    const id = `${problem.kind} ${problem.key}`
    const group = groups.get(id) ?? { kind: problem.kind, key: problem.key, count: 0, samples: [] }
    group.count += 1
    if (SAMPLED_KINDS.has(problem.kind) && group.samples.length < MAX_SAMPLES) {
      group.samples.push(problem.source_key)
    }
    groups.set(id, group)
  }
  return [...groups.values()].sort((a, b) => b.count - a.count).slice(0, MAX_GROUPS)
}
