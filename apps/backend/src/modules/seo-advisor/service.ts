import type { Context, InferTypeOf } from "@medusajs/framework/types"
import { InjectTransactionManager, MedusaContext, MedusaService } from "@medusajs/framework/utils"
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
}

/** Pages' latest SEO assessments (docs/14 §1); the rules live in lib/seo/advisor. */
class SeoAdvisorModuleService extends MedusaService({ SeoAssessment }) {
  /** Replaces the page's assessment with this one. */
  @InjectTransactionManager()
  async saveAssessment(
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
}

export default SeoAdvisorModuleService
