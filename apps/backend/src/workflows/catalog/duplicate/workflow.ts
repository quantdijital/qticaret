import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
  transform,
  when,
} from "@medusajs/framework/workflows-sdk"
import { createProductsWorkflow } from "@medusajs/medusa/core-flows"
import { setProductBrandWorkflow } from "../../brands/workflows"
import { upsertProductAttributesWorkflow } from "../../product-attributes/upsert-product-attributes"
import { upsertSeoMetaWorkflow } from "../../seo/upsert-seo-meta"
import { setProductCatalogWorkflow } from "../set-product-catalog"
import type { SetProductCatalogInput } from "../steps/plan-product-catalog"
import { planProductCopyStep } from "./plan-step"
import type { ProductCopyPlan } from "./plan-step"
import { optionKey } from "./plan"

interface CopyRow {
  options?: ({ id: string; title: string } | null)[] | null
  variants?:
    | ({
        id: string
        options?: ({ value: string; option_id?: string | null } | null)[] | null
      } | null)[]
    | null
}

/**
 * The copy's catalog save: the source's fields, and its unit costs by the
 * copy's own variant ids, matched by their option values. Reads only.
 */
const copyCatalogInputStep = createStep(
  "catalog-copy-catalog-input",
  async (input: { product_id: string; plan: ProductCopyPlan }, { container }) => {
    const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: "product",
      fields: [
        "options.id",
        "options.title",
        "variants.id",
        "variants.options.value",
        "variants.options.option_id",
      ],
      filters: { id: input.product_id },
    })
    const copy = (data[0] ?? {}) as CopyRow
    const titles = new Map(
      (copy.options ?? []).flatMap((option) => (option ? [[option.id, option.title]] : []))
    )
    const variants = Object.fromEntries(
      (copy.variants ?? []).flatMap((variant) => {
        if (!variant) {
          return []
        }
        const options = Object.fromEntries(
          (variant.options ?? []).flatMap((value) => {
            const title = value?.option_id ? titles.get(value.option_id) : undefined
            return value && title ? [[title, value.value]] : []
          })
        )
        const cost = input.plan.costs[optionKey(options)]
        return cost === undefined ? [] : [[variant.id, { cost }]]
      })
    )
    const catalog: SetProductCatalogInput = {
      product_id: input.product_id,
      ...input.plan.catalog,
      ...(Object.keys(variants).length > 0 ? { variants } : {}),
    }
    return new StepResponse({ catalog, saves: Object.keys(catalog).length > 1 })
  }
)

/**
 * Copies a product as a draft (owner 2026-11-06, "Kopyala"; `plan.ts` says
 * what goes with it): Medusa's create with its own hooks (the copy's
 * address claimed, backorder levels, variant pictures tied), then the
 * catalog fields, brand, SEO fields and attributes through their own
 * workflows. Each undoes itself when a later one fails, the create too:
 * nothing of a copy that failed halfway is left.
 */
export const duplicateProductWorkflow = createWorkflow(
  "catalog-duplicate-product",
  (input: { product_id: string }) => {
    const plan = planProductCopyStep(input)

    const created = createProductsWorkflow.runAsStep({
      input: transform({ plan }, ({ plan }) => ({
        products: [plan.create as never],
        ...(plan.variantImages.length > 0
          ? { additional_data: { variant_images: plan.variantImages } }
          : {}),
      })),
    })
    const productId = transform({ created }, ({ created }) => created[0]?.id ?? "")

    const catalog = copyCatalogInputStep(
      transform({ plan, productId }, ({ plan, productId }) => ({ product_id: productId, plan }))
    )
    when("catalog-copy-catalog", { catalog }, ({ catalog }) => catalog.saves).then(() => {
      setProductCatalogWorkflow.runAsStep({
        input: transform({ catalog }, ({ catalog }) => catalog.catalog),
      })
    })

    when("catalog-copy-brand", { plan }, ({ plan }) => plan.brand_id !== null).then(() => {
      setProductBrandWorkflow.runAsStep({
        input: transform({ plan, productId }, ({ plan, productId }) => ({
          product_id: productId,
          brand_id: plan.brand_id,
        })),
      })
    })

    when("catalog-copy-seo", { plan }, ({ plan }) => plan.seo !== null).then(() => {
      upsertSeoMetaWorkflow.runAsStep({
        input: transform({ plan, productId }, ({ plan, productId }) => ({
          entity_type: "product" as const,
          entity_id: productId,
          values: plan.seo ?? {},
        })),
      })
    })

    when("catalog-copy-attributes", { plan }, ({ plan }) => plan.attributes !== null).then(() => {
      upsertProductAttributesWorkflow.runAsStep({
        input: transform({ plan, productId }, ({ plan, productId }) => ({
          product_id: productId,
          template_id: plan.attributes?.template_id ?? null,
          values: plan.attributes?.values ?? {},
        })),
      })
    })

    const result = transform({ plan, productId }, ({ plan, productId }) => ({
      id: productId,
      handle: plan.handle,
      title: plan.create["title"] as string,
      source_id: plan.source_id,
    }))
    return new WorkflowResponse(result)
  }
)
