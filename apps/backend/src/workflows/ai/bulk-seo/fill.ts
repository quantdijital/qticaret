import type { MedusaContainer } from "@medusajs/framework/types"
import { z } from "@medusajs/framework/zod"
import { SEO_FILL_FIELDS, SEO_FILL_MAX } from "../../../lib/ai/bulk-seo"
import type { SeoFillField, SeoFillTarget } from "../../../lib/ai/bulk-seo"
import { AI_ENTITY_TYPES } from "../../../lib/ai/facts"
import { SEO_DESCRIPTION_TASK, SEO_TITLE_TASK } from "../../../lib/ai/registry/tasks"
import { runBulkSuggestions } from "../bulk-run"
import type { BulkSummary } from "../bulk-run"
import { suggestTextWorkflow } from "../suggest-text"
import { readSeoFillTargets, waitingSeoKeys } from "./read"

/**
 * The bulk SEO fill job `ai.seo_fill` (adr/0074 §5 madde 7): queued by its
 * own route with the pages it picked, it checks each again (the finding
 * still there, no suggestion waiting) and asks for each page's search
 * texts one by one through the single ask's workflow: the same reader,
 * gate, candidates, guidance and quota. Nothing is written to a page: the
 * suggestions wait in the review dialog.
 */

const NAME = /^[a-z][a-z0-9_]{0,39}$/
const ID = /^[A-Za-z0-9_]{1,64}$/

export const AiSeoFillInput = z
  .object({
    fields: z.array(z.enum(SEO_FILL_FIELDS)).min(1).max(SEO_FILL_FIELDS.length),
    pages: z
      .array(
        z.object({ entity_type: z.enum(AI_ENTITY_TYPES), entity_id: z.string().regex(ID) }).strict()
      )
      .min(1)
      .max(SEO_FILL_MAX),
    service: z.string().regex(NAME).optional(),
  })
  .strict()
export type AiSeoFillInput = z.infer<typeof AiSeoFillInput>

/** One ask: a page and one of its tasks. */
export interface SeoFillAsk {
  entity_type: SeoFillTarget["entity_type"]
  entity_id: string
  task: string
}

export interface SeoFillDeps {
  /** The pages, checked again: those whose finding is still there, with the tasks still worth asking. */
  eligible: (
    pages: readonly { entity_type: string; entity_id: string }[],
    fields: readonly SeoFillField[]
  ) => Promise<SeoFillTarget[]>
  waiting: (ask: SeoFillAsk) => Promise<boolean>
  suggest: (ask: SeoFillAsk) => Promise<"draft" | "refused">
  progress: (percent: number) => Promise<void>
}

export type SeoFillSummary = BulkSummary & {
  /** Pages queued, at most `SEO_FILL_MAX`. */
  pages: number
}

const TASK_FIELD: Readonly<Record<string, SeoFillField>> = {
  [SEO_TITLE_TASK.id]: "seo_title",
  [SEO_DESCRIPTION_TASK.id]: "seo_description",
}

/** The job's loop apart from Medusa: the limit, the checks again and the stops are tested on their own. */
export async function runSeoFill(
  deps: SeoFillDeps,
  input: AiSeoFillInput
): Promise<SeoFillSummary> {
  const unique = new Map(
    input.pages.map((page) => [`${page.entity_type}:${page.entity_id}`, page] as const)
  )
  const pages = [...unique.values()].slice(0, SEO_FILL_MAX)
  const targets = await deps.eligible(pages, input.fields)
  const asks: SeoFillAsk[] = targets.flatMap((target) =>
    target.tasks
      .filter((task) => {
        const field = TASK_FIELD[task]
        return field !== undefined && input.fields.includes(field)
      })
      .map((task) => ({
        entity_type: target.entity_type,
        entity_id: target.entity_id,
        task,
      }))
  )
  // `skipped` counts asks; a page fixed meanwhile is one skipped ask per field asked
  const dropped = (pages.length - targets.length) * input.fields.length
  const summary = await runBulkSuggestions(
    {
      waiting: deps.waiting,
      suggest: deps.suggest,
      progress: deps.progress,
      failedEvent: "ai.seo_fill_page_failed",
    },
    asks,
    dropped
  )
  return { ...summary, pages: pages.length }
}

type Container = Pick<MedusaContainer, "resolve">

/** The job's run with the container: each ask as the staff member who queued it, with the service picked. */
export function seoFill(
  container: Container,
  input: AiSeoFillInput & { user_id: string },
  progress: (percent: number) => Promise<void>
): Promise<SeoFillSummary> {
  return runSeoFill(
    {
      eligible: async (pages, fields) => {
        const wanted = new Set(pages.map((page) => `${page.entity_type}:${page.entity_id}`))
        const found = await readSeoFillTargets(
          container,
          fields,
          pages.map((page) => page.entity_id)
        )
        // In the order queued, of the kinds queued (an id is unique within its kind only)
        const byKey = new Map(
          found
            .filter((target) => wanted.has(`${target.entity_type}:${target.entity_id}`))
            .map((target) => [`${target.entity_type}:${target.entity_id}`, target])
        )
        return pages.flatMap((page) => {
          const target = byKey.get(`${page.entity_type}:${page.entity_id}`)
          return target ? [target] : []
        })
      },
      waiting: async (ask) =>
        (await waitingSeoKeys(container, [ask.entity_id])).has(
          `${ask.entity_type}:${ask.entity_id}:${ask.task}`
        ),
      suggest: async (ask) => {
        const { result } = await suggestTextWorkflow(container as MedusaContainer).run({
          input: {
            task: ask.task,
            entity_type: ask.entity_type,
            entity_id: ask.entity_id,
            service: input.service,
            user_id: input.user_id,
          },
        })
        return result.status
      },
      progress,
    },
    input
  )
}
