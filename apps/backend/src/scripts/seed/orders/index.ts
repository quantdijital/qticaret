import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { Knex } from "@medusajs/framework/mikro-orm/knex"
import { logger } from "../../../lib/logging"
import { TR_ADDRESS_MODULE } from "../../../modules/tr-address"
import type TrAddressModuleService from "../../../modules/tr-address/service"
import { DEMO_PRODUCTS, DEMO_SHIPPING_OPTIONS } from "../data"
import { advanceOrder } from "./advance"
import { placeOrder } from "./place"
import { planDemoOrders } from "./plan"

const DAYS = 90
// Some products sell better: the best-seller list should have a shape
const POPULARITY: Record<string, number> = {
  "seramik-kupa": 3,
  "pamuklu-tisort": 2.6,
  "el-dokuma-havlu": 2.2,
  "yun-bere": 1.8,
  "keten-gomlek": 1.5,
  "bambu-kesme-tahtasi": 1.4,
  "cam-saklama-kabi-seti": 1.2,
  "keten-masa-ortusu": 1,
  "organik-tam-bugday-unu-1-kg": 0.9,
  "manuel-kahve-degirmeni": 0.7,
}
// Where parcels go: the biggest provinces, by plate code
const PROVINCE_CODES = ["34", "06", "35", "16", "07", "42", "01", "41", "26", "61"]

type Row = Record<string, string | undefined> & { variants?: ({ id: string } | null)[] }

async function first(container: MedusaContainer, entity: string, fields: string[], filters = {}) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity, fields, filters })
  return data as Row[]
}

async function catalog(container: MedusaContainer) {
  const handles = DEMO_PRODUCTS.map((product) => product.handle)
  const products = await first(container, "product", ["handle", "variants.id"], { handle: handles })
  return products.flatMap((product) => {
    const variants = product.variants ?? []
    const weight = POPULARITY[product["handle"] ?? ""] ?? 1
    return variants.flatMap((variant) =>
      variant ? [{ id: variant.id, weight: weight / variants.length }] : []
    )
  })
}

// Real il/ilçe pairs from the reference data, so the TR address rules pass;
// none when the data is not imported (the address then has no province)
async function places(container: MedusaContainer) {
  const service = container.resolve<TrAddressModuleService>(TR_ADDRESS_MODULE)
  const provinces = await service.listTrProvinces(
    { code: PROVINCE_CODES },
    { relations: ["districts"] }
  )
  return provinces.flatMap((province) =>
    province.districts
      .slice(0, 3)
      .map((district) => ({ province: province.name, city: district.name }))
  )
}

async function context(container: MedusaContainer) {
  const [regions, stores, options] = await Promise.all([
    first(container, "region", ["id"], { currency_code: "try" }),
    first(container, "store", ["default_sales_channel_id"]),
    first(container, "shipping_option", ["id", "name"], {
      name: DEMO_SHIPPING_OPTIONS.map((option) => option.name),
    }),
  ])
  const optionId = (name: string) => options.find((option) => option["name"] === name)?.["id"] ?? ""
  const regionId = regions[0]?.["id"] ?? ""
  const salesChannelId = stores[0]?.["default_sales_channel_id"] ?? ""
  const standard = optionId(DEMO_SHIPPING_OPTIONS[0].name)
  if (!regionId || !salesChannelId || !standard) {
    throw new Error("seed: run seed:demo first (region, sales channel, shipping options)")
  }
  return {
    regionId,
    salesChannelId,
    standard,
    express: optionId(DEMO_SHIPPING_OPTIONS[1].name) || standard,
  }
}

/**
 * Demo orders for the dashboard (dev only): about 90 days of orders placed
 * through checkout, then captured, shipped, delivered or canceled. Runs
 * only on a database without orders, unless `append` says otherwise. The dates are moved into the past
 * with an UPDATE, which no workflow offers; demo data only.
 */
export async function seedDemoOrders(
  container: MedusaContainer,
  { append = false, days = DAYS }: { append?: boolean; days?: number } = {}
): Promise<number> {
  if (!append && (await first(container, "order", ["id"])).length > 0) {
    logger.info({ event: "seed.orders_kept" }, "orders exist, keeping them")
    return 0
  }
  const [variants, destinations, ctx] = await Promise.all([
    catalog(container),
    places(container),
    context(container),
  ])
  const plan = planDemoOrders({
    now: new Date(),
    days,
    weights: variants.map((variant) => variant.weight),
    places: destinations.length,
  })
  const knex = container.resolve<Knex>(ContainerRegistrationKeys.PG_CONNECTION)
  for (const [index, order] of plan.entries()) {
    const place = destinations[order.place]
    const orderId = await placeOrder(container, {
      regionId: ctx.regionId,
      salesChannelId: ctx.salesChannelId,
      shippingOptionId: order.express ? ctx.express : ctx.standard,
      items: order.lines.map((line) => ({
        variant_id: variants[line.variant]?.id ?? "",
        quantity: line.quantity,
      })),
      address: {
        ...order.customer,
        address_1: "Demo Sokak No: 1",
        ...(place ? { province: place.province, city: place.city } : {}),
      },
    })
    await advanceOrder(container, orderId, order.stage)
    await knex("order")
      .where({ id: orderId })
      .update({
        created_at: order.at,
        updated_at: order.at,
        ...(order.stage === "canceled" ? { canceled_at: order.at } : {}),
      })
    if ((index + 1) % 25 === 0) {
      logger.info(
        { event: "seed.orders_progress", done: index + 1, total: plan.length },
        "placing demo orders"
      )
    }
  }
  logger.info({ event: "seed.orders_created", count: plan.length }, "created demo orders")
  return plan.length
}
