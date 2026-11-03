import { expect, test } from "@playwright/test"
import type { Page } from "@playwright/test"
import { createTemporaryAdmin, removeTemporaryAdmin, signInAdmin } from "./admin"
import type { AdminApi } from "./admin"
import { stockedProduct } from "./catalog"
import { dismissCookies } from "./support"

/**
 * A payment link paid end to end (adr/0051). Staff make it through the
 * admin API (the panel's own calls, a temporary owner proving themselves
 * again); the guest opens `/ode/<token>`, goes on to a checkout whose cart
 * is locked to the link, and pays by card in the fake PayTR's frame
 * (`pnpm dev:paytr`). The link is then paid and the order names it. Its
 * line is a variant in stock the shop sells (`catalog.ts`), priced by the
 * link as the Store API prices it.
 *
 * The dev shop is set up for it and put back after: the flag on, then off
 * again; a storefront host for the share address while the shop has none,
 * then none again; the fake PayTR account connected when no account is, and
 * left so (it is the dev account). The order stays, as the bank transfer
 * test's do.
 */

const FLAG = "orders.payment_links"
// The share address is `https://<host>/ode/<token>`: its path opens on this storefront.
// A reserved name (RFC 2606) for a shop without a host, so it can lead nowhere else
const SHARE_HOST = "vitrin.test"
// `pnpm dev:paytr`'s account, fake and readable on purpose (packages/testing/src/dev/paytr.ts)
const DEV_PAYTR = {
  settings: { merchant_id: "100001", test_mode: true },
  secrets: { merchant_key: "gelistirme-sahte-anahtar", merchant_salt: "gelistirme-sahte-tuz" },
}
const GUEST = {
  first_name: "Uçtan",
  last_name: "Uca",
  email: `e2e-${String(Date.now())}@quantdijital.com`,
  phone: "05321234567",
}

interface LinkLine {
  title: string
  quantity: number
  unit_price: number
}

interface Link {
  id: string
  number: string
  status: string
  total: number
  order_id: string | null
  lines: LinkLine[]
}

const LIRA = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
/** As the storefront writes a link's kuruş: "899,00 TL". */
const lira = (kurus: number) => `${LIRA.format(kurus / 100)} TL`

type Undo = () => Promise<unknown>

/**
 * The flag on, a host for the share address, PayTR connected. What is
 * changed goes on `undo` as it is changed, so a failure half-way still puts it back.
 */
async function readyShop(api: AdminApi, undo: Undo[]): Promise<void> {
  const { features } = await api.get<{ features: { key: string; enabled: boolean }[] }>(
    "/admin/features"
  )
  if (features.find((each) => each.key === FLAG)?.enabled !== true) {
    await api.post(`/admin/features/${FLAG}`, { enabled: true })
    undo.push(() => api.post(`/admin/features/${FLAG}`, { enabled: false }))
  }
  const seo = await api.get<{ values: { canonical_host: string | null } }>(
    "/admin/platform-settings/seo"
  )
  if (!seo.values.canonical_host) {
    await api.post("/admin/platform-settings/seo", { canonical_host: SHARE_HOST })
    undo.push(() =>
      api.post("/admin/platform-settings/seo", { canonical_host: seo.values.canonical_host })
    )
  }
  const { accounts } = await api.get<{ accounts: { provider: string; state: string }[] }>(
    "/admin/integrations/credentials"
  )
  if (accounts.find((each) => each.provider === "paytr")?.state !== "connected") {
    const saved = await api.postProved<{ account: { state: string } }>(
      "/admin/integrations/credentials/paytr",
      DEV_PAYTR
    )
    expect(saved.account.state, "the fake PayTR answers the backend's check").toBe("connected")
  }
}

/** Checkout's address and shipping steps, as the bank transfer test fills them. */
async function addressAndShipping(page: Page): Promise<void> {
  await page.fill("#email", GUEST.email)
  await page.fill("#first_name", GUEST.first_name)
  await page.fill("#last_name", GUEST.last_name)
  await page.fill("#phone", GUEST.phone)
  await page.selectOption("#province", { index: 1 })
  await expect(page.locator("#district option")).not.toHaveCount(1)
  await page.selectOption("#district", { index: 1 })
  await expect(page.locator("#neighborhood option")).not.toHaveCount(1)
  await page.selectOption("#neighborhood", { index: 1 })
  await page.fill("#address_1", "Deneme Sokak No: 1")
  await page.locator("main form button[type=submit]").click()
  await expect(page).toHaveURL(/adim=kargo/)
  await page.locator("main form button[type=submit]").click()
  await expect(page).toHaveURL(/\/odeme$/)
}

