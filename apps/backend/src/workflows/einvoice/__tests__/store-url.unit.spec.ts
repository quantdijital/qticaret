import type { MedusaContainer } from "@medusajs/framework/types"
import { settingsOf } from "../draft-parts"

/*
 * The invoice draft's store address: the canonical host; on a developer's
 * machine with none set, the dev storefront (as messages' links), so a dev
 * invoice has one; deployed, none stands in.
 */

const shopWith = (host: string | null) =>
  ({
    resolve: () => ({
      readSection: (name: string) =>
        Promise.resolve({
          values: name === "seo" ? { canonical_host: host } : { carriers: {} },
        }),
    }),
  }) as unknown as Pick<MedusaContainer, "resolve">

describe("the e-invoice draft's store address", () => {
  it("is the canonical host wherever the shop has one", async () => {
    for (const NODE_ENV of ["development", "production"] as const) {
      const settings = await settingsOf(shopWith("magaza.example"), {
        NODE_ENV,
        STOREFRONT_ORIGIN: undefined,
      })
      expect(settings.store_url).toBe("https://magaza.example")
    }
  })

  it("falls back to the dev storefront on a developer's machine only", async () => {
    const dev = await settingsOf(shopWith(null), {
      NODE_ENV: "development",
      STOREFRONT_ORIGIN: undefined,
    })
    expect(dev.store_url).toBe("http://localhost:8000")
    const set = await settingsOf(shopWith(null), {
      NODE_ENV: "development",
      STOREFRONT_ORIGIN: "http://127.0.0.1:8100/",
    })
    expect(set.store_url).toBe("http://127.0.0.1:8100")
    for (const NODE_ENV of ["production", "staging", "test"] as const) {
      const live = await settingsOf(shopWith(null), { NODE_ENV, STOREFRONT_ORIGIN: undefined })
      expect(live.store_url).toBeNull()
    }
  })
})
