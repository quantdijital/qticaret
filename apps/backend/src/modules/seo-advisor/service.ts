import type { Context, InferTypeOf } from "@medusajs/framework/types"
import {
  InjectManager,
  InjectTransactionManager,
  MedusaContext,
  MedusaService,
} from "@medusajs/framework/utils"
import { uniqueViolationKeys } from "../../lib/errors"
import { SeoAssessment } from "./models/seo-assessment"

export type SeoAssessmentRecord = InferTypeOf<typeof SeoAssessment>
export type AssessedKind = SeoAssessmentRecord["entity_type"]

export interface AssessmentInput {
  entity_type: AssessedKind
  entity_id: string
  score: number
  grade: SeoAssessmentRecord["grade"]
  issues: Record<string, unknown>[]
  critical: number
  rules_version: number
  title_hash: string | null
  description_hash: string | null
  is_listed: boolean
}

export interface DuplicateGroup {
  entity_type: AssessedKind
  /** Pages showing the text; `ids` names the first few. */
  pages: number
  ids: string[]
  /** Groups of the kind and field in all, on every row. */
  groups: number
}

/** A page's findings as the bulk SEO fill reads them. */
export interface PageWithFindings {
  entity_type: AssessedKind
  entity_id: string
  issues: unknown
}

// Fixed column names: never from input
const HASH_COLUMNS = { title: "title_hash", description: "description_hash" } as const

/** Pages' latest SEO assessments (docs/14 §1); the rules live in lib/seo/advisor. */
class SeoAdvisorModuleService extends MedusaService({ SeoAssessment }) {
  /** Replaces the page's assessment with this one. */
  async saveAssessment(input: AssessmentInput, sharedContext: Context = {}): Promise<void> {
    try {
      await this.saveAssessment_(input, sharedContext)
    } catch (error) {
      // A new page assessed twice at once (its save's subscriber and the
      // page being opened): the other insert won at commit, so update it
      if (!uniqueViolationKeys(error)?.includes("entity_id")) {
        throw error
      }
      await this.saveAssessment_(input, sharedContext)
    }
  }

  @InjectTransactionManager()
  protected async saveAssessment_(
    input: AssessmentInput,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<void> {
    const [current] = await this.listSeoAssessments(
      { entity_type: input.entity_type, entity_id: input.entity_id },
      { take: 1, select: ["id"] },
      sharedContext
    )
    const data = {
      ...input,
      issues: input.issues as unknown as Record<string, unknown>,
      computed_at: new Date(),
    }
    if (current) {
      await this.updateSeoAssessments({ id: current.id, ...data }, sharedContext)
    } else {
      await this.createSeoAssessments(data, sharedContext)
    }
  }

  /**
   * Live, indexable pages of one kind that show the same title (or
   * description), the biggest groups first (docs/14 S-DUP-01), each with
   * a few of its ids.
   */
  @InjectManager()
  async duplicateGroups(
    text: keyof typeof HASH_COLUMNS,
    limit: number,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<DuplicateGroup[]> {
    const column = HASH_COLUMNS[text]
    const manager = sharedContext.manager as {
      execute: (sql: string, params: unknown[]) => Promise<unknown>
    }
    return (await manager.execute(
      `SELECT entity_type, count(*)::integer AS pages,
              (array_agg(entity_id ORDER BY entity_id))[1:5] AS ids,
              (count(*) OVER ())::integer AS groups
         FROM seo_assessment
        WHERE deleted_at IS NULL AND is_listed IS TRUE AND ${column} IS NOT NULL
        GROUP BY entity_type, ${column} HAVING count(*) > 1
        ORDER BY pages DESC, entity_type LIMIT ?`,
      [limit]
    )) as DuplicateGroup[]
  }

  /**
   * Pages of these kinds with a finding of one of these rules, the rule
   * named without its kind letter ("TITLE-01" for P-, C-, B-…), the lowest
   * score first, at most `limit`; with `ids`, only those pages. Filtered
   * in the database, so the bulk SEO fill (adr/0074 §5 madde 7) never
   * reads every page's findings. Every value is a bound parameter.
   */
  @InjectManager()
  async pagesWithRules(
    input: {
      kinds: readonly string[]
      rules: readonly string[]
      limit: number
      ids?: readonly string[]
    },
    @MedusaContext() sharedContext: Context = {}
  ): Promise<PageWithFindings[]> {
    if (input.kinds.length === 0 || input.rules.length === 0 || input.ids?.length === 0) {
      return []
    }
    const list = (values: readonly unknown[]) => values.map(() => "?").join(", ")
    const manager = sharedContext.manager as {
      execute: (sql: string, params: unknown[]) => Promise<unknown>
    }
    return (await manager.execute(
      `SELECT entity_type, entity_id, issues
         FROM seo_assessment
        WHERE deleted_at IS NULL
          AND entity_type IN (${list(input.kinds)})
          ${input.ids ? `AND entity_id IN (${list(input.ids)})` : ""}
          AND jsonb_typeof(issues::jsonb) = 'array'
          AND EXISTS (
            SELECT 1 FROM jsonb_array_elements(issues::jsonb) AS found
             WHERE substring(found->>'ruleId' FROM position('-' IN found->>'ruleId') + 1)
                   IN (${list(input.rules)})
          )
        ORDER BY score ASC, entity_id ASC
        LIMIT ?`,
      [...input.kinds, ...(input.ids ?? []), ...input.rules, input.limit]
    )) as PageWithFindings[]
  }
}

export default SeoAdvisorModuleService