/** No way to change a line: no minus, plus or remove. */
async function expectNoLineControls(page: Page): Promise<void> {
  await expect(page.getByRole("button", { name: "Adedi azalt" })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Adedi artır" })).toHaveCount(0)
  await expect(page.getByRole("button", { name: /ürününü sepetten kaldır$/ })).toHaveCount(0)
}

test("a guest pays a link the shop made: its page, a locked cart, the card in PayTR's frame, the link paid on its order", async ({
  page,
}) => {
  // Medusa's CLI makes and removes the run's admin (seconds each); the card's notice is the backend's
  test.setTimeout(240_000)
  const admin = createTemporaryAdmin()
  let api: AdminApi | null = null
  const undo: Undo[] = []
  let link: Link | null = null
  try {
    api = await signInAdmin(admin)
    const shop = api
    await readyShop(shop, undo)
    const product = await stockedProduct()

    // 1. Staff make the link (a step-up: 428 without the proof) and copy its address
    const made = await shop.postProved<{ payment_link: Link }>("/admin/payment-links", {
      guest: GUEST,
      lines: [{ variant_id: product.variant.id, quantity: 1 }],
    })
    link = made.payment_link
    expect(link.status).toBe("open")
    // The server prices the line (adr/0051 §2): the catalog's price now, as the Store API gives it
    expect(link.lines).toEqual([
      expect.objectContaining({
        title: product.title,
        quantity: 1,
        unit_price: product.variant.kurus,
      }),
    ])
    const { share } = await shop.get<{ share: { url: string | null } }>(
      `/admin/payment-links/${link.id}/share`
    )
    expect(share.url).toMatch(/^https:\/\/[^/]+\/ode\/pl_[^/]+$/)
    const sharePath = new URL(share.url ?? "").pathname

    // 2. The guest's page: greeting, the link's number, its line and total
    await page.goto(sharePath)
    await dismissCookies(page)
    await expect(page.getByText(`Merhaba ${GUEST.first_name},`)).toBeVisible()
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Sipariş ${link.number}`)
    const line = link.lines[0]
    expect(line).toBeDefined()
    const order = page.getByRole("region", { name: "Sipariş özeti" })
    await expect(order.getByRole("listitem")).toHaveCount(1)
    await expect(order.getByRole("listitem")).toContainText(line?.title ?? "")
    await expect(order.getByRole("listitem")).toContainText(
      `${String(line?.quantity)} × ${lira(line?.unit_price ?? 0)}`
    )
    await expect(
      order
        .locator("dl > div")
        .filter({ hasText: /^Toplam/ })
        .locator("dd")
    ).toHaveText(lira(link.total))
    await page.getByRole("button", { name: "Ödemeye geç" }).click()

    // 3. Checkout with the link's cart: its line as made, nothing to change it with
    await expect(page).toHaveURL(/\/odeme(\?|$)/)
    const summary = page.getByRole("complementary", { name: "Sipariş özeti" })
    await expect(summary).toContainText(line?.title ?? "")
    await expectNoLineControls(page)
    await page.goto("/sepet")
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sepetim")
    // The lock note (cart.payment_link_note) with its way out
    await expect(
      page.getByText("Bu sepet mağazanın size gönderdiği ödeme bağlantısından geldi")
    ).toBeVisible()
    await expect(page.getByRole("button", { name: /^Başka bir alışveriş için/ })).toBeVisible()
    await expect(page.getByText(`Adet: ${String(line?.quantity)}`)).toBeVisible()
    await expectNoLineControls(page)
    await expect(page.getByLabel("İndirim kodu")).toHaveCount(0)
    await page.goto("/odeme")
    await addressAndShipping(page)

    // 4. Card: PayTR's form in its frame (the fake's three outcomes), back to the order
    await page.locator('input[value="pp_paytr_paytr"]').check()
    const accept = page.locator('input[name="accept"]')
    if (await accept.count()) {
      await accept.check()
    }
    await page
      .locator("main form button[type=submit]")
      .filter({ hasText: "Kart bilgilerine geç" })
      .click()
    await expect(page).toHaveURL(/\/odeme\/kart$/)
    await page
      .frameLocator('iframe[title="Güvenli kart ödeme formu"]')
      .getByRole("button", { name: /^Ödemeyi onayla/ })
      .click()
    await expect(page).toHaveURL(/\/siparis\/order_[0-9A-Z]+\?token=.+&yeni=1/, {
      timeout: 60_000,
    })
    await expect(page.locator("h1")).toHaveText("Teşekkürler, siparişiniz alındı")
    const orderId = /\/siparis\/(order_[0-9A-Z]+)/.exec(page.url())?.[1] ?? ""

    // 5. The link is paid and names the order; the order names the link
    const linkId = link.id
    await expect
      .poll(
        async () =>
          (await shop.get<{ payment_link: Link }>(`/admin/payment-links/${linkId}`)).payment_link,
        { timeout: 30_000 }
      )
      .toMatchObject({ status: "paid", order_id: orderId })
    const { order: placed } = await shop.get<{ order: { metadata: Record<string, unknown> } }>(
      `/admin/orders/${orderId}?fields=id,metadata`
    )
    expect(placed.metadata).toMatchObject({
      qt_payment_link: linkId,
      qt_payment_link_number: Number(link.number.replace(/^PL-/, "")),
    })
  } finally {
    try {
      await cleanUp(api, link, undo)
    } finally {
      removeTemporaryAdmin(admin.email)
    }
  }
})

/** A link left open is canceled while the flag still stands; then the shop as it was. */
async function cleanUp(api: AdminApi | null, link: Link | null, undo: Undo[]): Promise<void> {
  if (!api) {
    return
  }
  const errors: unknown[] = []
  const attempt = async (step: Undo) => {
    await step().catch((error: unknown) => errors.push(error))
  }
  if (link) {
    const id = link.id
    await attempt(async () => {
      const { payment_link } = await api.get<{ payment_link: Link }>(`/admin/payment-links/${id}`)
      if (payment_link.status === "open") {
        await api.post(`/admin/payment-links/${id}/cancel`, {})
      }
    })
  }
  for (const step of undo.reverse()) {
    await attempt(step)
  }
  await attempt(() => api.dispose())
  if (errors.length > 0) {
    throw new AggregateError(errors, "payment link e2e: cleaning up failed")
  }
}
