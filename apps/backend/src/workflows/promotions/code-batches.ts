import type { MedusaContainer, PromotionDTO } from "@medusajs/framework/types"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { chunksOf } from "../../lib/catalog"
import { ValidationError } from "../../lib/errors"

/**
 * Batches of single-use codes (F4.6, ADR-0024). Each batch is a campaign
 * of its own whose identifier names its template (`codes-<template id>-…`),
 * holding a copy of the template per code, each usable once. The batch
 * campaign carries the template's days and budget; the copies its offer
 * and rules. Made by `createCodeBatchWorkflow` (code-batch-workflow.ts).
 */
export const BATCH_PREFIX = "codes-"
// Promotions written per call, and codes checked against the shop's per query
const CHUNK = 500

export const batchIdentifier = (templateId: string, suffix: string = Date.now().toString(36)) =>
  `${BATCH_PREFIX}${templateId}-${suffix}`

export const templateOfBatch = (identifier: string | null | undefined): string | null => {
  const match = identifier?.match(/^codes-(.+)-[a-z0-9]+$/u)
  return match?.[1] ?? null
}

const TEMPLATE_RELATIONS = [
  "application_method",
  "application_method.target_rules",
  "application_method.target_rules.values",
  "rules",
  "rules.values",
  "campaign",
  "campaign.budget",
]

type Template = PromotionDTO

/** A template codes can be copied from: a standard offer with a code, not a batch's own. */
export async function codeTemplate(container: MedusaContainer, id: string): Promise<Template> {
  const promotions = container.resolve(Modules.PROMOTION)
  const [template] = await promotions.listPromotions(
    { id: [id] },
    { relations: TEMPLATE_RELATIONS, take: 1 }
  )
  if (!template) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "promotions.unknown")
  }
  if (
    template.type !== "standard" ||
    template.is_automatic ||
    !template.code ||
    templateOfBatch(template.campaign?.campaign_identifier) !== null
  ) {
    // A validation error: the job reports its key, so the panel can say why
    throw new ValidationError("promotions.codes_template")
  }
  return template
}

const rulesOf = (rules: Template["rules"]) =>
  (rules ?? []).map((rule) => ({
    attribute: rule.attribute ?? "",
    operator: rule.operator ?? "in",
    values: rule.values.flatMap((value) => (value.value ? [value.value] : [])),
  }))

/** The template's offer for one code: everything but its code, campaign and limit. */
function copyOf(template: Template, code: string, campaignId: string) {
  const method = template.application_method
  return {
    code,
    type: "standard" as const,
    is_automatic: false,
    is_tax_inclusive: template.is_tax_inclusive ?? false,
    status: template.status ?? "active",
    limit: 1,
    campaign_id: campaignId,
    rules: rulesOf(template.rules),
    application_method: {
      type: method?.type ?? "percentage",
      target_type: method?.target_type ?? "order",
      allocation: method?.allocation ?? "across",
      value: method?.value ?? 0,
      ...(method?.currency_code ? { currency_code: method.currency_code } : {}),
      ...(method?.max_quantity ? { max_quantity: method.max_quantity } : {}),
      target_rules: rulesOf(method?.target_rules),
    },
  }
}

export interface CodeBatch {
  campaign_id: string
  codes: string[]
}

/**
 * The batch's campaign: the template's days, and a copy of its budget. A
 * per-customer limit goes on holding across the batch's codes; a total
 * (spend or uses) is counted for the batch on its own (ADR-0024 note).
 */
export function batchCampaignData(template: Template, count: number) {
  const budget = template.campaign?.budget
  return {
    name: `${template.code ?? ""} · ${String(count)}`,
    campaign_identifier: batchIdentifier(template.id),
    starts_at: template.campaign?.starts_at ?? null,
    ends_at: template.campaign?.ends_at ?? null,
    ...(budget?.type
      ? {
          budget: {
            type: budget.type,
            limit: budget.limit ?? null,
            ...(budget.currency_code ? { currency_code: budget.currency_code } : {}),
            ...(budget.attribute ? { attribute: budget.attribute } : {}),
          },
        }
      : {}),
  }
}

/** A batch taken back whole: its codes, then its campaign. */
export async function removeCodeBatch(
  container: MedusaContainer,
  batch: { campaign_id: string; promotion_ids: string[] }
): Promise<void> {
  const promotions = container.resolve(Modules.PROMOTION)
  for (const ids of chunksOf(batch.promotion_ids, CHUNK)) {
    await promotions.deletePromotions(ids)
  }
  if (batch.campaign_id) {
    await promotions.deleteCampaigns([batch.campaign_id])
  }
}

/** A batch taken back by its campaign: every code in it, then the campaign. */
export async function removeCodeBatchOf(
  container: MedusaContainer,
  campaignId: string
): Promise<void> {
  const rows = await container
    .resolve(Modules.PROMOTION)
    .listPromotions({ campaign: { id: [campaignId] } }, { select: ["id"], take: null })
  await removeCodeBatch(container, {
    campaign_id: campaignId,
    promotion_ids: rows.map((row) => row.id),
  })
}

export { CHUNK as BATCH_CHUNK, copyOf as batchCopyOf }
