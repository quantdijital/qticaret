import type { WorkflowData } from "@medusajs/framework/workflows-sdk"
import {
  WorkflowResponse,
  createWorkflow,
  transform,
  when,
} from "@medusajs/framework/workflows-sdk"
import {
  acquireLockStep,
  createProductTypesWorkflow,
  createTaxRatesWorkflow,
  deleteProductTypesWorkflow,
  deleteTaxRatesWorkflow,
  releaseLockStep,
  updateProductTypesWorkflow,
  updateTaxRatesWorkflow,
} from "@medusajs/medusa/core-flows"
import type { VatTypeChoice } from "../../lib/tax"
import { planNewVatRateStep, planVatDefaultStep, planVatRateChangeStep } from "./steps/plan-vat"
import type {
  NewVatRateStepInput,
  VatDefaultStepInput,
  VatRateChangeStepInput,
} from "./steps/plan-vat"
import { restoreVatRateStep, setVatDefaultStep, unsetVatDefaultStep } from "./steps/write-vat"

/**
 * The shop's KDV rates from the panel (adr/0007 Ek 2026-11-04): a rate is
 * a tax rate of the TR region bound by a `product_type` rule to a product
 * type of its name; the default rate taxes products on no VAT type. Medusa's
 * own workflows write them, so each undoes itself; one change at a time.
 */

const VAT_LOCK = { key: "tax:vat-rates", timeout: 10, ttl: 30 }

const created = (choice: VatTypeChoice | null | undefined): string | null =>
  choice && "create" in choice ? choice.create : null

const productTypes = (value: string | null) => ({ product_types: [{ value: value ?? "" }] })

/** A new rate on a product type of its name; returns its id. */
export const createVatRateWorkflow = createWorkflow(
  "vat-rate-create",
  (input: WorkflowData<NewVatRateStepInput>) => {
    acquireLockStep(VAT_LOCK)
    const plan = planNewVatRateStep(input)
    const made = when("vat-rate-create-type", { plan }, ({ plan }) => "create" in plan.type).then(
      () =>
        createProductTypesWorkflow.runAsStep({
          input: transform({ plan }, ({ plan }) => productTypes(created(plan.type))),
        })
    )
    const rates = createTaxRatesWorkflow.runAsStep({
      input: transform({ input, plan, made }, ({ input, plan, made }) => {
        const typeId = "reuse" in plan.type ? plan.type.reuse : made?.[0]?.id
        if (!typeId) {
          throw new Error("vat-rate-create: the rate's product type is missing")
        }
        return [
          {
            tax_region_id: input.region_id,
            code: plan.code,
            name: plan.name,
            rate: plan.rate,
            rules: [{ reference: "product_type", reference_id: typeId }],
          },
        ]
      }),
    })
    releaseLockStep({ key: VAT_LOCK.key })
    return new WorkflowResponse(transform({ rates }, ({ rates }) => rates[0]?.id ?? ""))
  }
)

/**
 * A rate renamed (its product type with it), taken out of use (with its
 * product type, which no product is on) or brought back as it was.
 */
export const updateVatRateWorkflow = createWorkflow(
  "vat-rate-update",
  (input: WorkflowData<VatRateChangeStepInput>) => {
    acquireLockStep(VAT_LOCK)
    const plan = planVatRateChangeStep(input)
    when("vat-rate-remove", { plan }, ({ plan }) => plan.removal !== null).then(() => {
      deleteTaxRatesWorkflow.runAsStep({
        input: transform({ plan }, ({ plan }) => ({ ids: [plan.removal?.rate_id ?? ""] })),
      })
    })
    when("vat-rate-remove-type", { plan }, ({ plan }) => Boolean(plan.removal?.type_id)).then(
      () => {
        deleteProductTypesWorkflow.runAsStep({
          input: transform({ plan }, ({ plan }) => ({ ids: [plan.removal?.type_id ?? ""] })),
        })
      }
    )
    restoreVatRateStep(transform({ plan }, ({ plan }) => plan.restore))
    when("vat-rate-rename", { plan }, ({ plan }) => plan.rename !== null).then(() => {
      updateTaxRatesWorkflow.runAsStep({
        input: transform({ plan }, ({ plan }) => ({
          selector: { id: plan.rename?.rate_id ?? "" },
          update: { name: plan.rename?.name ?? "" },
        })),
      })
    })
    when("vat-rate-rename-type", { plan }, ({ plan }) => Boolean(plan.rename?.type_id)).then(() => {
      updateProductTypesWorkflow.runAsStep({
        input: transform({ plan }, ({ plan }) => ({
          selector: { id: plan.rename?.type_id ?? "" },
          update: { value: plan.rename?.name ?? "" },
        })),
      })
    })
    releaseLockStep({ key: VAT_LOCK.key })
    return new WorkflowResponse(input.id)
  }
)

/**
 * Another rate made the default: the old one is unset first (one default
 * per region) and bound to a product type of its name when it had none.
 */
export const setDefaultVatRateWorkflow = createWorkflow(
  "vat-rate-default",
  (input: WorkflowData<VatDefaultStepInput>) => {
    acquireLockStep(VAT_LOCK)
    const plan = planVatDefaultStep(input)
    const made = when("vat-rate-default-type", { plan }, ({ plan }) =>
      Boolean(created(plan?.from?.type))
    ).then(() =>
      createProductTypesWorkflow.runAsStep({
        input: transform({ plan }, ({ plan }) => productTypes(created(plan?.from?.type))),
      })
    )
    unsetVatDefaultStep(
      transform({ plan, made }, ({ plan, made }) => {
        const from = plan?.from
        if (!from) {
          return null
        }
        const reused = from.type && "reuse" in from.type ? from.type.reuse : null
        return { id: from.id, bind_type_id: reused ?? made?.[0]?.id ?? null }
      })
    )
    setVatDefaultStep(transform({ plan }, ({ plan }) => plan?.to ?? null))
    releaseLockStep({ key: VAT_LOCK.key })
    return new WorkflowResponse(input.rate_id)
  }
)
