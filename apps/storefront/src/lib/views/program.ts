import "server-only"
import { cache } from "react"
import type { StoreProductSection } from "@qticaret/types"
import type { StoreProgram } from "@qticaret/types/section-program"
import { programTagsOf } from "@qticaret/types/section-program"
import { variantOf } from "@qticaret/types/section-variants"
import type { HomeSectionView, ProgramStepView, Translate } from "@qticaret/ui"
import { isStoreApiError } from "@/lib/store-api/errors"
import { storeGet } from "@/lib/store-api/server"
import { imageView } from "./image"
import type { ProductContext } from "./section-data"

type ProgramSection = Extract<StoreProductSection, { type: "program" }>

/**
 * A dated product's program (adr/0078) as the backend gives it, once per
 * request; null when it has none, the shop has dated sales off (the route
 * answers 404 then) or the read fails: the page stays up without it.
 */
export const productProgram = cache(async (id: string): Promise<StoreProgram | null> => {
  try {
    const { program } = await storeGet<{ program: StoreProgram | null }>(
      `/store/products/${encodeURIComponent(id)}/program`
    )
    return program
  } catch (error) {
    if (isStoreApiError(error)) {
      return null
    }
    throw error
  }
})

/** Each step in words: its own label, else numbered by the product's unit; its tags named. */
export function programSteps(program: StoreProgram, t: Translate): ProgramStepView[] {
  const numbered = program.unit === "step" ? "product.program.step" : "product.program.day"
  return program.steps.map((step, index) => ({
    label: step.label?.trim() ? step.label : t(numbered, { n: index + 1 }),
    title: step.title,
    bodyHtml: step.body_html?.trim() ? step.body_html : null,
    image: step.image ? imageView(step.image, step.title) : null,
    tags: programTagsOf(step.tags).map((key) => ({
      key,
      label: t(`product.program.tags.${key}`),
    })),
  }))
}

/**
 * The product page's program section: its steps from the product, drawn as
 * the shop chose (a variant this build does not know reads as the
 * timeline). None without a product or without steps: an empty program is
 * not drawn (adr/0078, the simple alternative).
 */
export async function programView(
  section: ProgramSection,
  t: Translate,
  product: ProductContext | undefined
): Promise<HomeSectionView | null> {
  if (!product) {
    return null
  }
  const program = await productProgram(product.id)
  if (!program || program.steps.length === 0) {
    return null
  }
  return {
    id: section.id,
    type: "program",
    title: section.title?.trim() ? section.title : t("product.program.title"),
    variant: variantOf("program", section.variant),
    steps: programSteps(program, t),
  }
}
