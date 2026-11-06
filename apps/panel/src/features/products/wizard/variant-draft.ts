import type { MeasureName } from "@/features/products/detail/measures"
import type {
  VariantImage,
  VariantValues as DialogValues,
} from "@/features/products/detail/variant-values"
import { parseMeasureInput } from "@/lib/money-input"
import type { WizardValues } from "./schema"

/**
 * A new product's variant in the product page's variant dialog: the
 * wizard's row as the dialog's values, and back. The product's pictures
 * are the ones added in the form, known by their address; a variant's own
 * pictures are tied when the product is saved (`create-product.ts`).
 */

type Row = WizardValues["variants"][number]
type Images = WizardValues["images"]

/** The row's own pictures still in the gallery, in the gallery's order. */
export function ownImageUrls(row: Pick<Row, "image_urls">, images: Images): string[] {
  const own = new Set(row.image_urls)
  return images.flatMap((image) => (own.has(image.url) ? [image.url] : []))
}

/** "Renk: Mor · Boy: 18 cm": the row's values with their options' names. */
export const draftName = (row: Pick<Row, "options" | "title">): string =>
  Object.entries(row.options)
    .map(([title, value]) => `${title}: ${value}`)
    .join(" · ") || row.title

/** The row as the dialog edits it; preorder is the wizard's own switch for the product. */
export function draftValues(values: WizardValues, index: number): DialogValues | null {
  const row = values.variants[index]
  if (!row) {
    return null
  }
  const own = new Set(ownImageUrls(row, values.images))
  return {
    price: row.price,
    stock: row.stock,
    backorder: values.allow_backorder,
    cost: row.cost,
    sku: row.sku,
    gtin: row.ean,
    mpn: row.mpn,
    weight: row.weight,
    length: row.length,
    width: row.width,
    height: row.height,
    applyAll: false,
    images: values.images.map((image): VariantImage => ({
      key: image.url,
      url: image.url,
      // In the form already: untied, it stays in the gallery (one picked in the dialog leaves)
      imageId: image.id,
      mediaId: null,
      alt: "",
      tied: own.has(image.url),
    })),
  }
}

/** The other rows each picture is tied to (their titles), by the picture's address. */
export function draftTies(values: WizardValues, index: number): Map<string, string[]> {
  return new Map(
    values.images.map((image) => [
      image.url,
      values.variants.flatMap((row, at) =>
        at !== index && row.image_urls.includes(image.url) ? [row.title] : []
      ),
    ])
  )
}

/** The product's parcel as typed, shown where the variant has none of its own. */
export const draftMeasures = (
  values: Pick<WizardValues, MeasureName>
): Record<MeasureName, number | null> => ({
  weight: parseMeasureInput(values.weight),
  length: parseMeasureInput(values.length),
  width: parseMeasureInput(values.width),
  height: parseMeasureInput(values.height),
})

/**
 * The form after the dialog's "Kaydet": the row takes what was typed, the
 * gallery the dialog's order and the pictures added from the library, and
 * (when asked) every other row the price.
 */
export function applyDraft(
  values: WizardValues,
  index: number,
  next: DialogValues
): Pick<WizardValues, "images" | "variants"> {
  const images = next.images.map((image) => ({
    id: image.imageId ?? image.mediaId ?? image.url,
    url: image.url,
  }))
  const variants = values.variants.map((row, at) =>
    at === index
      ? {
          ...row,
          price: next.price,
          stock: next.stock,
          cost: next.cost,
          sku: next.sku,
          ean: next.gtin,
          mpn: next.mpn,
          weight: next.weight,
          length: next.length,
          width: next.width,
          height: next.height,
          image_urls: next.images.flatMap((image) => (image.tied ? [image.url] : [])),
        }
      : next.applyAll
        ? { ...row, price: next.price }
        : row
  )
  return { images, variants }
}
