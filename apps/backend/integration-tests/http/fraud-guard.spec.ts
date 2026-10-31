import { randomUUID } from "node:crypto"
import { completeCartWorkflow } from "@medusajs/medusa/core-flows"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { createAdminUser } from "../helpers/admin"
import { freshChallenge, solved } from "../helpers/challenge"
import type { GivenChallenge } from "../helpers/challenge"
import { eventually } from "../helpers/eventually"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { readyCart } from "../helpers/paytr"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(180 * 1000)

const COD = "pp_cod_cod"

type Challenge = GivenChallenge

const fresh = freshChallenge

/** F15.6 (adr/0044): block list, checkout velocity (KK4), held orders, proofs of work. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let shop: StockShop
    let storefront: Storefront
    let variantId: string
    let admin: { headers: Record<string, string> }

    const post = <T = unknown>(path: string, body: unknown, headers: Record<string, string>) =>
      settle(http.post<T>(path, body, { headers }))
    // Each cart its own buyer: the counters are the file's, across its tests
    const codCart = async (email = `alici-${randomUUID()}@example.com`) => {
      const cartId = await readyCart(getContainer(), shop, variantId)
      const changed = await post(`/store/carts/${cartId}`, { email }, storefront.headers)
      expect(changed.status).toBe(200)
      const started = await post(
        `/store/carts/${cartId}/payment-session`,
        { provider_id: COD },
        storefront.headers
      )
      expect(started.status).toBe(200)
      return cartId
    }
    const complete = (cartId: string, headers: Record<string, string> = {}) =>
      post<{ type?: string; order?: { id: string }; message?: string; challenge?: Challenge }>(
        `/store/carts/${cartId}/complete`,
        {},
        { ...storefront.headers, ...headers }
      )

    const relaxed = process.env["RATE_LIMIT_RELAXED"]
    afterEach(() => {
      if (relaxed === undefined) {
        delete process.env["RATE_LIMIT_RELAXED"]
      } else {
        process.env["RATE_LIMIT_RELAXED"] = relaxed
      }
    })

    beforeEach(async () => {
      const container = getContainer()
      await loadTrAddressFixture(container)
      shop = await stockShop(container)
      storefront = await createStorefront(container)
      variantId = (await stockedProduct(container, shop, `kupa-${String(Date.now())}`, 50, 120))
        .variantId
      admin = await createAdminUser(http, container)
      for (const [path, body] of [
        [
          "/admin/platform-settings/cash_on_delivery",
          {
            fee_type: "none",
            fee_value: 0,
            max_amount: 0,
            shipping_option_ids: [shop.shippingOptionId],
          },
        ],
        ["/admin/features/payments.cash_on_delivery", { enabled: true }],
      ] as const) {
        const saved = await post(path, body, admin.headers)
        expect(saved.status).toBe(200)
      }
    })

    it("stops a blocked buyer's checkout without saying why, and lets it go once removed", async () => {
      // A cart whose payment began before its buyer was listed
      const cartId = await codCart("ayse.yilmaz@example.com")
      const added = await post<{ block: { id: string; display: string } }>(
        "/admin/fraud/blocks",
        { kind: "email", value: "Ayse.Yilmaz+indirim@example.com", reason: "ters ibraz" },
        admin.headers
      )
      const refused = await complete(cartId)
      const restarted = await post<{ message?: string }>(
        `/store/carts/${cartId}/payment-session`,
        { provider_id: COD },
        storefront.headers
      )
      // However it is completed (a card's provider notice too), the order is refused
      const { errors } = await completeCartWorkflow(getContainer()).run({
        input: { id: cartId },
        throwOnError: false,
      })
      const listed = await http.get<{ blocks: { display: string; match?: string }[] }>(
        "/admin/fraud/blocks",
        { headers: admin.headers }
      )
      // Nor does it register; a sign-in answers as a wrong password does
      const registering = await post(
        "/auth/customer/emailpass/register",
        { email: "ayse.yilmaz@example.com", password: randomUUID() },
        {}
      )
      const signIn = (email: string) =>
        post<{ message?: string; type?: string }>(
          "/auth/customer/emailpass",
          { email, password: `yanlis-${randomUUID()}` },
          {}
        )
      const blockedSignIn = await signIn("ayse.yilmaz@example.com")
      const wrongPassword = await signIn(`kimse-${randomUUID()}@example.com`)
      await http.delete(`/admin/fraud/blocks/${added.data.block.id}`, { headers: admin.headers })
      const placed = await complete(cartId)

      expect(added.status).toBe(201)
      expect(refused.status).toBe(403)
      expect(refused.data.message).toBe("fraud.checkout_refused")
      expect(restarted.status).toBe(403)
      expect((errors[0]?.error as { safeMessage?: string } | undefined)?.safeMessage).toBe(
        "fraud.checkout_refused"
      )
      // Masked, and the keyed hash it is found by never leaves
      expect(listed.data.blocks).toEqual([
        expect.objectContaining({ display: "ay***@example.com" }),
      ])
      expect(listed.data.blocks[0]).not.toHaveProperty("match")
      expect(registering.status).toBe(403)
      expect(registering.data).toMatchObject({ message: "fraud.refused" })
      expect(blockedSignIn.status).toBe(wrongPassword.status)
      expect({ ...blockedSignIn.data, request_id: null }).toEqual({
        ...wrongPassword.data,
        request_id: null,
      })
      expect(placed.data.type).toBe("order")
    })

    it("holds a suspicious order for a person, who approves it once", async () => {
      const owner = await createAdminUser(http, getContainer())
      const tuned = await post(
        "/admin/platform-settings/security",
        { fraud_review_score: 30, fraud_high_amount: 100 },
        owner.headers
      )
      const placed = await complete(await codCart())
      const orderId = placed.data.order?.id ?? ""
      const queue = await eventually(
        () =>
          http.get<{ reviews: { id: string; order: { id: string } | null; reasons: unknown[] }[] }>(
            "/admin/fraud/reviews",
            { headers: admin.headers }
          ),
        (answer) => answer.data.reviews.length > 0
      )
      const review = queue.data.reviews[0]
      const held = await post(`/admin/orders/${orderId}/ship`, { notify: false }, admin.headers)
      const decide = (status: string) =>
        post(`/admin/fraud/reviews/${review?.id ?? ""}/decision`, { status }, admin.headers)
      const approved = await decide("approved")
      const again = await decide("rejected")
      const shipped = await post<{ message?: string }>(
        `/admin/orders/${orderId}/ship`,
        { notify: false },
        admin.headers
      )
      const bell = await eventually(
        () =>
          http.get<{ notifications: { data: { kind?: string; order_id?: string } }[] }>(
            "/admin/notifications?channel=feed",
            { headers: admin.headers }
          ),
        (answer) => answer.data.notifications.some((one) => one.data.kind === "fraud_review")
      )

      expect(tuned.status).toBe(200)
      expect(review?.order?.id).toBe(orderId)
      expect(review?.reasons).toEqual([{ rule: "new_customer_high_amount", points: 30 }])
      expect(held.status).toBe(400)
      expect(held.data).toMatchObject({ message: "fraud.review_pending" })
      expect(approved.status).toBe(200)
      expect(again.status).toBe(409)
      expect(again.data).toMatchObject({ message: "fraud.review_decided" })
      expect(shipped.data.message ?? "").not.toMatch(/^fraud\./)
      expect(
        bell.data.notifications.find((one) => one.data.kind === "fraud_review")?.data.order_id
      ).toBe(orderId)
    })

    it("asks a proof of a visitor registering often, and of a sixth sign-in in a quarter hour", async () => {
      // Per-address limits at their real size here (integration tests grow them)
      process.env["RATE_LIMIT_RELAXED"] = "0"
      const register = (headers: Record<string, string> = {}) =>
        post<{ token?: string; message?: string; challenge?: Challenge }>(
          "/auth/customer/emailpass/register",
          // Throwaway credential for this test database only
          { email: `kayit-${randomUUID()}@example.com`, password: randomUUID() },
          headers
        )
      for (let n = 0; n < 3; n++) {
        expect((await register()).status).toBe(200)
      }
      const asked = await register()
      const proven = await register(solved(asked.data.challenge))

      const email = `giris-${randomUUID()}@example.com`
      const password = randomUUID()
      await post("/auth/customer/emailpass/register", { email, password }, fresh("register"))
      const signIn = (secret: string, headers: Record<string, string> = {}) =>
        post<{ token?: string; message?: string; challenge?: Challenge }>(
          "/auth/customer/emailpass",
          { email, password: secret },
          headers
        )
      for (let n = 0; n < 5; n++) {
        expect((await signIn(`yanlis-${randomUUID()}`)).status).toBe(401)
      }
      const askedLogin = await signIn(password)
      const signedIn = await signIn(password, solved(askedLogin.data.challenge))

      expect(asked.status).toBe(428)
      expect(asked.data.message).toBe("fraud.challenge_required")
      expect(proven.status).toBe(200)
      expect(askedLogin.status).toBe(428)
      expect(signedIn.status).toBe(200)
      expect(signedIn.data.token).toEqual(expect.any(String))
    })

    it("asks a proof past the soft limit and stops past the hard one (KK4)", async () => {
      // The limits at their real size here (integration tests grow them)
      process.env["RATE_LIMIT_RELAXED"] = "0"
      // One buyer; a cart has its own budget of starts (the rate limiter's), so a new one every ten
      const email = `hiz-${randomUUID()}@example.com`
      let cartId = ""
      let starts = 0
      const start = async (headers: Record<string, string> = {}) => {
        if (starts++ % 10 === 0) {
          cartId = await readyCart(getContainer(), shop, variantId)
          await post(`/store/carts/${cartId}`, { email }, storefront.headers)
        }
        // Every way to pay starts here, a card's hosted form too: each start counts
        return post<{ message?: string; challenge?: Challenge }>(
          `/store/carts/${cartId}/payment-session`,
          { provider_id: COD },
          { ...storefront.headers, ...headers }
        )
      }
      const first = await start()
      let asked = await start()
      for (let n = 0; n < 5 && asked.status !== 428; n++) {
        asked = await start()
      }
      const proven = await start(solved(asked.data.challenge))
      const reused = await start(solved(asked.data.challenge))
      const passed: number[] = []
      let stopped = await start(fresh("checkout"))
      while (stopped.status === 200 && passed.length < 40) {
        passed.push(stopped.status)
        stopped = await start(fresh("checkout"))
      }

      expect(first.status).toBe(200)
      expect(asked.status).toBe(428)
      expect(asked.data.message).toBe("fraud.challenge_required")
      expect(asked.data.challenge).toMatchObject({ bits: 18 })
      expect(proven.status).toBe(200)
      // A solution counts once; the same one again is a new ask
      expect(reused.status).toBe(428)
      // The e-mail's limit asks proofs, never stops: the address's hard limit does
      expect(passed.length).toBeGreaterThan(10)
      expect(stopped.status).toBe(429)
      expect(stopped.data.message).toBe("fraud.velocity")
    })
  },
})
