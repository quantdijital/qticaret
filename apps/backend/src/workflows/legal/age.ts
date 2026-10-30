import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
} from "@medusajs/framework/workflows-sdk"
import { ageOn } from "../../lib/catalog"
import { ValidationError } from "../../lib/errors"
import { LEGAL_MODULE } from "../../modules/legal"
import type LegalModuleService from "../../modules/legal/service"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import { AGE_VERIFICATION } from "../../modules/platform-settings/features"
import type { ComplianceSettings } from "../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"
import { productRestrictions } from "../catalog/restrictions"

type Container = Pick<MedusaContainer, "resolve">

interface CartRow {
  completed_at?: unknown
  sales_channel_id?: string | null
  items?: ({ product_id?: string | null } | null)[] | null
}

async function cartOf(container: Container, cartId: string): Promise<CartRow | undefined> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "cart",
    fields: ["id", "completed_at", "sales_channel_id", "items.product_id"],
    filters: { id: cartId },
  })
  return data[0]
}

/**
 * Whether the cart asks for the buyer's age (F13.3, adr/0041 §4): the
 * shop checks ages and the cart holds a restricted product. With the
 * shop's limit, and whether a declaration for it is kept.
 */
export async function ageCheck(container: Container, cartId: string, cart?: CartRow) {
  const settings = container.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
  const [on, compliance] = await Promise.all([
    settings.isFeatureEnabled(AGE_VERIFICATION),
    settings.getSection("compliance") as Promise<unknown> as Promise<ComplianceSettings>,
  ])
  if (!on) {
    return { required: false, min_age: compliance.min_age, declared: false }
  }
  const row = cart ?? (await cartOf(container, cartId))
  const productIds = (row?.items ?? []).flatMap((item) =>
    item?.product_id ? [item.product_id] : []
  )
  const restricted = (await productRestrictions(container, productIds)).size > 0
  const [declaration] = restricted
    ? await container
        .resolve<LegalModuleService>(LEGAL_MODULE)
        .listAgeDeclarations({ cart_id: cartId }, { take: 1, select: ["min_age"] })
    : []
  return {
    required: restricted,
    min_age: compliance.min_age,
    // One made under a lower limit than the shop's now is asked again
    declared: declaration !== undefined && declaration.min_age >= compliance.min_age,
  }
}

/** Stops a payment or a checkout of a restricted cart whose buyer has not declared their age. */
export async function assertAgeDeclared(container: Container, cartId: string): Promise<void> {
  const check = await ageCheck(container, cartId)
  if (check.required && !check.declared) {
    throw new ValidationError("age.declaration_missing", { field: "age_declaration" })
  }
}

export interface DeclareAgeInput {
  cart_id: string
  sales_channel_ids: string[]
  birth_date: string
}

/**
 * The buyer's declaration: the date of birth is checked against the
 * shop's limit and dropped; only "declared, over the limit" is kept.
 * Under the limit, nothing is kept. Undone, the declaration before comes back.
 */
const declareAgeStep = createStep(
  "legal-declare-age",
  async (input: DeclareAgeInput, { container }) => {
    const cart = await cartOf(container, input.cart_id)
    if (
      !cart ||
      cart.completed_at ||
      !input.sales_channel_ids.includes(cart.sales_channel_id ?? "")
    ) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "carts.unknown")
    }
    const check = await ageCheck(container, input.cart_id, cart)
    if (!check.required) {
      throw new ValidationError("age.not_required")
    }
    const age = ageOn(input.birth_date, new Date())
    if (age === null) {
      throw new ValidationError("age.birth_date_invalid", { field: "birth_date" })
    }
    if (age < check.min_age) {
      throw new ValidationError("age.under_limit", { field: "birth_date" })
    }
    const service = container.resolve<LegalModuleService>(LEGAL_MODULE)
    const [before] = await service.listAgeDeclarations({ cart_id: input.cart_id }, { take: 1 })
    const declaration = await service.recordAgeDeclaration(input.cart_id, check.min_age)
    return new StepResponse(
      {
        min_age: declaration.min_age,
        declared_at: new Date(declaration.declared_at).toISOString(),
      },
      {
        id: declaration.id,
        before: before ? { min_age: before.min_age, declared_at: before.declared_at } : null,
      }
    )
  },
  async (undo, { container }) => {
    if (!undo) {
      return
    }
    const service = container.resolve<LegalModuleService>(LEGAL_MODULE)
    if (undo.before) {
      await service.updateAgeDeclarations({ id: undo.id, ...undo.before })
    } else {
      await service.deleteAgeDeclarations([undo.id])
    }
  }
)

/** adr/0041 §4: a restricted cart's buyer declares their age before paying. */
export const declareAgeWorkflow = createWorkflow(
  "legal-declare-age",
  (input: DeclareAgeInput) => new WorkflowResponse(declareAgeStep(input))
)
