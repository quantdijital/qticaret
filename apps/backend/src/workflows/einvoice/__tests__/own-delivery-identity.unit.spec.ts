import type { MedusaContainer } from "@medusajs/framework/types"
import { ownDeliveryIdentity, settingsOf } from "../draft-parts"

/*
 * The e-Arşiv's carrier for a parcel the shop carries itself: the shop's
 * own legal identity, unless it entered another; the carriers' own as
 * entered, never filled in.
 */

const ARAS = { title: "Örnek Kargo A.Ş.", tax_id: "1234567890" }
const LEGAL = { company_title: " Örnek Mağaza Ltd. Şti. ", tax_number: "9876543210" }

describe("the carrier of the shop's own parcels on an e-Arşiv", () => {
  it("is the shop's legal identity when nothing was entered for them", () => {
    expect(ownDeliveryIdentity({ aras: ARAS }, LEGAL)).toEqual({
      aras: ARAS,
      manual: { title: "Örnek Mağaza Ltd. Şti.", tax_id: "9876543210" },
    })
  })

  it("is what the shop entered for them, when it did", () => {
    const manual = { title: "Başka Unvan", tax_id: "11111111110" }
    expect(ownDeliveryIdentity({ manual }, LEGAL)).toEqual({ manual })
  })

  it("stays missing while the legal identity lacks its name or tax id", () => {
    expect(ownDeliveryIdentity({}, { company_title: "Mağaza", tax_number: null })).toEqual({})
    expect(ownDeliveryIdentity({}, { company_title: "  ", tax_number: "9876543210" })).toEqual({})
  })

  it("is read with the invoicing settings for every draft", async () => {
    const values: Record<string, unknown> = {
      invoicing: { carriers: { aras: ARAS } },
      seo: { canonical_host: "magaza.example" },
      legal: LEGAL,
    }
    const container = {
      resolve: () => ({
        readSection: (name: string) => Promise.resolve({ values: values[name] }),
      }),
    } as unknown as Pick<MedusaContainer, "resolve">
    const settings = await settingsOf(container, {
      NODE_ENV: "production",
      STOREFRONT_ORIGIN: undefined,
    })
    expect(settings.carriers).toEqual({
      aras: ARAS,
      manual: { title: "Örnek Mağaza Ltd. Şti.", tax_id: "9876543210" },
    })
  })
})
