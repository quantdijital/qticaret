import type { MedusaContainer } from "@medusajs/framework/types"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
  transform,
  when,
} from "@medusajs/framework/workflows-sdk"
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"
import { TEXT_TIMEOUT_MS } from "../../lib/ai/connectors/types"
import { readProductFacts } from "../../lib/ai/facts/product"
import { fieldProblems } from "../../lib/ai/field-rules"
import { draftFacts, draftPrompt } from "../../lib/content-drafts/prompts"
import type { DraftKind, ProductDraftFacts } from "../../lib/content-drafts/prompts"
import { contentDraftProvider, draftMonthlyQuota } from "../../lib/content-drafts/provider"
import { PlanLimitError, ValidationError } from "../../lib/errors"
import { draftQuotaOf, forgetUsage } from "../../lib/plan-limits"
import { CONTENT_DRAFTS_MODULE } from "../../modules/content-drafts"
import type ContentDraftsModuleService from "../../modules/content-drafts/service"
import { CONTENT_AI_DRAFTS } from "../../modules/platform-settings/features"
import { setProductCatalogWorkflow } from "../catalog/set-product-catalog"
import { brandOf } from "../messaging/brand"
import { assertFeatureEnabledStep } from "../platform-settings/steps/assert-feature-enabled"
import { upsertSeoMetaWorkflow } from "../seo/upsert-seo-meta"

/** What a draft may know of a product: the AI core's reader, so both ways send the same. */
async function productFacts(
  container: Pick<MedusaContainer, "resolve">,
  productId: string
): Promise<ProductDraftFacts> {
  const facts = await readProductFacts(container, productId)
  if (!facts) {
    throw new ValidationError("content_drafts.unknown_product")
  }
  return { ...facts, shopName: (await brandOf(container)).shopName }
}

interface GenerateInput {
  entity_type: "product"
  entity_id: string
  kind: DraftKind
  user_id: string
}

/**
 * Asks the provider for a draft of a product's text (adr/0005): within
 * the month's quota, with a prompt of the product's own facts, filtered
 * of personal data (KK8). The draft passes the advisor's rules for its
 * field or is kept as refused, never offered. Nothing reaches the page
 * here. Nothing to undo: the provider was asked, and the quota counts it.
 */
const generateDraftStep = createStep(
  "content-generate-draft",
  async (input: GenerateInput, { container }) => {
    const provider = contentDraftProvider()
    if (!provider) {
      throw new ValidationError("content_drafts.no_provider")
    }
    const drafts = container.resolve<ContentDraftsModuleService>(CONTENT_DRAFTS_MODULE)
    // The platform's quota or the package's monthly credits, the lower (adr/0061 Ek C14)
    const { quota, plan } = await draftQuotaOf(container, draftMonthlyQuota())
    // Filtered before anything is made of them: the provider sees no more than the prompt
    const facts = draftFacts(await productFacts(container, input.entity_id))
    // Claimed in one statement, so two asks at the last credit cannot both pass
    if (!(await drafts.claimQuota(quota))) {
      if (plan !== null) {
        throw new PlanLimitError("llm_credits_per_month", await drafts.usedThisMonth(), plan)
      }
      throw new ValidationError("content_drafts.quota_reached")
    }
    forgetUsage("llm_credits_per_month")
    const prompt = draftPrompt(input.kind, facts)
    const text = (
      await provider.draft({
        kind: input.kind,
        prompt,
        facts,
        signal: AbortSignal.timeout(TEXT_TIMEOUT_MS),
      })
    ).trim()
    const problems = fieldProblems(input.kind, text)
    const draft = await drafts.createContentDrafts({
      entity_type: input.entity_type,
      entity_id: input.entity_id,
      kind: input.kind,
      text,
      prompt,
      provider: provider.name,
      status: problems.length > 0 ? "refused" : "draft",
      problems: problems.length > 0 ? { problems } : null,
      created_by: input.user_id,
    })
    return new StepResponse({
      id: draft.id,
      kind: draft.kind,
      text: draft.text,
      status: draft.status,
      problems,
    })
  }
)

/** A draft of a product's description or search result title or description (F10.13). */
export const generateDraftWorkflow = createWorkflow(
  "content-generate-draft",
  (input: GenerateInput) => {
    assertFeatureEnabledStep(CONTENT_AI_DRAFTS)
    return new WorkflowResponse(generateDraftStep(input))
  }
)

interface DecideInput {
  id: string
  decision: "approve" | "reject"
  user_id: string
}

/** The draft to decide on: only one still open may be approved or turned down. */
const openDraftStep = createStep(
  "content-open-draft",
  async (input: DecideInput, { container }) => {
    const [draft] = await container
      .resolve<ContentDraftsModuleService>(CONTENT_DRAFTS_MODULE)
      // adr/0005 drafts only: an AI core suggestion is decided on its own routes and never
      // written to the product here (adr/0071 §11; security review of PR 170, O1)
      .listContentDrafts({ id: input.id, source: "ai_draft" }, { take: 1 })
    if (draft?.status !== "draft") {
      throw new ValidationError("content_drafts.not_open")
    }
    return new StepResponse({
      entity_id: draft.entity_id,
      kind: draft.kind as DraftKind,
      text: draft.text,
    })
  }
)

/** Records the staff member's decision. Undone by opening the draft again. */
const recordDecisionStep = createStep(
  "content-record-decision",
  async (input: DecideInput, { container }) => {
    await container.resolve<ContentDraftsModuleService>(CONTENT_DRAFTS_MODULE).updateContentDrafts({
      id: input.id,
      status: input.decision === "approve" ? "approved" : "rejected",
      decided_by: input.user_id,
      decided_at: new Date(),
    })
    return new StepResponse({ status: input.decision }, input.id)
  },
  async (id, { container }) => {
    if (id) {
      await container
        .resolve<ContentDraftsModuleService>(CONTENT_DRAFTS_MODULE)
        .updateContentDrafts({ id, status: "draft", decided_by: null, decided_at: null })
    }
  }
)

/**
 * Staff approve a draft, which only then reaches the page through the
 * product's or its SEO fields' own workflow (and undoes with them), or
 * turn it down (adr/0005: no draft is published without approval, KK8).
 */
export const decideDraftWorkflow = createWorkflow("content-decide-draft", (input: DecideInput) => {
  const draft = openDraftStep(input)
  const approved = transform({ input, draft }, ({ input, draft }) => ({
    description: input.decision === "approve" && draft.kind === "product_description",
    seo: input.decision === "approve" && draft.kind !== "product_description",
  }))
  when("content-apply-description", { approved }, ({ approved }) => approved.description).then(
    () => {
      updateProductsWorkflow.runAsStep({
        input: transform({ draft }, ({ draft }) => ({
          selector: { id: draft.entity_id },
          update: { description: draft.text },
        })),
      })
      // adr/0055: the approved plain text replaces a description document the product had
      setProductCatalogWorkflow.runAsStep({
        input: transform({ draft }, ({ draft }) => ({
          product_id: draft.entity_id,
          description_doc: null,
        })),
      })
    }
  )
  when("content-apply-seo", { approved }, ({ approved }) => approved.seo).then(() => {
    upsertSeoMetaWorkflow.runAsStep({
      input: transform({ draft }, ({ draft }) => ({
        entity_type: "product" as const,
        entity_id: draft.entity_id,
        values:
          draft.kind === "seo_title" ? { seo_title: draft.text } : { seo_description: draft.text },
      })),
    })
  })
  return new WorkflowResponse(recordDecisionStep(input))
})
