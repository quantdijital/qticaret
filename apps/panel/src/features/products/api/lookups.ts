import { queryOptions } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"

/** What a new product needs to know about the shop: defaults and choices. */

export const categoriesQuery = () =>
  queryOptions({
    queryKey: ["lookups", "categories"],
    queryFn: async () =>
      (
        await sdk.admin.productCategory.list({
          fields: "id,name,handle,parent_category_id,rank",
          limit: 500,
        })
      ).product_categories,
    staleTime: 5 * 60_000,
  })

export type CategoryOption = Awaited<
  ReturnType<typeof sdk.admin.productCategory.list>
>["product_categories"][number]

export interface ShopDefaults {
  salesChannelId: string | null
  locationId: string | null
  shippingProfileId: string | null
}

export const shopDefaultsQuery = () =>
  queryOptions({
    queryKey: ["lookups", "shop-defaults"],
    queryFn: async (): Promise<ShopDefaults> => {
      const [{ stores }, { shipping_profiles: profiles }] = await Promise.all([
        sdk.admin.store.list({ fields: "id,default_sales_channel_id,default_location_id" }),
        sdk.admin.shippingProfile.list({ fields: "id,type" }),
      ])
      const store = stores[0]
      return {
        salesChannelId: store?.default_sales_channel_id ?? null,
        locationId: store?.default_location_id ?? null,
        shippingProfileId:
          (profiles.find((profile) => profile.type === "default") ?? profiles[0])?.id ?? null,
      }
    },
    staleTime: 5 * 60_000,
  })
