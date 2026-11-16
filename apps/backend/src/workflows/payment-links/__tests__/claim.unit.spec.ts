import { asValue } from "@medusajs/framework/awilix"
import { ContainerRegistrationKeys, createMedusaContainer } from "@medusajs/framework/utils"
import { isRetryable } from "../../../lib/errors"
import { logger } from "../../../lib/logging"
import { CLAIM_TTL_MS, heldByOther } from "../../../lib/payment-links/snapshot"
import { PAYMENT_LINKS_MODULE } from "../../../modules/payment-links"
import { assertLinkCartCompletes, claimLinkForCart, releaseLinkClaim } from "../cart-guard"

const links = { claimForCart: jest.fn(), releaseClaim: jest.fn(), listPaymentLinks: jest.fn() }
const query = { graph: jest.fn() }

function container() {
  const made = createMedusaContainer()
  made.register({
    [PAYMENT_LINKS_MODULE]: asValue(links),
    [ContainerRegistrationKeys.QUERY]: asValue(query),
  })
  return made
}

describe("completing a link's cart that is already an order", () => {
  it("passes it without judging the link or holding it, so its order is answered", async () => {
    query.graph.mockResolvedValue({
      data: [{ id: "cart_1", metadata: { qt_payment_link: "plink_1" }, order: { id: "order_1" } }],
    })

    await expect(assertLinkCartCompletes(container(), "cart_1")).resolves.toBeNull()
    expect(links.listPaymentLinks).not.toHaveBeenCalled()
  })

  it("still judges a link's cart that is not an order yet", async () => {
    query.graph.mockResolvedValue({
      data: [{ id: "cart_2", metadata: { qt_payment_link: "plink_1" }, order: null }],
    })
    links.listPaymentLinks.mockResolvedValue([])

    await expect(assertLinkCartCompletes(container(), "cart_2")).rejects.toMatchObject({
      safeMessage: "cart.payment_link_closed",
    })
  })
})

afterEach(() => {
  jest.restoreAllMocks()
  jest.resetAllMocks()
})

describe("a completion's hold on its payment link", () => {
  it("holds the link for the cart under a mark of its own run", async () => {
    links.claimForCart.mockResolvedValue("held")

    const claim = await claimLinkForCart(container(), "plink_1", "cart_1")

    expect(claim).toEqual({
      link_id: "plink_1",
      cart_id: "cart_1",
      token: expect.any(String) as unknown,
    })
    expect(links.claimForCart).toHaveBeenCalledWith("plink_1", "cart_1", claim.token)
    // Every run its own mark
    const again = await claimLinkForCart(container(), "plink_1", "cart_1")
    expect(again.token).not.toBe(claim.token)
  })

  it("refuses a cart that may not become the link's order as for a closed link, ids only in the log", async () => {
    links.claimForCart.mockResolvedValue("refused")
    const warn = jest.spyOn(logger, "warn").mockImplementation(() => undefined)

    await expect(claimLinkForCart(container(), "plink_1", "cart_2")).rejects.toMatchObject({
      safeMessage: "cart.payment_link_closed",
    })
    expect(warn).toHaveBeenCalledWith({
      event: "payment_links.claim_refused",
      linkId: "plink_1",
      cartId: "cart_2",
    })
  })

  it("has the cart tried again while another cart's completion holds the link", async () => {
    links.claimForCart.mockResolvedValue("busy")
    jest.spyOn(logger, "info").mockImplementation(() => undefined)

    const error = await claimLinkForCart(container(), "plink_1", "cart_2").catch(
      (thrown: unknown) => thrown
    )

    // Retried, never refunded: the holder may yet fail
    expect(isRetryable(error)).toBe(true)
  })

  it("lets go of its own run's hold when its completion fails later", async () => {
    await releaseLinkClaim(container(), { link_id: "plink_1", cart_id: "cart_1", token: "run_1" })

    expect(links.releaseClaim).toHaveBeenCalledWith("plink_1", "run_1")
  })

  it("lets go of nothing for an ordinary cart, or the hook's answer passed instead", async () => {
    await releaseLinkClaim(container(), null)
    await releaseLinkClaim(container(), undefined)
    await releaseLinkClaim(container(), {} as never)

    expect(links.releaseClaim).not.toHaveBeenCalled()
  })
})

describe("heldByOther", () => {
  const now = new Date("2026-11-16T12:00:00Z")
  const at = (ms: number) => new Date(now.getTime() - ms)

  it("is another cart's fresh hold only", () => {
    expect(heldByOther({ claimed_cart_id: "cart_1", claimed_at: at(1000) }, "cart_2", now)).toBe(
      true
    )
    expect(heldByOther({ claimed_cart_id: "cart_2", claimed_at: at(1000) }, "cart_2", now)).toBe(
      false
    )
    expect(
      heldByOther({ claimed_cart_id: "cart_1", claimed_at: at(CLAIM_TTL_MS + 1) }, "cart_2", now)
    ).toBe(false)
    expect(heldByOther({ claimed_cart_id: null, claimed_at: null }, "cart_2", now)).toBe(false)
    // "": any cart's hold (cancel and expiry)
    expect(heldByOther({ claimed_cart_id: "cart_1", claimed_at: at(1000) }, "", now)).toBe(true)
  })
})
