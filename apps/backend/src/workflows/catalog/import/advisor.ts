import { missingDimensions, variantGtin } from "../../../lib/catalog"
import type { SheetProduct } from "../../../lib/catalog-sheet"
import { assess } from "../../../lib/seo/advisor"
import type { AdvisorFacts, Assessment } from "../../../lib/seo/advisor"
import {
  SHORT_EXCERPT,
  excerpt,
  plainText,
  priceSentence,
  resolveSeoPayload,
} from "../../../lib/seo/resolve"
import type { SeoShop } from "../../../lib/seo/resolve"
import type { ImportReferences } from "./references"

/**
 * A new product's SEO standing before it is made (F3.9, docs/14): the
 * advisor's rules over what the row says, its title and description from
 * the shop's templates as the storefront would show them. It has no
 * images yet (they are added in the panel), and the rules say so. A
 * product that exists is assessed as usual once it is saved.
 */
export function sheetAssessment(
  sheet: SheetProduct,
  refs: ImportReferences,
  shop: SeoShop
): Assessment {
  const { fields } = sheet
  const brand = fields.brand ? (refs.brands.get(fields.brand)?.name ?? null) : null
  const firstCategory = fields.categories?.[0]
  const category = firstCategory ? (refs.categories.get(firstCategory)?.name ?? null) : null
  const description = fields.description ?? ""
  const payload = resolveSeoPayload(
    {
      kind: "product",
      path: `/${sheet.handle}`,
      name: fields.title ?? sheet.handle,
      description: plainText(description),
      tokens: {
        kategori: category,
        kısa_açıklama: excerpt(description, SHORT_EXCERPT),
        fiyat_cümlesi: priceSentence(sheet.variants.flatMap((variant) => variant.price ?? [])),
        öne_çıkan_attribute: null,
        marka: brand,
        kargo_cümlesi: null,
      },
      overrides: {
        seo_title: fields.seo_title ?? null,
        seo_description: fields.seo_description ?? null,
        canonical_override: null,
        robots_override: null,
        og_image_alt: null,
      },
      image: null,
      trail: [],
    },
    shop
  )
  const facts: AdvisorFacts = {
    kind: "product",
    name: fields.title ?? sheet.handle,
    handle: sheet.handle,
    title: payload.title,
    titleIsOwn: Boolean(fields.seo_title),
    description: payload.description,
    descriptionIsOwn: Boolean(fields.seo_description),
    body: plainText(description),
    bodyHtml: description,
    focusKeyword: fields.focus_keyword ?? null,
    duplicates: { title: 0, description: 0 },
    noindex: false,
    product: {
      images: 0,
      imagesWithoutAlt: 0,
      variants: sheet.variants.length,
      unpriced: sheet.variants.filter((variant) => !(variant.price && variant.price > 0)).length,
      unidentified: sheet.variants.filter(
        (variant) => !variantGtin({ ean: variant.barcode ?? null, upc: null, barcode: null })
      ).length,
      brand,
      categories: fields.categories?.length ?? 0,
      // The import makes the first category the primary one
      primaryCategory: (fields.categories?.length ?? 0) > 0,
      physical: true,
      missingDimensions: missingDimensions(fields).length > 0,
      missingAttributes: [],
    },
  }
  return assess(facts)
}
