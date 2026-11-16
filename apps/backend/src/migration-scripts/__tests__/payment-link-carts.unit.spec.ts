import { asValue } from "@medusajs/framework/awilix"
import { ContainerRegistrationKeys, createMedusaContainer } from "@medusajs/framework/utils"
import { PAYMENT_LINKS_MODULE } from "../../modules/payment-links"
import { fillPaymentLinkCarts } from "../payment-link-carts"

const knex = { raw: jest.fn() }
const links = { recordLinkCarts: jest.fn(), listPaymentLinks: jest.fn() }

function container() {
  const made = createMedusaContainer()
  made.register({
    [ContainerRegistrationKeys.PG_CONNECTION]: asValue(knex),
    [PAYMENT_LINKS_MODULE]: asValue(links),
  })
  return made
}

/** The links that are there: those named, but for `plink_gone`. */
const existing = () =>
  links.listPaymentLinks.mockImplementation(async (filters: { id: string[] }) =>
    Promise.resolve(filters.id.filter((id) => id !== "plink_gone").map((id) => ({ id })))
  )

afterEach(() => {
  jest.resetAllMocks()
})

describe("payment link carts fill (migration script)", () => {
  it("keeps every marked cart's pair, a batch at a time past the batch before's last id", async () => {
    existing()
    knex.raw
      .mockResolvedValueOnce({
        rows: [
          { id: "cart_1", link_id: "plink_1" },
          { id: "cart_2", link_id: "plink_1" },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ id: "cart_3", link_id: "plink_2" }] })
    links.recordLinkCarts.mockResolvedValueOnce(2).mockResolvedValueOnce(0)

    const result = await fillPaymentLinkCarts(container(), 2)

    expect(result).toEqual({ read: 3, added: 2, skipped: 0 })
    expect(knex.raw).toHaveBeenCalledTimes(2)
    const [sql, firstValues] = knex.raw.mock.calls[0] as [string, unknown[]]
    const [, nextValues] = knex.raw.mock.calls[1] as [string, unknown[]]
    expect(sql).toMatch(/WHERE c\.id > \?/u)
    expect(sql).toMatch(/ORDER BY c\.id\s/u)
    // The key, the cursor and the batch bound, never written into the SQL
    expect(sql).not.toMatch(/qt_payment_link/u)
    expect(firstValues).toEqual(["qt_payment_link", "", "qt_payment_link", 2])
    expect(nextValues).toEqual(["qt_payment_link", "cart_2", "qt_payment_link", 2])
    expect(links.listPaymentLinks).toHaveBeenNthCalledWith(
      1,
      { id: ["plink_1"] },
      expect.objectContaining({ select: ["id"] })
    )
    expect(links.recordLinkCarts).toHaveBeenNthCalledWith(1, [
      { link_id: "plink_1", cart_id: "cart_1" },
      { link_id: "plink_1", cart_id: "cart_2" },
    ])
    expect(links.recordLinkCarts).toHaveBeenNthCalledWith(2, [
      { link_id: "plink_2", cart_id: "cart_3" },
    ])
  })

  it("keeps no cart whose mark names a link that is not there", async () => {
    existing()
    knex.raw.mockResolvedValueOnce({
      rows: [
        { id: "cart_1", link_id: "plink_gone" },
        { id: "cart_2", link_id: "plink_1" },
      ],
    })
    links.recordLinkCarts.mockResolvedValueOnce(1)

    const result = await fillPaymentLinkCarts(container(), 5)

    expect(result).toEqual({ read: 2, added: 1, skipped: 1 })
    expect(links.recordLinkCarts).toHaveBeenCalledWith([{ link_id: "plink_1", cart_id: "cart_2" }])
  })

  it("stops on an empty batch, with nothing to keep", async () => {
    knex.raw.mockResolvedValueOnce({ rows: [] })
    links.recordLinkCarts.mockResolvedValueOnce(0)

    const result = await fillPaymentLinkCarts(container(), 2)

    expect(result).toEqual({ read: 0, added: 0, skipped: 0 })
    expect(knex.raw).toHaveBeenCalledTimes(1)
    expect(links.listPaymentLinks).not.toHaveBeenCalled()
  })
})
