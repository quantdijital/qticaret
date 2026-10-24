import { randomBytes } from "node:crypto"
import { moduleIntegrationTestRunner } from "@medusajs/test-utils"
import { BILLING_PROFILE_MODULE } from ".."
import type BillingProfileModuleService from "../service"

jest.setTimeout(60 * 1000)

// Algorithmically valid test numbers, not real people or companies
const TCKN = "10000000146"
const VKN = "1234567890"

moduleIntegrationTestRunner<BillingProfileModuleService>({
  moduleName: BILLING_PROFILE_MODULE,
  resolve: "./src/modules/billing-profile",
  moduleOptions: {
    encryptionKey: randomBytes(32).toString("hex"),
    hashKey: randomBytes(32).toString("hex"),
  },
  testSuite: ({ service }) => {
    describe("prepareProfileData", () => {
      it("stores only ciphertext, keyed hash and last four digits", () => {
        const data = service.prepareProfileData({
          type: "individual",
          legal_name: "  Ayşe Yılmaz ",
          tax_id: "100 000 001 46",
        })

        expect(data).toMatchObject({
          legal_name: "Ayşe Yılmaz",
          tax_office: null,
          tax_id_kind: "tckn",
          tax_id_last4: "0146",
          tax_id_hash: service.hashTaxId(TCKN),
          key_version: 1,
        })
        expect(JSON.stringify(data)).not.toContain(TCKN)
      })

      it("accepts a VKN or a sole proprietor's TCKN for corporates", () => {
        const base = { type: "corporate" as const, legal_name: "Örnek", tax_office: "Kadıköy" }

        expect(service.prepareProfileData({ ...base, tax_id: VKN }).tax_id_kind).toBe("vkn")
        expect(service.prepareProfileData({ ...base, tax_id: TCKN }).tax_id_kind).toBe("tckn")
      })

      it.each([
        ["billing_profile.tax_id_invalid", { type: "individual" as const, tax_id: VKN }],
        ["billing_profile.tax_id_invalid", { type: "individual" as const, tax_id: "10000000147" }],
        ["billing_profile.tax_office_required", { type: "corporate" as const, tax_id: VKN }],
      ])("throws %s", (message, input) => {
        expect(() => service.prepareProfileData({ legal_name: "Örnek", ...input })).toThrow(message)
      })
    })

    describe("revealTaxId", () => {
      it("decrypts a stored profile", async () => {
        const profile = await service.createBillingProfiles(
          service.prepareProfileData({
            type: "individual",
            legal_name: "Ayşe Yılmaz",
            tax_id: TCKN,
          })
        )

        expect(await service.revealTaxId(profile.id)).toBe(TCKN)
      })
    })
  },
})
