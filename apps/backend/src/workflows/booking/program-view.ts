import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { programImageUrls, programOf } from "../../lib/booking/program"
import type { ProgramTag, ProgramUnit } from "../../lib/booking/program"
import { renderDoc } from "../../lib/content"
import { MEDIA_MODULE } from "../../modules/media"
import type MediaModuleService from "../../modules/media/service"

type Container = Pick<MedusaContainer, "resolve">

interface ProductRow {
  id: string
  status?: string | null
  sales_channels?: ({ id: string } | null)[] | null
  product_extension?: { booking_mode?: string | null } | null
  bookable?: { program?: unknown } | null
}

const productOf = async (container: Container, productId: string, fields: string[]) => {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product",
    fields: ["id", "product_extension.booking_mode", "bookable.program", ...fields],
    filters: { id: productId },
  })
  return data[0] as ProductRow | undefined
}

/** A product's program as the panel edits it (adr/0078): none yet reads as no steps, by day. */
export async function readProgram(container: Container, productId: string) {
  const product = await productOf(container, productId, [])
  if (!product) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "catalog.product_unknown")
  }
  return {
    booking_mode: product.product_extension?.booking_mode ?? "none",
    program: programOf(product.bookable?.program) ?? { unit: "day" as const, steps: [] },
  }
}

/** A program picture as the storefront draws it: what the media library knows of it. */
export interface StoreProgramImage {
  url: string
  alt: string | null
  width: number | null
  height: number | null
  derivatives: unknown
}

export interface StoreProgramStep {
  label: string | null
  title: string
  body_html: string | null
  image: StoreProgramImage | null
  tags: ProgramTag[]
}

export interface StoreProgram {
  unit: ProgramUnit
  steps: StoreProgramStep[]
}

/**
 * GET /store/products/:id/program (adr/0078): a published dated product's
 * program on this storefront, each step's body rendered as a page's
 * (adr/0019, escaped and narrowed), its picture with its sizes and
 * versions. Null when the product is not dated or has no steps; another
 * product, a draft or one off this storefront's channels reads as unknown.
 */
export async function storeProductProgram(
  container: Container,
  productId: string,
  salesChannelIds: readonly string[]
): Promise<StoreProgram | null> {
  const product = await productOf(container, productId, ["status", "sales_channels.id"])
  const listed = (product?.sales_channels ?? []).some((channel) =>
    salesChannelIds.includes(channel?.id ?? "")
  )
  if (product?.status !== "published" || !listed) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "catalog.product_unknown")
  }
  const program =
    product.product_extension?.booking_mode === "departure"
      ? programOf(product.bookable?.program)
      : null
  if (!program) {
    return null
  }
  const urls = programImageUrls(program)
  const assets = urls.length
    ? await container
        .resolve<MediaModuleService>(MEDIA_MODULE)
        .listMediaAssets(
          { url: urls },
          { select: ["url", "alt", "width", "height", "derivatives"] }
        )
    : []
  const known = new Map(assets.map((asset) => [asset.url, asset]))
  return {
    unit: program.unit,
    steps: program.steps.map((step) => {
      const asset = step.image ? known.get(step.image.url) : undefined
      return {
        label: step.label,
        title: step.title,
        body_html: step.body ? renderDoc(step.body) : null,
        // A picture taken out of the library since is left out, not drawn broken
        image:
          step.image && asset
            ? {
                url: asset.url,
                alt: step.image.alt ?? asset.alt ?? null,
                width: asset.width ?? null,
                height: asset.height ?? null,
                derivatives: asset.derivatives ?? null,
              }
            : null,
        tags: step.tags,
      }
    }),
  }
}
