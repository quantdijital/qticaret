import type { MedusaContainer, PromotionDTO } from "@medusajs/framework/types"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import {
  createCampaignsWorkflow,
  createPromotionsWorkflow,
  deleteCampaignsWorkflow,
  deletePromotionsWorkflow,
} from "@medusajs/medusa/core-flows"
import { chunksOf } from "../../lib/catalog"
import { ValidationError } from "../../lib/errors"
import { batchPrefix, freshCodes } from "../../lib/promotions"

/**
 * Batches of single-use codes (F4.6, ADR-0024). Each batch is a campaign
 * of its own whose identifier names its template (`codes-<template id>-…`),
 * holding a copy of the template per code, each usable once. The batch
 * campaign carries the template's days; the copies its offer and rules.
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
 * `count` codes copied from the template into a batch campaign of their
 * own. Codes are checked against the shop's before they are written; if
 * writing fails part way, what was written is taken back.
 */
export async function createCodeBatch(
  container: MedusaContainer,
  input: { promotion_id: string; count: number },
  progress: (percent: number) => Promise<void>
): Promise<CodeBatch> {
  const template = await codeTemplate(container, input.promotion_id)
  const prefix = batchPrefix(template.code ?? "")
  const { result: campaigns } = await createCampaignsWorkflow(container).run({
    input: {
      campaignsData: [
        {
          name: `${template.code ?? ""} · ${String(input.count)}`,
          campaign_identifier: batchIdentifier(template.id),
          starts_at: template.campaign?.starts_at ?? null,
          ends_at: template.campaign?.ends_at ?? null,
        },
      ],
    },
  })
  const campaignId = campaigns[0]?.id ?? ""
  const written: string[] = []
  const codes: string[] = []
  try {
    const promotions = container.resolve(Modules.PROMOTION)
    const batches = Math.ceil(input.count / CHUNK)
    for (let batch = 0; batch < batches; batch++) {
      const size = Math.min(CHUNK, input.count - batch * CHUNK)
      const drawn = freshCodes(prefix, size, new Set(codes))
      const taken = await promotions.listPromotions({ code: drawn }, { select: ["code"] })
      // A clash with a code the shop has: draw those again, against both
      const clashes = new Set(taken.flatMap((row) => (row.code ? [row.code] : [])))
      const fresh = drawn.filter((code) => !clashes.has(code))
      fresh.push(...freshCodes(prefix, size - fresh.length, new Set([...codes, ...drawn])))
      const { result } = await createPromotionsWorkflow(container).run({
        input: { promotionsData: fresh.map((code) => copyOf(template, code, campaignId)) },
      })
      written.push(...result.map((row) => row.id))
      codes.push(...fresh)
      await progress(Math.round(((batch + 1) / batches) * 100))
    }
  } catch (error) {
    // Best effort: a batch is whole or gone
    for (const ids of chunksOf(written, CHUNK)) {
      await deletePromotionsWorkflow(container).run({ input: { ids } })
    }
    await deleteCampaignsWorkflow(container).run({ input: { ids: [campaignId] } })
    throw error
  }
  return { campaign_id: campaignId, codes }
}
