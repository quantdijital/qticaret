import { useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"
import { parseMoneyInput } from "@/lib/money-input"
import type { ShopDefaults } from "@/features/products/api/lookups"
import { DEFAULT_VARIANT_KEY } from "./schema"
import type { WizardValues } from "./schema"

const CURRENCY = "try"

interface CreateInput {
  values: WizardValues
  publish: boolean
  defaults: ShopDefaults
  /** The option and value a product without options gets (Medusa needs one). */
  defaultOption: { title: string; value: string }
}

const measure = (text: string) => {
  const value = parseMoneyInput(text)
  return value && value > 0 ? value : undefined
}

function productBody({ values, publish, defaults, defaultOption }: CreateInput) {
  const options = values.has_options
    ? values.options.map((option) => ({ title: option.title, values: option.values }))
    : [{ title: defaultOption.title, values: [defaultOption.value] }]
  const dimensions = Object.fromEntries(
    (["weight", "length", "width", "height"] as const).flatMap((field) => {
      const value = measure(values[field])
      return value === undefined ? [] : [[field, value]]
    })
  )
  return {
    title: values.title.trim(),
    ...(values.handle.trim() ? { handle: values.handle.trim() } : {}),
    description: values.description.trim(),
    status: publish ? ("published" as const) : ("draft" as const),
    images: values.images.map((image) => ({ url: image.url })),
    ...(values.images[0] ? { thumbnail: values.images[0].url } : {}),
    categories: values.category_ids.map((id) => ({ id })),
    ...(values.type_id ? { type_id: values.type_id } : {}),
    ...(defaults.shippingProfileId ? { shipping_profile_id: defaults.shippingProfileId } : {}),
    ...(defaults.salesChannelId ? { sales_channels: [{ id: defaults.salesChannelId }] } : {}),
    ...dimensions,
    options,
    variants: values.variants.map((variant, index) => ({
      title: variant.key === DEFAULT_VARIANT_KEY ? values.title.trim() : variant.title,
      // The order the options were typed in (S, M, L), kept on the product page
      variant_rank: index,
      ...(variant.sku.trim() ? { sku: variant.sku.trim() } : {}),
      ...(variant.ean.trim() ? { ean: variant.ean.trim() } : {}),
      manage_inventory: values.manage_inventory,
      allow_backorder: values.allow_backorder,
      prices: [{ currency_code: CURRENCY, amount: parseMoneyInput(variant.price) ?? 0 }],
      options:
        variant.key === DEFAULT_VARIANT_KEY
          ? { [defaultOption.title]: defaultOption.value }
          : variant.options,
    })),
  }
}

// The stock typed per variant, at the shop's default location
async function stockLevels(productId: string, values: WizardValues, locationId: string) {
  const { product } = await sdk.admin.product.retrieve(productId, {
    fields: "variants.id,variants.title,variants.inventory_items.inventory_item_id",
  })
  const stockByTitle = new Map(
    values.variants.map((variant) => [
      variant.key === DEFAULT_VARIANT_KEY ? values.title.trim() : variant.title,
      Number(variant.stock),
    ])
  )
  const create = (product.variants ?? []).flatMap((variant) =>
    (variant.inventory_items ?? []).map((item) => ({
      inventory_item_id: item.inventory_item_id,
      location_id: locationId,
      stocked_quantity: stockByTitle.get(variant.title ?? "") ?? 0,
    }))
  )
  if (create.length > 0) {
    await sdk.admin.inventoryItem.batchInventoryItemsLocationLevels({ create })
  }
}

export interface CreateResult {
  productId: string
  /** The product was saved but its stock could not be; the page says so. */
  stockFailed: boolean
}

/** Creates the product, then its stock at the default location. */
export function useCreateProduct() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateInput): Promise<CreateResult> => {
      const { product } = await sdk.admin.product.create(productBody(input))
      let stockFailed = false
      if (input.values.manage_inventory && input.defaults.locationId) {
        try {
          await stockLevels(product.id, input.values, input.defaults.locationId)
        } catch {
          // The product stands; its stock is set on its page
          stockFailed = true
        }
      }
      return { productId: product.id, stockFailed }
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["products"] })
      await client.invalidateQueries({ queryKey: ["dashboard"] })
    },
  })
}
