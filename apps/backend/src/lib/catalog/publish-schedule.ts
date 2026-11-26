/**
 * A draft product's planned publish (S2, docs/06 "Ürün sayfası"): the
 * moment is kept in the product's metadata (`publish_at`, ISO 8601 in UTC)
 * so no table is needed; the minute job publishes a draft whose moment has
 * come through Medusa's own update, so SEO, the address registry and the
 * search index see it as a publish by hand. A planned publish the SEO gate
 * held back leaves the product a draft, its plan cleared and the reason
 * kept (`publish_failed`) for the product page to say.
 */

export const PUBLISH_AT = "publish_at"
export const PUBLISH_FAILED = "publish_failed"

/** The furthest ahead a publish may be planned: a year; further is a typo. */
export const PUBLISH_MAX_DAYS = 366

const DAY_MS = 24 * 60 * 60 * 1000

export type Metadata = Record<string, unknown>

export interface PublishFailure {
  at: string
  reason: string
}

export interface PublishSchedule {
  publish_at: string | null
  failed: PublishFailure | null
}

const momentOf = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null
  }
  const time = Date.parse(value)
  return Number.isNaN(time) ? null : new Date(time).toISOString()
}

/** The plan as stored; an unreadable value reads as none. */
export function scheduleOf(metadata: Metadata | null | undefined): PublishSchedule {
  const failed = metadata?.[PUBLISH_FAILED]
  const failure =
    failed && typeof failed === "object" && !Array.isArray(failed)
      ? (failed as Record<string, unknown>)
      : null
  const at = momentOf(failure?.["at"])
  return {
    publish_at: momentOf(metadata?.[PUBLISH_AT]),
    failed:
      at && typeof failure?.["reason"] === "string" ? { at, reason: failure["reason"] } : null,
  }
}

/**
 * The metadata with the plan set (or cleared with null); any earlier
 * failure goes with it, the owner having seen it and planned again.
 */
export function withSchedule(
  metadata: Metadata | null | undefined,
  publishAt: string | null
): Metadata {
  const rest = without(metadata)
  return publishAt === null ? rest : { ...rest, [PUBLISH_AT]: new Date(publishAt).toISOString() }
}

/** The metadata without the plan's keys. */
function without(metadata: Metadata | null | undefined): Metadata {
  return Object.fromEntries(
    Object.entries(metadata ?? {}).filter(([key]) => key !== PUBLISH_AT && key !== PUBLISH_FAILED)
  )
}

/** The metadata once the plan was held back: no plan, the reason kept. */
export function withFailure(
  metadata: Metadata | null | undefined,
  failure: PublishFailure
): Metadata {
  return { ...without(metadata), [PUBLISH_FAILED]: failure }
}

/** The metadata once published: neither the plan nor an old failure stays. */
export function withoutSchedule(metadata: Metadata | null | undefined): Metadata {
  return withSchedule(metadata, null)
}

/** Whether the metadata holds any plan or failure worth clearing. */
export const hasSchedule = (metadata: Metadata | null | undefined): boolean =>
  metadata?.[PUBLISH_AT] !== undefined || metadata?.[PUBLISH_FAILED] !== undefined

export type ScheduleProblem = "past" | "too_far"

/** What is wrong with a planned moment, or null. */
export function scheduleProblem(
  publishAt: string,
  now: number = Date.now()
): ScheduleProblem | null {
  const time = Date.parse(publishAt)
  if (Number.isNaN(time) || time <= now) {
    return "past"
  }
  return time > now + PUBLISH_MAX_DAYS * DAY_MS ? "too_far" : null
}

export interface ScheduledProduct {
  id: string
  status: string
  metadata?: Metadata | null
}

/** The drafts whose planned moment has come, the longest waiting first. */
export function dueForPublish<T extends ScheduledProduct>(
  products: readonly T[],
  now: number
): T[] {
  return products
    .flatMap((product) => {
      const at = product.status === "draft" ? scheduleOf(product.metadata).publish_at : null
      return at && Date.parse(at) <= now ? [{ product, time: Date.parse(at) }] : []
    })
    .sort((a, b) => a.time - b.time)
    .map((each) => each.product)
}
