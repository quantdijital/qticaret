import type { MedusaContainer } from "@medusajs/framework/types"
import { fakeVkn, seededRandom } from "@qticaret/testing"
import { EINVOICE_MODULE } from "../../src/modules/einvoice"
import type EinvoiceModuleService from "../../src/modules/einvoice/service"
import { advanceOrder } from "../../src/scripts/seed/orders/advance"
import { placeOrder } from "../../src/scripts/seed/orders/place"
import { createAdminUser } from "./admin"
import { startBirfaturaFiles } from "./birfatura"
import type { BirfaturaFiles } from "./birfatura"
import { eventually } from "./eventually"
import type { HttpClient } from "./http"
import { stockShop, stockedProduct } from "./stock"
import type { StockShop } from "./stock"
import { loadTrAddressFixture } from "./tr-address"

const carrier = { title: "Örnek Kargo A.Ş.", tax_id: fakeVkn(seededRandom(72)) }

/**
 * A shop invoicing through BirFatura, for the adr/0072 suites: its owner,
 * a product, BirFatura's file server, and the steps the suites share.
 * Call `hooks()` inside the test runner's suite.
 */
export function birfaturaShop(http: HttpClient, getContainer: () => MedusaContainer) {
  let shop: StockShop
  let variantId: string
  let files: BirfaturaFiles
  const state = {} as { owner: Awaited<ReturnType<typeof createAdminUser>>; files: BirfaturaFiles }

  const einvoice = () => getContainer().resolve<EinvoiceModuleService>(EINVOICE_MODULE)
  const invoiceOf = async (orderId: string, sourceId = orderId) =>
    (await einvoice().listInvoices({ order_id: orderId, source_id: sourceId }))[0]

  // The test shop sends no e-mail (a customer message is read as kept, skipped),
  // whatever transport the machine's environment names (as einvoice-issue.spec.ts)
  const transport = process.env["EMAIL_TRANSPORT"]

  const hooks = () => {
    beforeAll(async () => {
      Reflect.deleteProperty(process.env, "EMAIL_TRANSPORT")
      files = await startBirfaturaFiles()
      state.files = files
      process.env["BIRFATURA_BASE_URL"] = files.origin
    })
    afterAll(async () => {
      Reflect.deleteProperty(process.env, "BIRFATURA_BASE_URL")
      if (transport !== undefined) {
        process.env["EMAIL_TRANSPORT"] = transport
      }
      await files.close()
    })
    beforeEach(async () => {
      const container = getContainer()
      await loadTrAddressFixture(container)
      shop = await stockShop(container)
      state.owner = await createAdminUser(http, container)
      variantId = (await stockedProduct(container, shop, `bf-${String(Date.now())}`, 20, 120))
        .variantId
      await http.post(
        "/admin/platform-settings/seo",
        { canonical_host: "magaza.example.com" },
        { headers: state.owner.headers }
      )
    })
  }

  const settings = (provider: string) =>
    http.post(
      "/admin/platform-settings/invoicing",
      { provider, trigger: "placed", carriers: { manual: carrier }, series: "ABC" },
      { headers: state.owner.headers }
    )

  const makeToken = async () =>
    (
      await http.post<{ token: string }>(
        "/admin/einvoice/birfatura/token",
        {},
        { headers: state.owner.headers }
      )
    ).data.token

  /** An order, paid and queued for BirFatura unless `paid` is false; its id and number. */
  const order = async (paid = true) => {
    const id = await placeOrder(getContainer(), {
      regionId: shop.regionId,
      salesChannelId: shop.salesChannelId,
      shippingOptionId: shop.shippingOptionId,
      items: [{ variant_id: variantId, quantity: 1 }],
      email: "ayse@example.com",
      address: {
        first_name: "Ayşe",
        last_name: "Yılmaz",
        address_1: "Demo Sokak 1",
        province: "İstanbul",
        city: "Kadıköy",
        phone: "+905551112233",
      },
    })
    if (paid) {
      await advanceOrder(getContainer(), id, "to_ship")
      await eventually(() => invoiceOf(id), Boolean)
    }
    const { data } = await getContainer()
      .resolve("query")
      .graph({ entity: "order", fields: ["display_id"], filters: { id } })
    // Read loosely: whatever type the generated graph types give it, it is the order's number
    return { id, number: Number((data[0] as { display_id?: unknown } | undefined)?.display_id) }
  }

  return { state, hooks, einvoice, invoiceOf, settings, makeToken, order }
}
