import { asValue } from "@medusajs/framework/awilix"
import { createMedusaContainer } from "@medusajs/framework/utils"
import { logger } from "../../../lib/logging"
import { PAYMENT_LINKS_MODULE } from "../../../modules/payment-links"
import { claimLinkForCart, releaseLinkClaim } from "../cart-guard"

const links = { claimForCart: jest.fn(), releaseClaim: jest.fn() }

function container() {
  const made = createMedusaContainer()
  made.register({ [PAYMENT_LINKS_MODULE]: asValue(links) })
  return made
}

afterEach(() => {
  jest.restoreAllMocks()
  jest.resetAllMocks()
})

describe("a completion's hold on its payment link", () => {
  it("holds the link for the cart and hands back what to let go of", async () => {
    links.claimForCart.mockResolvedValue(true)

    await expect(claimLinkForCart(container(), "plink_1", "cart_1")).resolves.toEqual({
      link_id: "plink_1",
      cart_id: "cart_1",
    })
    expect(links.claimForCart).toHaveBeenCalledWith("plink_1", "cart_1")
  })

  it("refuses the cart as for a closed link when another holds it, ids only in the log", async () => {
    links.claimForCart.mockResolvedValue(false)
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

  it("lets go of the cart's own hold when its completion fails later", async () => {
    await releaseLinkClaim(container(), { link_id: "plink_1", cart_id: "cart_1" })

    expect(links.releaseClaim).toHaveBeenCalledWith("plink_1", "cart_1")
  })

  it("lets go of nothing for an ordinary cart, or the hook's answer passed instead", async () => {
    await releaseLinkClaim(container(), null)
    await releaseLinkClaim(container(), undefined)
    await releaseLinkClaim(container(), {} as never)

    expect(links.releaseClaim).not.toHaveBeenCalled()
  })
})
