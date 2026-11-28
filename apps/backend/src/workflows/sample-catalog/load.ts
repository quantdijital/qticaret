import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
  transform,
} from "@medusajs/framework/workflows-sdk"
import {
  acquireLockStep,
  createProductCategoriesWorkflow,
  releaseLockStep,
} from "@medusajs/medusa/core-flows"
import { sectorPack } from "@qticaret/sector-packs"
import type { SampleCatalog } from "@qticaret/sector-packs"
import { logger } from "../../lib/logging"
import { planSampleLoad } from "../../lib/sample-catalog/load-plan"
import type { SampleLoadPlan } from "../../lib/sample-catalog/load-plan"
import { SAMPLE_KEY, sampleMark } from "../../lib/sample-catalog/mark"
import { writeSampleProduct } from "../../lib/sample-catalog/write-product"
import { liveProductIds, setOpened, undoSampleCategories, undoSampleProducts } from "./undo"

export const SAMPLE_LOCK = "sample-catalog"

const samplesOf = (pack: string): SampleCatalog => {
  const samples = sectorPack(pack)?.samples
  if (!samples) {
    throw new Error(`sample-catalog: ${pack} has no samples`)
  }
  return samples
}

/** What the load will do, read before any write; refuses an unknown, foreign or loaded set. */
export const planSampleLoadStep = createStep(
  "sample-catalog-plan-load",
  async (input: { pack: string }, { container }) =>
    new StepResponse(await planSampleLoad(container, input.pack))
)

interface CategoriesDone {
  category_ids: Record<string, string>
  made: string[]
  opened: string[]
}

/** One category made, shown, marked as the set's with its own id. */
async function makeCategory(
  container: MedusaContainer,
  plan: SampleLoadPlan,
  category: SampleLoadPlan["make"][number],
  ids: Record<string, string>
): Promise<string> {
  const parent = category.parent ? ids[category.parent] : undefined
  const { result } = await createProductCategoriesWorkflow(container).run({
    input: {
      product_categories: [
        {
          name: category.name,
          handle: category.handle,
          is_active: true,
          metadata: { [SAMPLE_KEY]: plan.tag },
          ...(parent ? { parent_category_id: parent } : {}),
          ...(category.description ? { description: category.description } : {}),
        },
      ],
    },
  })
  const id = result[0]?.id
  if (!id) {
    throw new Error(`sample-catalog: category ${category.handle} was not made`)
  }
  await container
    .resolve(Modules.PRODUCT)
    .updateProductCategories(id, { metadata: sampleMark(plan.tag, id, new Date()) })
  return id
}

/**
 * The categories the products need and the shop lacks, made (shown, the
 * set's mark on them), and the pack's hidden ones a sample goes into,
 * shown. A failure part way takes back what this step did; an undo later
 * takes back all of it.
 */
export const makeSampleCategoriesStep = createStep(
  "sample-catalog-make-categories",
  async (plan: SampleLoadPlan, { container }) => {
    const done: CategoriesDone = { category_ids: { ...plan.category_ids }, made: [], opened: [] }
    try {
      for (const category of plan.make) {
        const id = await makeCategory(container, plan, category, done.category_ids)
        done.made.push(id)
        done.category_ids[category.handle] = id
      }
      for (const category of plan.open) {
        await setOpened(container, [category.id], true, plan.tag)
        done.opened.push(category.id)
      }
    } catch (error) {
      await undoSampleCategories(container, done.made, done.opened)
      throw error
    }
    return new StepResponse(done, { made: done.made, opened: done.opened })
  },
  async (undo, { container }) => {
    if (!undo) {
      return
    }
    await undoSampleCategories(container, undo.made, undo.opened)
  }
)

/**
 * The products, one after another (each through the panel's workflows);
 * a failure part way takes back the ones made so far, an undo later all.
 */
export const writeSampleProductsStep = createStep(
  "sample-catalog-write-products",
  async (input: { plan: SampleLoadPlan; category_ids: Record<string, string> }, { container }) => {
    const { plan } = input
    const samples = samplesOf(plan.pack)
    const made: string[] = []
    const context = {
      container,
      tag: plan.tag,
      dir: samples.dir,
      salesChannelId: plan.sales_channel_id,
      categoryIds: new Map(Object.entries(input.category_ids)),
      templateIds: new Map(Object.entries(plan.template_ids)),
      now: new Date(),
    }
    try {
      for (const product of samples.products) {
        await writeSampleProduct(
          context,
          product,
          plan.handles[product.handle] ?? product.handle,
          (id) => made.push(id)
        )
      }
    } catch (error) {
      await undoSampleProducts(container, made)
      throw error
    }
    return new StepResponse({ product_ids: made }, made)
  },
  async (made, { container }) => {
    if (!made?.length) {
      return
    }
    await undoSampleProducts(container, await liveProductIds(container, made))
  }
)

export interface LoadSampleCatalogResult {
  pack: string
  products: number
  categories_made: number
  categories_opened: number
}

/**
 * A pack's sample catalogue loaded into this shop (owner, 2026-11-28):
 * its categories, then its products with pictures, departures, program
 * and reviews, every record marked as a sample. One run at a time; any
 * step failing takes back the ones before.
 */
export const loadSampleCatalogWorkflow = createWorkflow(
  "sample-catalog-load",
  (input: { pack: string }) => {
    acquireLockStep({ key: SAMPLE_LOCK, timeout: 5, ttl: 600 })
    const plan = planSampleLoadStep(input)
    const categories = makeSampleCategoriesStep(plan)
    const products = writeSampleProductsStep(
      transform({ plan, categories }, ({ plan, categories }) => ({
        plan,
        category_ids: categories.category_ids,
      }))
    )
    releaseLockStep({ key: SAMPLE_LOCK })
    const result = transform(
      { plan, categories, products },
      ({ plan, categories, products }): LoadSampleCatalogResult => {
        logger.info(
          {
            event: "sample_catalog.loaded",
            pack: plan.pack,
            products: products.product_ids.length,
          },
          "sample catalogue loaded"
        )
        return {
          pack: plan.pack,
          products: products.product_ids.length,
          categories_made: categories.made.length,
          categories_opened: categories.opened.length,
        }
      }
    )
    return new WorkflowResponse(result)
  }
)
